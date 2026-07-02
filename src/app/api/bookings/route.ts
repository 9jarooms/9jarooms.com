import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createSessionClient } from '@/lib/supabase/server';
import { initializePayment, generateReference } from '@/lib/paystack';
import { addDays, format } from 'date-fns';
import { Resend } from 'resend';
import { z } from 'zod';
import { computeOptions, type ApartmentLite, type RoomLite } from '@/lib/booking/options';

const bookingSchema = z.object({
    roomId: z.string().uuid().optional(),
    propertyId: z.string().uuid(),
    mode: z.enum(['single', 'two_bed', 'whole']).default('single'),
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

type AdminClient = ReturnType<typeof createAdminClient>;

// Atomically reserve `dates` across all `roomIds` for this booking, then verify
// that every room+date now belongs to us. Returns the conflicting cells (empty
// = we won the race). On conflict the caller rolls back. Shared by the
// single-room and bundle (whole/2-bed) paths so both use one correct impl.
async function reserveAndVerify(
    supabase: AdminClient,
    roomIds: string[],
    dates: string[],
    status: string,
    bookingId: string,
): Promise<{ date: string; booking_id: string | null; status: string }[]> {
    const availabilityRows = roomIds.flatMap(room_id =>
        dates.map(date => ({ room_id, date, status, booking_id: bookingId }))
    );

    await supabase
        .from('availability')
        .upsert(availabilityRows, { onConflict: 'room_id,date' });

    const { data: verifyRows } = await supabase
        .from('availability')
        .select('date, booking_id, status')
        .in('room_id', roomIds)
        .in('date', dates);

    return (verifyRows || []).filter(
        row => row.booking_id !== bookingId && row.status !== 'available'
    );
}

// Undo a reservation: remove every availability row this booking claimed and
// mark the booking cancelled. Mirrors the original single-room rollback.
async function rollbackReservation(
    supabase: AdminClient,
    roomIds: string[],
    bookingId: string,
) {
    await supabase
        .from('availability')
        .delete()
        .in('room_id', roomIds)
        .eq('booking_id', bookingId);

    await supabase
        .from('bookings')
        .update({ status: 'cancelled', notes: 'Auto-cancelled: dates taken by another booking' })
        .eq('id', bookingId);
}

const rateLimitStore = new Map<string, { count: number, resetAt: number }>();

const resend = new Resend(process.env.RESEND_API_KEY);

// Create a new booking
export async function POST(request: NextRequest) {
    const internalSecret = request.headers.get('x-internal-secret');
    const isInternalService = internalSecret === process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Basic IP Rate Limiting (Abuse Prevention) - Only apply to public unauthenticated requests
    if (!isInternalService) {
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
    }

    try {
        const rawBody = await request.json();
        
        // Input Validation & Sanitization
        const validation = bookingSchema.safeParse(rawBody);
        if (!validation.success) {
            return NextResponse.json({ error: 'Invalid input data', details: validation.error.format() }, { status: 400 });
        }
        
        const body = validation.data;
        const { roomId, propertyId, mode, guestName, guestEmail, guestPhone, whatsappUserPhone, checkIn, checkOut, userId, isManualBooking, bookingSource } = body;

        if (mode === 'single' && !roomId) {
            return NextResponse.json({ error: 'roomId is required for single-room bookings' }, { status: 400 });
        }

        const supabase = createAdminClient(); // Explicit Admin client for DB ops to enable safe guest inserts
        const sessionSupabase = await createSessionClient(); // Session client for Auth

        // Fetch user from session for ALL types of bookings to link their ID
        let user: any = null;
        let isInternalBooking = false;

        const { data: { user: sessionUser }, error: userError } = await sessionSupabase.auth.getUser();
        if (!userError && sessionUser) {
            user = sessionUser;
        }

        if (isManualBooking) {
            if (!user) {
                console.error("Manual Booking Auth Error: User not found");
                return NextResponse.json({ error: 'Unauthorized: User not logged in' }, { status: 401 });
            }

            console.log(`Manual Booking Request by User: ${user.id} (${user.email})`);

            if (user && user.email) {
                // Verify if user is caretaker (id matches auth id)
                const { data: caretaker, error: caretakerError } = await supabase
                    .from('caretakers')
                    .select('id')
                    .eq('id', user.id)
                    .single();

                if (caretaker) console.log("User verified as Caretaker:", caretaker.id);
                if (caretakerError && caretakerError.code !== 'PGRST116') console.error("Caretaker check error:", caretakerError);

                // Check owner by email
                const { data: owner, error: ownerError } = await supabase
                    .from('owners')
                    .select('id')
                    .eq('email', user.email)
                    .single();

                if (owner) console.log("User verified as Owner:", owner.id);
                if (ownerError && ownerError.code !== 'PGRST116') console.error("Owner check error:", ownerError);

                // Check operator or admin (via user_roles)
                const { data: operatorRole } = await supabase
                    .from('user_roles')
                    .select('role')
                    .eq('user_id', user.id)
                    .in('role', ['call_operator', 'admin'])
                    .limit(1)
                    .maybeSingle();

                const operator = operatorRole ?? null;
                if (operator) console.log("User verified as Operator:", user.id);

                if (caretaker || owner || operator) {
                    isInternalBooking = true;
                } else {
                    console.warn(`Unauthorized Manual Booking Attempt: ${user.email} is neither Caretaker, Owner, nor Operator.`);
                    return NextResponse.json({
                        error: `Unauthorized: User ${user.email} is not registered as a Caretaker, Owner, or Operator.`
                    }, { status: 403 });
                }
            } else {
                return NextResponse.json({ error: 'Unauthorized: No email found for user' }, { status: 401 });
            }
        }

        // guestEmail is required for guest bookings, unless they are logged in OR manual
        if (!isManualBooking && !guestEmail && (!user || !user.email)) {
            return NextResponse.json(
                { error: 'Missing guest email' },
                { status: 400 }
            );
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

        // ============================================================
        // BUNDLE PATH (whole-apartment / 2-bedroom) — occupies ALL rooms.
        // Single-room bookings skip this entirely and use the path below.
        // ============================================================
        if (mode === 'two_bed' || mode === 'whole') {
            // 1. Load the property bundle config + ALL its active rooms.
            const { data: propertyRow } = await supabase
                .from('properties')
                .select('*, owner:owners(*)')
                .eq('id', propertyId)
                .single();

            if (!propertyRow) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

            const property = propertyRow as {
                id: string;
                name: string;
                is_apartment: boolean | null;
                whole_apartment_price: number | null;
                two_bed_price: number | null;
                price_per_night: number | null;
                minimum_stay: number | null;
                owner?: { paystack_subaccount_code?: string | null } | null;
            };

            const { data: roomRows } = await supabase
                .from('rooms')
                .select('id, name, room_type, price_per_night')
                .eq('property_id', propertyId)
                .eq('is_active', true);

            const rooms = (roomRows || []) as RoomLite[];

            const bundlePrice = mode === 'whole'
                ? property.whole_apartment_price
                : property.two_bed_price;

            if (!property.is_apartment || bundlePrice == null) {
                return NextResponse.json(
                    { error: 'This property is not available as an apartment bundle.' },
                    { status: 400 }
                );
            }

            // 2. Build the unavailable Set using the same expired-hold rule the
            //    apartment availability map uses (held + future expiry, or
            //    booked/cleaning/maintenance = unavailable).
            const roomIds = rooms.map(r => r.id);
            const { data: rawAvailability } = await supabase
                .from('availability')
                .select('room_id, date, status, booking:bookings(expires_at)')
                .in('room_id', roomIds)
                .in('date', dates);

            const now = new Date();
            const unavailableSet = new Set<string>();
            for (const slot of (rawAvailability || []) as unknown as Array<{
                room_id: string;
                date: string;
                status: string;
                booking?: { expires_at: string | null } | null;
            }>) {
                let blocked = false;
                if (slot.status === 'booked' || slot.status === 'cleaning' || slot.status === 'maintenance') {
                    blocked = true;
                } else if (slot.status === 'held') {
                    const expiresAt = slot.booking?.expires_at ? new Date(slot.booking.expires_at) : null;
                    if (!expiresAt || expiresAt >= now) blocked = true;
                }
                if (blocked) unavailableSet.add(`${slot.room_id}|${slot.date}`);
            }

            // 3. Run the booking engine and pick the requested bundle option.
            const apt: ApartmentLite = {
                id: property.id,
                is_apartment: !!property.is_apartment,
                property_price: property.price_per_night ?? 0,
                whole_apartment_price: property.whole_apartment_price ?? null,
                two_bed_price: property.two_bed_price ?? null,
                rooms,
            };
            const option = computeOptions(apt, unavailableSet, checkIn, checkOut, dates)
                .find(o => o.type === mode);

            if (!option || !option.available) {
                return NextResponse.json(
                    { error: 'Those dates are no longer available for this option.' },
                    { status: 409 }
                );
            }

            const consumedRoomIds = [...option.roomIds, ...option.lockedRoomIds];
            const nightCount = dates.length;

            // Validate minimum stay (same rule as single path).
            if (property.minimum_stay && nightCount < property.minimum_stay) {
                return NextResponse.json(
                    { error: `Minimum stay is ${property.minimum_stay} nights. You selected ${nightCount}.` },
                    { status: 400 }
                );
            }

            const subaccount = property.owner?.paystack_subaccount_code;
            if (!isInternalBooking && !subaccount) {
                console.error(`[Booking API] Owner has no Paystack subaccount for property ${propertyId}`);
                return NextResponse.json(
                    { error: 'Property not configured for online payments. Please contact support.' },
                    { status: 400 }
                );
            }

            // Bundles use FIXED bundle pricing — no discount_rules applied.
            const totalAmount = option.price;
            const pricePerNight = option.pricePerNight;
            const bookingType = body.bookingType || 'guest';

            // 4. Create the booking (representative room = first sold room).
            const initialStatus = isInternalBooking ? 'confirmed' : 'pending';
            const reference = generateReference();
            const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

            let source = bookingSource || 'website';
            if (!bookingSource) {
                if (isInternalBooking && bookingType === 'maintenance') source = 'maintenance';
                else if (isInternalBooking) source = 'caretaker';
                else if (whatsappUserPhone) source = 'whatsapp';
            }

            const bookingNotes = body.notes || (isInternalBooking
                ? (bookingType === 'maintenance' ? 'Blocked for Maintenance' : 'Manual Booking (Caretaker/Agent)')
                : null);

            const finalGuestEmail = guestEmail || (user?.email ? user.email : null);

            const { data: booking, error: bookingError } = await supabase
                .from('bookings')
                .insert({
                    room_id: option.roomIds[0],
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
                    booking_mode: mode,
                    paystack_reference: reference,
                    expires_at: initialStatus === 'pending' ? expiresAt.toISOString() : null,
                    notes: bookingNotes,
                    booking_source: source
                })
                .select()
                .single();

            if (bookingError) throw new Error(bookingError.message);

            // 5. Atomic reservation across ALL consumed rooms (sold + locked).
            let availabilityStatus = isInternalBooking ? 'booked' : 'held';
            if (isInternalBooking && bookingType === 'maintenance') {
                availabilityStatus = 'booked';
            }

            const conflictDates = await reserveAndVerify(
                supabase, consumedRoomIds, dates, availabilityStatus, booking.id
            );

            if (conflictDates.length > 0) {
                console.warn(`[Race Condition] Bundle booking ${booking.id} lost race for dates: ${conflictDates.map(d => d.date).join(', ')}`);
                await rollbackReservation(supabase, consumedRoomIds, booking.id);
                return NextResponse.json(
                    { error: 'Sorry, those dates were just booked by someone else. Please try different dates.' },
                    { status: 409 }
                );
            }

            // 6. Record the full room set: sold rooms carry their own price,
            //    locked rooms (the held-empty room of a 2-bed) carry price 0.
            const priceById = new Map(rooms.map(r => [r.id, r.price_per_night]));
            const soldSet = new Set(option.roomIds);
            const bookingRoomRows = consumedRoomIds.map(room_id => ({
                booking_id: booking.id,
                room_id,
                price_per_night: soldSet.has(room_id) ? (priceById.get(room_id) ?? 0) : 0,
                is_locked: !soldSet.has(room_id),
            }));
            await supabase.from('booking_rooms').insert(bookingRoomRows);

            // 7. Payment — same branch logic as the single path, bundle total.
            if (!isInternalBooking || bookingSource === 'operator') {
                try {
                    let origin = request.nextUrl.origin;
                    const allowedOrigins = ['https://9jarooms.com', 'https://www.9jarooms.com', 'http://localhost:3000'];
                    if (!allowedOrigins.includes(origin) && !origin.endsWith('.vercel.app')) {
                        origin = process.env.NEXT_PUBLIC_APP_URL || 'https://9jarooms.com';
                    }

                    const payment = await initializePayment({
                        email: finalGuestEmail ? finalGuestEmail.trim() : 'booking@9jarooms.com',
                        amount: totalAmount * 100,
                        reference: reference,
                        subaccount: subaccount as string,
                        callbackUrl: `${origin}/booking/confirm`,
                        metadata: {
                            booking_id: booking.id,
                            property_name: property.name,
                            room_name: option.label,
                            guest_name: guestName,
                            whatsapp_user_phone: whatsappUserPhone,
                        },
                    });

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
                    const message = payError instanceof Error ? payError.message : null;
                    return NextResponse.json(
                        { error: message || 'Payment initialization failed with Paystack. Please try again or contact support.' },
                        { status: 400 }
                    );
                }
            } else {
                return NextResponse.json({
                    success: true,
                    bookingId: booking.id,
                    message: 'Booking confirmed successfully (Manual Block)',
                });
            }
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
        // For standard guests, use the provided guestEmail, or fallback to their session user email
        const finalGuestEmail = guestEmail || (user?.email ? user.email : null);

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
                booking_mode: 'single',
                paystack_reference: reference,
                expires_at: initialStatus === 'pending' ? expiresAt.toISOString() : null,
                notes: bookingNotes,
                booking_source: source
            })
            .select()
            .single();

        if (bookingError) throw new Error(bookingError.message);

        // Record the single room in booking_rooms (mirrors the bundle path).
        await supabase.from('booking_rooms').insert({
            booking_id: booking.id,
            room_id: roomId,
            price_per_night: pricePerNight,
            is_locked: false,
        });

        // 4. Atomic date reservation with race-condition protection
        // Strategy: INSERT availability rows. If a row already exists for a date
        // with a non-available status, upsert will overwrite — so we verify after.
        let availabilityStatus = isInternalBooking ? 'booked' : 'held';
        if (isInternalBooking && bookingType === 'maintenance') {
            availabilityStatus = 'booked';
        }

        // 5. VERIFY: Check that ALL dates now belong to OUR booking
        // This catches the race condition: if another booking snuck in
        // between our check and our upsert, some dates will have a
        // different booking_id
        const conflictDates = await reserveAndVerify(
            supabase, [roomId as string], dates, availabilityStatus, booking.id
        );

        if (conflictDates.length > 0) {
            // RACE LOST: Another booking claimed some dates first
            // Roll back: delete our availability rows and cancel booking
            console.warn(`[Race Condition] Booking ${booking.id} lost race for dates: ${conflictDates.map(d => d.date).join(', ')}`);

            await rollbackReservation(supabase, [roomId as string], booking.id);

            return NextResponse.json(
                { error: 'Sorry, those dates were just booked by someone else. Please try different dates.' },
                { status: 409 }
            );
        }

        // 6. Initialize Paystack for public bookings AND operator bookings (operator sends link to client)
        if (!isInternalBooking || bookingSource === 'operator') {
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
