import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { initializePayment, generateReference } from '@/lib/paystack';
import { addDays, format } from 'date-fns';

// Create a new booking
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { roomId, propertyId, guestName, guestEmail, guestPhone, checkIn, checkOut, userId } = body;

        // Validate required fields
        if (!roomId || !propertyId || !guestName || !guestEmail || !checkIn || !checkOut) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const supabase = createServerClient();

        // 1. Check availability
        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        const dates: string[] = [];
        let current = new Date(checkInDate);
        while (current < checkOutDate) {
            dates.push(format(current, 'yyyy-MM-dd'));
            current = addDays(current, 1);
        }

        const { data: unavailable } = await supabase
            .from('availability')
            .select('date')
            .eq('room_id', roomId)
            .in('date', dates)
            .neq('status', 'available');

        if (unavailable && unavailable.length > 0) {
            return NextResponse.json(
                { error: `Room not available for selected dates` },
                { status: 409 }
            );
        }

        // 2. Get details (price, owner)
        const { data: room } = await supabase
            .from('rooms')
            .select('*, property:properties(*, owner:owners(*))')
            .eq('id', roomId)
            .single();

        if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

        const property = (room as any).property;
        const owner = property?.owner;
        const pricePerNight = room.price_per_night || property.price_per_night;
        const nightCount = dates.length;
        const totalAmount = pricePerNight * nightCount;

        // TEMPORARY: Hardcoded subaccount for testing as requested
        const subaccount = 'ACCT_n6403gnzt3xbe5q';
        // const subaccount = owner?.paystack_subaccount_code;

        // if (!owner?.paystack_subaccount_code) {
        //    return NextResponse.json({ error: 'Property owner not configured for payments' }, { status: 500 });
        // }

        // 3. Create Booking (Pending)
        const reference = generateReference();
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 mins

        const { data: booking, error: bookingError } = await supabase
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
                nights: nightCount,
                price_per_night: pricePerNight,
                total_amount: totalAmount,
                status: 'pending',
                paystack_reference: reference,
                expires_at: expiresAt.toISOString(),
            })
            .select()
            .single();

        if (bookingError) throw new Error(bookingError.message);

        // 4. Hold Dates
        const availabilityRows = dates.map(date => ({
            room_id: roomId,
            date,
            status: 'held',
            booking_id: booking.id,
        }));

        await supabase
            .from('availability')
            .upsert(availabilityRows, { onConflict: 'room_id,date' });

        // 5. Initialize Paystack
        try {
            const payment = await initializePayment({
                email: guestEmail,
                amount: totalAmount * 100, // kobo
                reference: reference,
                subaccount: subaccount,
                callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/booking/confirm`, // Verifies payment
                metadata: {
                    booking_id: booking.id,
                    property_name: property.name,
                    room_name: room.name,
                    guest_name: guestName,
                },
            });

            // Update booking with Paystack URL
            await supabase
                .from('bookings')
                .update({
                    paystack_access_code: payment.data.access_code,
                    paystack_authorization_url: payment.data.authorization_url,
                })
                .eq('id', booking.id);

            return NextResponse.json({
                success: true,
                bookingId: booking.id,
                paystackUrl: payment.data.authorization_url,
                reference: reference,
            });

        } catch (payError) {
            console.error('Paystack Init Error:', payError);
            // Don't fail the whole request, but return error so frontend handles it (or retry)
            // But we already created booking.
            return NextResponse.json({
                success: true,
                bookingId: booking.id,
                warning: 'Payment initialization failed. Please retry from booking page.',
            });
        }

    } catch (error) {
        console.error('Booking Error:', error);
        return NextResponse.json(
            { error: 'Failed to create booking' },
            { status: 500 }
        );
    }
}
