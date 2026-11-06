import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyPayment } from '@/lib/paystack';
import { confirmPaidBooking, notifyTeamNewBooking, notifyGuestBookingConfirmed } from '@/lib/booking/payment-confirmed';
import { notifyCaretakersPaid, notifyCaretakersRefundNeeded } from '@/lib/booking/notify-caretakers';
import { inngest } from '@/lib/inngest/client';
import { pushBooking } from '@/lib/push';

// Called by /booking/confirm when Paystack redirects the guest back.
// Verifies with Paystack and confirms the booking if the webhook has not
// already done so (whichever arrives first wins; the other is a no-op).
// The confirm page is reachable by anyone holding a reference, so it gets only what it shows:
// dates, the guest's own email and the property details for arrival. No phone, ID or internal fields.
// Once the stay is over the reference opens nothing private: old references may have been passed to
// ad trackers before they were removed from the address.
function publicView(b: any) {
    if (!b) return b;
    const p = b.property || {};
    const lagosToday = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);
    if (String(b.check_out).slice(0, 10) < lagosToday) {
        return { id: b.id, status: b.status, check_in: b.check_in, check_out: b.check_out, nights: b.nights, room: null,
            property: { name: p.name, area: p.area, city: p.city } };
    }
    return {
        id: b.id, status: b.status, check_in: b.check_in, check_out: b.check_out, nights: b.nights, total_amount: b.total_amount,
        guest_name: b.guest_name, guest_email: b.guest_email, paystack_reference: b.paystack_reference,
        room: b.room ? { name: b.room.name, unit_code: b.room.unit_code } : null,
        property: { name: p.name, address: p.address, area: p.area, city: p.city, check_in_time: p.check_in_time, check_out_time: p.check_out_time,
            check_in_instructions: ['paid', 'checked_in', 'completed'].includes(b.status) ? p.check_in_instructions : null },
    };
}

const tries = new Map<string, { count: number; resetAt: number }>();

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const reference = searchParams.get('reference');

    if (!reference || !/^[A-Za-z0-9_-]{6,100}$/.test(reference)) {
        return NextResponse.json({ error: 'Missing payment reference' }, { status: 400 });
    }

    // the page checks every 2 seconds while Paystack finishes: this leaves room for that, not for guessing
    const ip = (request.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();
    const now = Date.now();
    if (tries.size > 5000) tries.clear();
    const seen = tries.get(ip);
    if (seen && seen.resetAt > now) {
        if (seen.count >= 60) return NextResponse.json({ error: 'Too many checks. Please try again in a few minutes.' }, { status: 429 });
        seen.count++;
    } else {
        tries.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
    }

    try {
        const supabase = createAdminClient();

        const { data: booking, error: dbError } = await supabase
            .from('bookings')
            .select('*, property:properties(*), room:rooms(*)')
            .eq('paystack_reference', reference)
            .single();

        if (dbError || !booking) {
            return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        }

        if (['paid', 'checked_in', 'completed'].includes(booking.status)) {
            return NextResponse.json({ status: 'success', booking: publicView(booking) });
        }

        const verification = await verifyPayment(reference);
        if (!verification.status || verification.data.status !== 'success') {
            return NextResponse.json({ status: 'pending', paystack_status: verification.data?.status });
        }

        const { booking: confirmed, alreadyPaid, refundNeeded } = await confirmPaidBooking(supabase, {
            reference,
            amountKobo: verification.data.amount,
            currency: verification.data.currency,
            raw: verification.data,
        });

        if (refundNeeded) {
            console.error(`[Verify] ${reference} paid after the hold expired and the unit is taken — refund needed`);
            await notifyCaretakersRefundNeeded(supabase, confirmed.id);
            return NextResponse.json({ status: 'refund_needed', booking: publicView(confirmed) });
        }

        if (!alreadyPaid) {
            const [team, guest] = await Promise.all([
                notifyTeamNewBooking(supabase, confirmed),
                notifyGuestBookingConfirmed(confirmed),
                notifyCaretakersPaid(supabase, confirmed.id),
                pushBooking(supabase, confirmed.id),
            ]);
            console.log(`[Verify] ${reference} confirmed · team email: ${team.sent ? 'sent' : team.reason} · guest email: ${guest.sent ? 'sent' : guest.reason}`);
            try {
                await inngest.send({
                    name: 'payment/confirmed',
                    data: { reference, amount: verification.data.amount },
                });
            } catch (inngestErr: any) {
                console.warn('[Verify API] Inngest event failed (non-blocking):', inngestErr?.message);
            }
        }

        const { data: updatedBooking } = await supabase
            .from('bookings')
            .select('*, property:properties(*), room:rooms(*)')
            .eq('paystack_reference', reference)
            .single();

        // the payment was processed (here or by the webhook) but the room was lost: never say "confirmed"
        if (updatedBooking && ['cancelled', 'expired', 'no_show'].includes(updatedBooking.status)) {
            return NextResponse.json({ status: 'refund_needed', booking: publicView(updatedBooking) });
        }
        return NextResponse.json({ status: 'success', booking: publicView(updatedBooking) });
    } catch (error: any) {
        console.error('API /bookings/verify Error:', error);
        return NextResponse.json({ error: 'Could not check this payment right now. Please try again.' }, { status: 500 });
    }
}
