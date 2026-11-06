import { NextRequest, NextResponse } from 'next/server';
import { validateWebhookSignature } from '@/lib/paystack';
import { createAdminClient } from '@/lib/supabase/server';
import { confirmPaidBooking, notifyTeamNewBooking, notifyGuestBookingConfirmed, BookingNotFound } from '@/lib/booking/payment-confirmed';
import { notifyCaretakersPaid, notifyCaretakersRefundNeeded } from '@/lib/booking/notify-caretakers';
import { inngest } from '@/lib/inngest/client';
import { pushBooking } from '@/lib/push';

// Paystack webhook: https://www.9jarooms.com/api/webhooks/paystack
// Signature-checked with the secret key. On charge.success the booking is
// confirmed and the team + guest are emailed right here, synchronously —
// no queue in between that could silently drop it.
export async function POST(request: NextRequest) {
    const body = await request.text();
    const signature = request.headers.get('x-paystack-signature') || '';

    if (!validateWebhookSignature(body, signature)) {
        console.error('Invalid Paystack webhook signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let event: any;
    try {
        event = JSON.parse(body);
    } catch {
        return NextResponse.json({ error: 'Bad JSON' }, { status: 400 });
    }
    console.log('Paystack webhook received:', event.event);

    if (event.event !== 'charge.success') {
        return NextResponse.json({ received: true });
    }

    const { reference, amount, metadata } = event.data || {};
    try {
        const supabase = createAdminClient();
        const { booking, alreadyPaid, refundNeeded } = await confirmPaidBooking(supabase, {
            reference,
            bookingId: metadata?.booking_id || null,
            amountKobo: amount,
            currency: event.data?.currency,
            raw: event.data,
        });

        if (refundNeeded) {
            console.error(`[Paystack] ${reference} paid after the hold expired and the unit is taken — refund needed`);
            await notifyCaretakersRefundNeeded(supabase, booking.id).catch(e => console.error('[Paystack] refund alert failed:', e?.message));
        } else if (!alreadyPaid) {
            const [team, guest] = await Promise.all([
                notifyTeamNewBooking(supabase, booking).catch(e => ({ sent: false, reason: e?.message } as any)),
                notifyGuestBookingConfirmed(booking).catch(e => ({ sent: false, reason: e?.message } as any)),
                notifyCaretakersPaid(supabase, booking.id).catch(() => null),
                pushBooking(supabase, booking.id),
            ]);
            console.log(`[Paystack] ${reference} confirmed · team email: ${team.sent ? 'sent' : team.reason} · guest email: ${guest.sent ? 'sent' : guest.reason}`);

            // WhatsApp confirmations still run through Inngest when it is configured
            try {
                await inngest.send({
                    name: 'payment/confirmed',
                    data: { reference, amount, metadata },
                });
            } catch (e: any) {
                console.warn('[Paystack] Inngest not available (non-blocking):', e?.message);
            }
        } else {
            console.log(`[Paystack] ${reference} already confirmed — nothing to do`);
        }
    } catch (error: any) {
        // not one of our bookings (another product on the same Paystack account): nothing to retry
        if (error instanceof BookingNotFound) return NextResponse.json({ received: true, ignored: 'unknown reference' });
        // Tell Paystack it failed so it tries again later (it retries for up to 72 hours). Processing is
        // safe to repeat: a payment already handled is recognised by its reference and skipped.
        console.error('Paystack webhook processing error:', error?.message || error);
        return NextResponse.json({ error: 'processing failed, retry' }, { status: 500 });
    }

    return NextResponse.json({ received: true });
}
