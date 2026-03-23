import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createSessionClient } from '@/lib/supabase/server';
import { initializePayment, generateReference } from '@/lib/paystack';
import { addDays, format } from 'date-fns';
import { Resend } from 'resend';
import { z } from 'zod';

const bookingSchema = z.object({
    roomId: z.string().uuid(),
    propertyId: z.string().uuid(),
    guestName: z.string().trim().min(2).max(100),
    guestEmail: z.string().trim().email().optional().nullable().or(z.literal('')),
    guestPhone: z.string().trim().max(20).optional().nullable().or(z.literal('')),
    whatsappUserPhone: z.string().trim().optional().nullable().or(z.literal('')),
    checkIn: z.string(),
    checkOut: z.string(),
    userId: z.string().uuid().optional().nullable(),
    isManualBooking: z.boolean().optional(),
    bookingSource: z.string().optional().nullable(),
    bookingType: z.string().optional().nullable(),
    notes: z.string().max(1000).optional().nullable()
});

const rateLimitStore = new Map<string, { count: number, resetAt: number }>();

const resend = new Resend(process.env.RESEND_API_KEY);

// Create a new booking
export async function POST(request: NextRequest) {
    // Basic IP Rate Limiting (Abuse Prevention)
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const now = Date.now();
    const rateRecord = rateLimitStore.get(ip);
    
    if (rateRecord && rateRecord.resetAt > now) {
        if (rateRecord.count >= 10) { // Max 10 attempts per 15 minutes
            return NextResponse.json({ error: 'Too many booking attempts. Please try again later.' }, { status: 429 });
        }
        rateRecord.count++;
    } else {
        rateLimitStore.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    }

    try {
        const rawBody = await request.json();
        
        // Input Validation & Sanitization
        const validation = bookingSchema.safeParse(rawBody);
        if (!validation.success) {
            return NextResponse.json({ error: 'Invalid input data', details: validation.error.format() }, { status: 400 });
        }
        
        const body = validation.data;
        const { roomId, propertyId, guestName, guestEmail, guestPhone, whatsappUserPhone, checkIn, checkOut, userId, isManualBooking, bookingSource } = body;

        // guestEmail is required for guest bookings, but optional for manual (uses auth email)
        if (!isManualBooking && !guestEmail) {
            return NextResponse.json(
                { error: 'Missing guest email' },
                { status: 400 }
            );
        }

        const supabase = createAdminClient(); // Explicit Admin client for DB ops to enable safe guest inserts
        const sessionSupabase = await createSessionClient(); // Session client for Auth

        // Check authentication for manual booking
        let isInternalBooking = false;
        let user: any = null;

        if (isManualBooking) {
            // Use sessionSupabase to get the logged-in user
            const { data: { user: sessionUser }, error: userError } = await sessionSupabase.auth.getUser();
            user = sessionUser;

            if (userError || !user) {
                console.error("Manual Booking Auth Error: User not found", userError);
                return NextResponse.json({ error: 'Unauthorized: User not logged in' }, { status: 401 });
            }

            console.log(`Manual Booking Request by User: ${user.id} (${user.email})`);

            if (user && user.email) {
                // Verify if user is caretaker (id matches auth id)
                // Use Admin `supabase` for DB checks to bypass RLS if needed
                const { data: caretaker, error: caretakerError } = await supabase
                    .from('caretakers')
                    .select('id')
                    .eq('id', user.id)
                    .single();

                if (caretaker) console.log("User verified as Caretaker:", caretaker.id);
                if (caretakerError && caretakerError.code !== 'PGRST116') console.error("Caretaker check error:", caretakerError);

                // Check owner by email (since owners table doesn't have user_id in schema)
                const { data: owner, error: ownerError } = await supabase
                    .from('owners')
                    .select('id')
                    .eq('email', user.email)
                    .single();

                if (owner) console.log("User verified as Owner:", owner.id);
                if (ownerError && ownerError.code !== 'PGRST116') console.error("Owner check error:", ownerError);

                if (caretaker || owner) {
                    isInternalBooking = true;
                } else {
                    console.warn(`Unauthorized Manual Booking Attempt: ${user.email} is neither Caretaker nor Owner.`);
                    return NextResponse.json({
                        error: `Unauthorized: User ${user.email} is not registered as a Caretaker or Owner.`
                    }, { status: 403 });
                }
            } else {
                return NextResponse.json({ error: 'Unauthorized: No email found for user' }, { status: 401 });
            }
        }

        // 1. Generate date array (check-in to day before check-out)
        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        const dates: string[] = [];
        let current = new Date(checkInDate);
        while (current < checkOutDate) {
            dates.push(format(current, 'yyyy-MM-dd'));
            current = addDays(current, 1);
        }

        // Quick pre-check: fast-fail if dates are obviously unavailable
        // (This is just an optimization — the real protection is below)
        const { data: unavailable } = await supabase
            .from('availability')
            .select('date')
            .eq('room_id', roomId)
            .in('date', dates)
            .not('status', 'eq', 'available');

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

        // Validate minimum stay
        if (property.minimum_stay && nightCount < property.minimum_stay) {
            return NextResponse.json(
                { error: `Minimum stay is ${property.minimum_stay} nights. You selected ${nightCount}.` },
                { status: 400 }
            );
        }

        // Handle Maintenance vs Guest Booking type
        const bookingType = body.bookingType || 'guest';

        let totalAmount = pricePerNight * nightCount;

        // Apply discount from property's discount_rules
        if (property.discount_rules && Array.isArray(property.discount_rules) && bookingType !== 'maintenance') {
            const sorted = [...property.discount_rules].sort((a: any, b: any) => b.min_nights - a.min_nights);
            const bestRule = sorted.find((r: any) => nightCount >= r.min_nights);
            if (bestRule) {
                if (bestRule.discount_percent) {
                    totalAmount = Math.round(totalAmount * (1 - bestRule.discount_percent / 100));
                } else if (bestRule.discount_amount) {
                    totalAmount = Math.max(0, totalAmount - bestRule.discount_amount);
                }
            }
        }

        if (bookingType === 'maintenance') {
            totalAmount = 0;
        }

        // Get owner's Paystack subaccount from the database
        const subaccount = (owner as any)?.paystack_subaccount_code;
        if (!isInternalBooking && !subaccount) {
            console.error(`[Booking API] Owner has no Paystack subaccount for property ${propertyId}`);
            return NextResponse.json(
                { error: 'Property not configured for online payments. Please contact support.' },
                { status: 400 }
            );
        }

        // 3. Create Booking
        const initialStatus = isInternalBooking ? 'confirmed' : 'pending';
        const reference = generateReference();
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 mins

        // Determine booking source for CRM tracking
        let source = bookingSource || 'website';
        if (!bookingSource) {
            if (isInternalBooking && bookingType === 'maintenance') source = 'maintenance';
            else if (isInternalBooking) source = 'caretaker';
            else if (whatsappUserPhone) source = 'whatsapp';
        }

        const bookingNotes = body.notes || (isInternalBooking
            ? (bookingType === 'maintenance' ? 'Blocked for Maintenance' : 'Manual Booking (Caretaker/Agent)')
            : null);

        // If it's a manual booking from an operator, we WANT to use the guestEmail they entered
        // Only fallback to user.email if it's a maintenance block or caretaker booking themselves
        const finalGuestEmail = guestEmail || (isInternalBooking && user?.email ? user.email : null);

        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .insert({
                room_id: roomId,
                property_id: propertyId,
                guest_name: guestName,
                guest_email: finalGuestEmail,
                guest_phone: guestPhone || null,
                user_id: user?.id || null,
                check_in: checkIn,
                check_out: checkOut,
                nights: nightCount,
                price_per_night: pricePerNight,
                total_amount: totalAmount,
                status: initialStatus,
                paystack_reference: reference,
                expires_at: initialStatus === 'pending' ? expiresAt.toISOString() : null,
                notes: bookingNotes,
                booking_source: source
            })
            .select()
            .single();

        if (bookingError) throw new Error(bookingError.message);

        // 4. Atomic date reservation with race-condition protection
        // Strategy: INSERT availability rows. If a row already exists for a date
        // with a non-available status, upsert will overwrite — so we verify after.
        let availabilityStatus = isInternalBooking ? 'booked' : 'held';
        if (isInternalBooking && bookingType === 'maintenance') {
            availabilityStatus = 'booked';
        }

        const availabilityRows = dates.map(date => ({
            room_id: roomId,
            date,
            status: availabilityStatus,
            booking_id: booking.id,
        }));

        await supabase
            .from('availability')
            .upsert(availabilityRows, { onConflict: 'room_id,date' });

        // 5. VERIFY: Check that ALL dates now belong to OUR booking
        // This catches the race condition: if another booking snuck in
        // between our check and our upsert, some dates will have a
        // different booking_id
        const { data: verifyRows } = await supabase
            .from('availability')
            .select('date, booking_id, status')
            .eq('room_id', roomId)
            .in('date', dates);

        const conflictDates = (verifyRows || []).filter(
            row => row.booking_id !== booking.id && row.status !== 'available'
        );

        if (conflictDates.length > 0) {
            // RACE LOST: Another booking claimed some dates first
            // Roll back: delete our availability rows and cancel booking
            console.warn(`[Race Condition] Booking ${booking.id} lost race for dates: ${conflictDates.map(d => d.date).join(', ')}`);

            await supabase
                .from('availability')
                .delete()
                .eq('room_id', roomId)
                .eq('booking_id', booking.id);

            await supabase
                .from('bookings')
                .update({ status: 'cancelled', notes: 'Auto-cancelled: dates taken by another booking' })
                .eq('id', booking.id);

            return NextResponse.json(
                { error: 'Sorry, those dates were just booked by someone else. Please try different dates.' },
                { status: 409 }
            );
        }

        // 6. Initialize Paystack (ONLY if NOT internal and NOT operator)
        if (!isInternalBooking && bookingSource !== 'operator') {
            try {
                // Secure the origin against Host Header Injection
                let origin = request.nextUrl.origin;
                const allowedOrigins = ['https://9jarooms.com', 'https://www.9jarooms.com', 'http://localhost:3000'];
                if (!allowedOrigins.includes(origin) && !origin.endsWith('.vercel.app')) {
                    origin = process.env.NEXT_PUBLIC_APP_URL || 'https://9jarooms.com';
                }

                const payment = await initializePayment({
                    email: finalGuestEmail ? finalGuestEmail.trim() : 'booking@9jarooms.com',
                    amount: totalAmount * 100, // kobo
                    reference: reference,
                    subaccount: subaccount,
                    callbackUrl: `${origin}/booking/confirm`, // Verifies payment
                    metadata: {
                        booking_id: booking.id,
                        property_name: property.name,
                        room_name: room.name,
                        guest_name: guestName,
                        whatsapp_user_phone: whatsappUserPhone, // Pass sender phone for confirmation
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

            } catch (payError: any) {
                console.error('Paystack Init Error:', payError);
                return NextResponse.json(
                    { error: payError?.message || 'Payment initialization failed with Paystack. Please try again or contact support.' },
                    { status: 400 }
                );
            }
        } else if (bookingSource === 'operator') {
            // Operator dashboard manual booking (Pending payment)
            return NextResponse.json({
                success: true,
                bookingId: booking.id,
                message: 'Booking created successfully. Pending manual payment confirmation.',
            });
        } else {
            // Return success for internal booking immediately
            return NextResponse.json({
                success: true,
                bookingId: booking.id,
                message: 'Booking confirmed successfully (Manual Block)',
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
