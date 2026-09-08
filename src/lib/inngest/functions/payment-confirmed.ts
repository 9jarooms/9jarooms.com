import { inngest } from '../client';
import { createAdminClient } from '@/lib/supabase/server';

// Triggered by Paystack webhook when payment is confirmed
export const paymentConfirmed = (inngest as any).createFunction(
    { 
        id: 'payment-confirmed', 
        name: 'Payment Confirmed',
        triggers: { event: 'payment/confirmed' },
    },
    async ({ event, step }: any) => {
        const { reference } = event.data;

        const supabase = createAdminClient();

        // Step 1: Find the booking by Paystack reference or explicit booking ID
        const booking = await step.run('find-booking', async () => {
            let query = supabase
                .from('bookings')
                .select('*, room:rooms(*), property:properties(*, owner:owners(*))');

            // Support manual confirmation which passes the booking_id in metadata
            if (event.data.metadata?.booking_id) {
                query = query.eq('id', event.data.metadata.booking_id);
            } else {
                query = query.eq('paystack_reference', reference);
            }

            const { data, error } = await query.single();

            if (error || !data) {
                throw new Error(`Booking not found for reference/ID: ${reference} / ${event.data.metadata?.booking_id}`);
            }

            // If already paid, we still want to ensure emails are sent (idempotency), 
            // but we can skip the "mark as paid" logic if we want, or just let it update again.
            // However, throwing an error here stops the function and prevents emails.
            // So we remove the throw.
            if (data.status === 'paid') {
                console.log('Booking already marked as paid, proceeding to ensure emails are sent.');
            }

            return data;
        });

        // Steps 2-6 (transaction log, mark paid, block dates, guest + team
        // emails) now run synchronously in src/lib/booking/payment-confirmed.ts
        // from the Paystack webhook and /api/bookings/verify. This function
        // only handles the WhatsApp messages.

        // Step 7: Send WhatsApp confirmation (via Meta Cloud API)
        await step.run('send-whatsapp-confirmation', async () => {
            // Prioritize the WhatsApp user who made the booking (from metadata), otherwise guest phone
            const targetPhone = event.data.metadata?.whatsapp_user_phone || booking.guest_phone;

            if (!targetPhone) return { sent: false, reason: 'No phone number' };

            try {
                const { WhatsAppClient } = await import('@/lib/whatsapp/client');
                const wa = new WhatsAppClient();

                let phone = targetPhone.replace(/[\s\-\(\)\+]/g, '');
                if (phone.startsWith('0')) phone = '234' + phone.slice(1);
                else if (phone.length === 10 && !phone.startsWith('234')) phone = '234' + phone;

                console.log(`[WhatsApp Confirm] Sending to: ${phone} (original: ${targetPhone})`);

                const property = (booking as any).property;
                const checkInDate = new Date(booking.check_in).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                const checkOutDate = new Date(booking.check_out).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

                const components = [
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: booking.guest_name },
                            { type: 'text', text: property.name },
                            { type: 'text', text: property.address },
                            { type: 'text', text: `${checkInDate} (${property.check_in_time})` },
                            { type: 'text', text: `${checkOutDate} (${property.check_out_time})` }
                        ]
                    }
                ];

                await wa.sendTemplate(phone, 'booking_confirmed', 'en_US', components);
                return { sent: true };
            } catch (error) {
                console.error('Failed to send WhatsApp confirmation:', error);
                return { sent: false, error: String(error) };
            }
        });

        // Step 8: Send WhatsApp notification to Caretaker (via Meta Cloud API)
        await step.run('send-whatsapp-caretaker', async () => {
            const property = (booking as any).property;
            if (!property.caretaker_id) return { sent: false, reason: 'No caretaker assigned' };

            const { data: caretaker } = await supabase
                .from('caretakers')
                .select('phone, name')
                .eq('id', property.caretaker_id)
                .single();

            if (!caretaker || !caretaker.phone) return { sent: false, reason: 'No caretaker phone' };

            try {
                const { WhatsAppClient } = await import('@/lib/whatsapp/client');
                const wa = new WhatsAppClient();

                let phone = caretaker.phone.replace(/[\s\-\(\)\+]/g, '');
                if (phone.startsWith('0')) phone = '234' + phone.slice(1);
                else if (phone.length === 10 && !phone.startsWith('234')) phone = '234' + phone;

                const checkInDate = new Date(booking.check_in).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                const checkOutDate = new Date(booking.check_out).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

                const components = [
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: caretaker.name || 'Caretaker' },
                            { type: 'text', text: property.name },
                            { type: 'text', text: booking.guest_name },
                            { type: 'text', text: booking.guest_phone || 'N/A' },
                            { type: 'text', text: checkInDate },
                            { type: 'text', text: checkOutDate },
                            { type: 'text', text: String(booking.guests || 1) }
                        ]
                    }
                ];

                await wa.sendTemplate(phone, 'caretaker_new_booking_alert', 'en', components);
                return { sent: true };
            } catch (error) {
                console.error('Failed to send Caretaker WhatsApp confirmation:', error);
                return { sent: false, error: String(error) };
            }
        });

        return {
            bookingId: booking.id,
            status: 'success'
        };
    }
);
