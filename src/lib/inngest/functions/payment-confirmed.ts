import { inngest } from '../client';
import { createAdminClient } from '@/lib/supabase/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Triggered by Paystack webhook when payment is confirmed
export const paymentConfirmed = (inngest as any).createFunction(
    { 
        id: 'payment-confirmed', 
        name: 'Payment Confirmed',
        triggers: { event: 'payment/confirmed' },
    },
    async ({ event, step }: any) => {
        const { reference, amount, paystackData } = event.data;

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

        // Step 2: Log transaction
        await step.run('log-transaction', async () => {
            await supabase.from('transactions').insert({
                paystack_reference: reference,
                paystack_event: 'charge.success',
                amount: amount / 100, // Convert from kobo to Naira
                status: 'success',
                booking_id: booking.id,
                raw_payload: paystackData,
            });
        });

        // Step 3: Mark booking as paid
        await step.run('confirm-booking', async () => {
            const { error } = await supabase
                .from('bookings')
                .update({ status: 'paid', expires_at: null })
                .eq('id', booking.id);

            if (error) throw new Error(`Failed to confirm booking: ${error.message}`);
        });

        // Step 4: Change held dates to booked
        await step.run('block-dates', async () => {
            const { error } = await supabase
                .from('availability')
                .update({ status: 'booked' })
                .eq('booking_id', booking.id)
                .eq('status', 'held');

            if (error) throw new Error(`Failed to block dates: ${error.message}`);
        });

        // Step 5: Send Confirmation Email to Guest (via Resend)
        await step.run('send-email-guest', async () => {
            const property = (booking as any).property;
            const checkInDate = new Date(booking.check_in).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            const checkOutDate = new Date(booking.check_out).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

            const { error } = await resend.emails.send({
                from: '9jaRooms <team@9jarooms.com>',
                to: [booking.guest_email],
                subject: 'Booking Confirmed - 9jaRooms',
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #374151;">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <img src="https://www.9jarooms.com/WHITE.jpg" alt="9jaRooms" style="height: 60px; width: auto;" />
                        </div>
                        
                        <h1 style="color: #16a34a; text-align: center; margin-bottom: 24px;">Booking Confirmed!</h1>
                        
                        <p style="font-size: 16px;">Hi <strong>${booking.guest_name}</strong>,</p>
                        <p style="font-size: 16px;">We are excited to host you at <strong>${property.name}</strong>.</p>
                        
                        <div style="background-color: #f3f4f6; padding: 24px; border-radius: 12px; margin: 24px 0;">
                            <h3 style="margin-top: 0; color: #111827;">Booking Details</h3>
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 8px 0; color: #6b7280;">Reference</td>
                                    <td style="padding: 8px 0; font-weight: bold; text-align: right;">${booking.paystack_reference}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #6b7280;">Amount Paid</td>
                                    <td style="padding: 8px 0; font-weight: bold; text-align: right;">₦${(booking.total_amount || 0).toLocaleString()}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #6b7280;">Check-in</td>
                                    <td style="padding: 8px 0; font-weight: bold; text-align: right;">${checkInDate} (${property.check_in_time})</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #6b7280;">Check-out</td>
                                    <td style="padding: 8px 0; font-weight: bold; text-align: right;">${checkOutDate} (${property.check_out_time})</td>
                                </tr>
                            </table>
                        </div>

                        <div style="margin-bottom: 24px;">
                            <h3 style="color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">📍 Location</h3>
                            <p style="margin-top: 8px; line-height: 1.5; font-size: 15px;">
                                <strong>${property.name}</strong><br/>
                                ${property.address}<br/>
                                ${property.city}, ${property.state}
                            </p>
                        </div>

                        ${property.check_in_instructions ? `
                        <div style="margin-bottom: 24px;">
                            <h3 style="color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">🔑 Check-in Instructions</h3>
                            <div style="background: #fff; border: 1px solid #e5e7eb; padding: 16px; border-radius: 8px; font-size: 14px; margin-top: 8px; line-height: 1.6; white-space: pre-line;">
                                ${property.check_in_instructions}
                            </div>
                        </div>
                        ` : ''}

                        ${property.house_rules ? `
                        <div style="margin-bottom: 24px;">
                            <h3 style="color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">🏠 House Rules</h3>
                            <div style="background: #fff; border: 1px solid #e5e7eb; padding: 16px; border-radius: 8px; font-size: 14px; margin-top: 8px; line-height: 1.6; white-space: pre-line;">
                                ${property.house_rules}
                            </div>
                        </div>
                        ` : ''}
                        
                        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; display: flex; align-items: center; gap: 16px;">
                            <img src="${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/public-assets/email-profile.png" alt="Host" style="width: 56px; height: 56px; border-radius: 50%; object-fit: cover; border: 2px solid #e5e7eb;" />
                            <div style="font-size: 14px; color: #4b5563;">
                                <p style="margin: 0; font-weight: 600; color: #111827; font-size: 16px;">9jaRooms Host</p>
                                <p style="margin: 0;">Need help? Reply to this email.</p>
                            </div>
                        </div>
                        
                        <div style="text-align: center; margin-top: 32px; font-size: 12px; color: #9ca3af;">
                            <p>&copy; ${new Date().getFullYear()} 9jaRooms. All rights reserved.</p>
                        </div>
                    </div>
                `
            });

            if (error) {
                console.error('Failed to send guest email:', error);
                return { success: false, error: error.message }; // Do not throw to keep workflow progressing
            }
            return { success: true };
        });

        // Step 6: Send Notification to Caretaker (via Resend)
        await step.run('send-email-caretaker', async () => {
            const property = (booking as any).property;
            // Fallback to admin email if no caretaker? 
            // Fetch caretaker email if exists
            let caretakerEmail = 'asofficial001@yahoo.com'; // Default admin/owner email
            if (property.caretaker_id) {
                const { data: caretaker } = await supabase
                    .from('caretakers')
                    .select('email')
                    .eq('id', property.caretaker_id)
                    .single();
                if (caretaker && caretaker.email) {
                    caretakerEmail = caretaker.email;
                }
            }

            const checkInDate = new Date(booking.check_in).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            const checkOutDate = new Date(booking.check_out).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

            const { error } = await resend.emails.send({
                from: '9jaRooms <team@9jarooms.com>',
                to: [caretakerEmail],
                subject: `New Booking: ${property.name}`,
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
                        <h2 style="color: #16a34a; margin-bottom: 24px;">New Booking Received</h2>
                        
                        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
                            <h3 style="margin-top: 0; margin-bottom: 16px;">Property Details</h3>
                            <p style="margin: 4px 0;"><strong>Property:</strong> ${property.name}</p>
                            <p style="margin: 4px 0;"><strong>Address:</strong> ${property.address}, ${property.area}</p>
                        </div>

                        <div style="border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
                            <h3 style="margin-top: 0; margin-bottom: 16px;">Guest Information</h3>
                            <p style="margin: 8px 0;"><strong>Name:</strong> ${booking.guest_name}</p>
                            <p style="margin: 8px 0;"><strong>Email:</strong> ${booking.guest_email}</p>
                            <p style="margin: 8px 0;"><strong>Phone:</strong> ${booking.guest_phone || 'N/A'}</p>
                        </div>

                        <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; border: 1px solid #a7f3d0;">
                            <h3 style="margin-top: 0; margin-bottom: 16px; color: #166534;">Booking Schedule</h3>
                            <p style="margin: 8px 0;"><strong>Check-in:</strong> ${checkInDate} (${property.check_in_time})</p>
                            <p style="margin: 8px 0;"><strong>Check-out:</strong> ${checkOutDate} (${property.check_out_time})</p>
                            <p style="margin: 8px 0;"><strong>Nights:</strong> ${booking.nights}</p>
                            <p style="margin: 8px 0;"><strong>Total Amount:</strong> ₦${(booking.total_amount || 0).toLocaleString()}</p>
                        </div>
                        
                        <p style="color: #6b7280; font-size: 13px; margin-top: 30px;">
                            Reference: ${booking.paystack_reference}
                        </p>
                    </div>
                `
            });

            if (error) {
                console.error('Failed to send caretaker email', error);
                return { success: false, error };
            }
            return { success: true };
        });

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
