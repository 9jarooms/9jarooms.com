import { inngest } from '../client';
import { createServerClient } from '@/lib/supabase/server';
import { initializePayment, generateReference } from '@/lib/paystack';
import { addDays, differenceInCalendarDays, format } from 'date-fns';

// Triggered when a guest submits a booking request
export const bookingCreated = inngest.createFunction(
    { id: 'booking-created', name: 'Booking Created' },
    { event: 'booking/created' },
    async ({ event, step }) => {
        const { roomId, propertyId, guestName, guestEmail, guestPhone, checkIn, checkOut, userId } = event.data;

        const supabase = createServerClient();

        // Step 1: Validate room availability
        const availability = await step.run('check-availability', async () => {
            const checkInDate = new Date(checkIn);
            const checkOutDate = new Date(checkOut);
            const dates: string[] = [];

            let current = checkInDate;
            while (current < checkOutDate) {
                dates.push(format(current, 'yyyy-MM-dd'));
                current = addDays(current, 1);
            }

            const { data: unavailable } = await supabase
                .from('availability')
                .select('date, status')
                .eq('room_id', roomId)
                .in('date', dates)
                .neq('status', 'available');

            if (unavailable && unavailable.length > 0) {
                throw new Error(`Room not available for selected dates: ${unavailable.map(a => a.date).join(', ')}`);
            }

            return { dates, nightCount: dates.length };
        });

        // Step 2: Get room and property details + owner sub-account
        const details = await step.run('get-details', async () => {
            const { data: room } = await supabase
                .from('rooms')
                .select('*, property:properties(*, owner:owners(*))')
                .eq('id', roomId)
                .single();

            if (!room) throw new Error('Room not found');

            const property = (room as any).property;
            const owner = property?.owner;
            const pricePerNight = room.price_per_night || property.price_per_night;
            const totalAmount = pricePerNight * availability.nightCount;

            return {
                room,
                property,
                owner,
                pricePerNight,
                totalAmount,
                subaccountCode: owner?.paystack_subaccount_code,
            };
        });

        // Step 3: Create booking record
        const booking = await step.run('create-booking', async () => {
            const reference = generateReference();
            const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

            const { data: newBooking, error } = await supabase
                .from('bookings')
                .insert({
                    room_id: roomId,
                    property_id: propertyId,
                    guest_name: guestName,
                    guest_email: guestEmail,
                    guest_phone: guestPhone || null,
                    user_id: userId || null,
                    check_in: checkIn,
                    check_out: checkOut,
                    nights: availability.nightCount,
                    price_per_night: details.pricePerNight,
                    total_amount: details.totalAmount,
                    status: 'pending',
                    paystack_reference: reference,
                    expires_at: expiresAt.toISOString(),
                })
                .select()
                .single();

            if (error) throw new Error(`Failed to create booking: ${error.message}`);
            return newBooking;
        });

        // Step 4: Hold dates in availability table
        await step.run('hold-dates', async () => {
            const availabilityRows = availability.dates.map(date => ({
                room_id: roomId,
                date,
                status: 'held' as const,
                booking_id: booking.id,
            }));

            const { error } = await supabase
                .from('availability')
                .upsert(availabilityRows, { onConflict: 'room_id,date' });

            if (error) throw new Error(`Failed to hold dates: ${error.message}`);
        });

        // Step 5: Initialize Paystack payment
        const payment = await step.run('initialize-payment', async () => {
            if (!details.subaccountCode) {
                throw new Error('Owner does not have a Paystack sub-account configured');
            }

            const result = await initializePayment({
                email: guestEmail,
                amount: details.totalAmount * 100, // Convert to kobo
                reference: booking.paystack_reference!,
                subaccount: details.subaccountCode,
                metadata: {
                    booking_id: booking.id,
                    property_name: details.property.name,
                    room_name: details.room.name,
                    check_in: checkIn,
                    check_out: checkOut,
                    guest_name: guestName,
                },
                callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/booking/confirm?reference=${booking.paystack_reference}`,
            });

            // Update booking with Paystack details
            await supabase
                .from('bookings')
                .update({
                    paystack_access_code: result.data.access_code,
                    paystack_authorization_url: result.data.authorization_url,
                })
                .eq('id', booking.id);

            return result.data;
        });

        return {
            bookingId: booking.id,
            reference: booking.paystack_reference,
            authorizationUrl: payment.authorization_url,
            accessCode: payment.access_code,
            totalAmount: details.totalAmount,
            expiresAt: booking.expires_at,
        };
    }
);
