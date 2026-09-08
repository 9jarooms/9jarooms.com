import { NextRequest, NextResponse } from 'next/server';
import { validateWebhookSignature } from '@/lib/paystack';
import { createAdminClient } from '@/lib/supabase/server';
import { confirmPaidBooking, notifyTeamNewBooking, notifyGuestBookingConfirmed } from '@/lib/booking/payment-confirmed';
import { inngest } from '@/lib/inngest/client';

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
        const { booking, alreadyPaid } = await confirmPaidBooking(supabase, {
            reference,
            bookingId: metadata?.booking_id || null,
            amountKobo: amount,
            raw: event.data,
        });

        if (!alreadyPaid) {
            const [team, guest] = await Promise.all([
                notifyTeamNewBooking(supabase, booking),
                notifyGuestBookingConfirmed(booking),
            ]);
            console.log(`[Paystack] ${reference} confirmed · team email: ${team.sent ? team.to?.join(',') : team.reason} · guest email: ${guest.sent ? 'sent' : guest.reason}`);

            // WhatsApp confirmations still run through Inngest when it is configured
            try {
                await inngest.send({
                    name: 'payment/confirmed',
                    data: { reference, amount, metadata, paystackData: event.data },
                });
            } catch (e: any) {
                console.warn('[Paystack] Inngest not available (non-blocking):', e?.message);
            }
        } else {
            console.log(`[Paystack] ${reference} already confirmed — nothing to do`);
        }
    } catch (error: any) {
        // Log loudly but acknowledge, so Paystack does not retry forever;
        // /api/bookings/verify will still confirm when the guest lands back.
        console.error('Paystack webhook processing error:', error?.message || error);
    }

    return NextResponse.json({ received: true });
}
