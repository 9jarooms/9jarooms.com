import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyPayment } from '@/lib/paystack';
import { confirmPaidBooking, notifyTeamNewBooking, notifyGuestBookingConfirmed } from '@/lib/booking/payment-confirmed';
import { inngest } from '@/lib/inngest/client';

// Called by /booking/confirm when Paystack redirects the guest back.
// Verifies with Paystack and confirms the booking if the webhook has not
// already done so (whichever arrives first wins; the other is a no-op).
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const reference = searchParams.get('reference');

    if (!reference) {
        return NextResponse.json({ error: 'Missing payment reference' }, { status: 400 });
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
            return NextResponse.json({ status: 'success', booking });
        }

        const verification = await verifyPayment(reference);
        if (!verification.status || verification.data.status !== 'success') {
            return NextResponse.json({ status: 'pending', paystack_status: verification.data?.status });
        }

        const { booking: confirmed, alreadyPaid } = await confirmPaidBooking(supabase, {
            reference,
            amountKobo: verification.data.amount,
            raw: verification.data,
        });

        if (!alreadyPaid) {
            const [team, guest] = await Promise.all([
                notifyTeamNewBooking(supabase, confirmed),
                notifyGuestBookingConfirmed(confirmed),
            ]);
            console.log(`[Verify] ${reference} confirmed · team email: ${team.sent ? team.to?.join(',') : team.reason} · guest email: ${guest.sent ? 'sent' : guest.reason}`);
            try {
                await inngest.send({
                    name: 'payment/confirmed',
                    data: { reference, amount: verification.data.amount, paystackData: verification.data },
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

        return NextResponse.json({ status: 'success', booking: updatedBooking });
    } catch (error: any) {
        console.error('API /bookings/verify Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
