import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
    const supabase = createAdminClient();
    const searchParams = request.nextUrl.searchParams;

    const checkIn = searchParams.get('check_in');
    const checkOut = searchParams.get('check_out');
    const type = searchParams.get('type');
    const area = searchParams.get('area');
    const minPrice = searchParams.get('min_price');
    const maxPrice = searchParams.get('max_price');
    const guests = searchParams.get('guests');
    const sort = searchParams.get('sort');
    const bedrooms = searchParams.get('bedrooms');

    let query = supabase
        .from('properties')
        .select(`
            *,
            rooms(
                id, 
                price_per_night,
                max_guests,
                bookings(check_in, check_out, status)
            )
        `)
        .eq('is_active', true);

    if (type) {
        query = query.eq('type', type);
    }

    if (area) {
        query = query.or(`area.ilike.%${area}%,city.ilike.%${area}%`);
    }

    if (minPrice) {
        query = query.gte('price_per_night', minPrice);
    }

    if (maxPrice) {
        query = query.lte('price_per_night', maxPrice);
    }

    if (guests) {
        query = query.gte('max_guests', guests);
    }

    // Sorting
    if (sort === 'price_asc') {
        query = query.order('price_per_night', { ascending: true });
    } else if (sort === 'price_desc') {
        query = query.order('price_per_night', { ascending: false });
    } else {
        query = query.order('created_at', { ascending: false });
    }

    console.log('Executing Property Query...');

    try {
        const { data: rawData, error } = await query;

        if (error) {
            console.error('Supabase Query Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        console.log(`[Search] Found ${rawData?.length} properties in database for initial criteria.`);

        let filteredData = rawData || [];

        // Helper function to check availability
        // Same-day checkout/checkin is allowed (checkout 12pm, checkin 3pm)
        // We compare date strings (YYYY-MM-DD) to avoid timezone issues
        const toDateStr = (d: Date | string): string => {
            if (typeof d === 'string') return d.split('T')[0];
            return d.toISOString().split('T')[0];
        };

        const isPropertyAvailable = (property: any, start: Date, end: Date) => {
            const rooms = property.rooms || [];
            const startStr = toDateStr(start);
            const endStr = toDateStr(end);

            return rooms.some((room: any) => {
                const bookings = room.bookings || [];
                const hasOverlap = bookings.some((booking: any) => {
                    if (booking.status === 'cancelled') return false;
                    const bStartStr = toDateStr(booking.check_in);
                    const bEndStr = toDateStr(booking.check_out);

                    // Same-day transitions are allowed:
                    // New checkin ON existing checkout day → OK (startStr === bEndStr)
                    // New checkout ON existing checkin day → OK (endStr === bStartStr)
                    if (startStr === bEndStr || endStr === bStartStr) return false;

                    // Standard overlap: start < bEnd AND end > bStart
                    const overlaps = startStr < bEndStr && endStr > bStartStr;
                    if (overlaps) {
                        console.log(`  [Collision] Property ${property.name} (Room ${room.id}) overlaps with booking ${booking.check_in} to ${booking.check_out}`);
                    }
                    return overlaps;
                });
                return !hasOverlap;
            });
        };

        // Filter by bedrooms (room count)
        if (bedrooms) {
            const bedroomCount = parseInt(bedrooms, 10);
            if (!isNaN(bedroomCount)) {
                filteredData = filteredData.filter((property: any) => {
                    const roomCount = (property.rooms || []).length;
                    return roomCount === bedroomCount;
                });
                console.log(`[Filtering] ${filteredData.length} properties remain after bedroom filter (${bedroomCount}).`);
            }
        }

        // Filter by Date Availability
        if (checkIn && checkOut) {
            const start = new Date(checkIn);
            const end = new Date(checkOut);
            console.log(`[Filtering] Checking availability for ${checkIn} to ${checkOut}`);

            filteredData = filteredData.filter((property: any) => isPropertyAvailable(property, start, end));

            console.log(`[Filtering] ${filteredData.length} properties remain after date check.`);
        }

        // Suggestions Logic: If no results found, ALWAYS show alternatives
        let suggestions: any[] = [];
        let reason = '';
        let alternativeDates: { check_in: string; check_out: string }[] = [];

        if (filteredData.length === 0) {
            console.log('[Suggestions] No results found. Searching for alternatives...');

            // Determine reason
            if (area) {
                const { data: areaCheck } = await supabase
                    .from('properties')
                    .select('id')
                    .eq('is_active', true)
                    .or(`area.ilike.%${area}%,city.ilike.%${area}%`)
                    .limit(1);

                if (!areaCheck || areaCheck.length === 0) {
                    reason = 'no_area_match';
                } else if (checkIn && checkOut) {
                    reason = 'no_date_availability';

                    // Find alternative dates in the same area
                    const { data: areaProperties } = await supabase
                        .from('properties')
                        .select(`
                            *,
                            rooms(
                                id,
                                price_per_night,
                                max_guests,
                                bookings(check_in, check_out, status)
                            )
                        `)
                        .eq('is_active', true)
                        .or(`area.ilike.%${area}%,city.ilike.%${area}%`);

                    if (areaProperties && areaProperties.length > 0) {
                        const requestedNights = Math.ceil(
                            (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)
                        );
                        const stayLength = Math.max(requestedNights, 1);

                        for (let offset = 1; offset <= 14; offset++) {
                            const altStart = new Date(checkIn);
                            altStart.setDate(altStart.getDate() + offset);
                            const altEnd = new Date(altStart);
                            altEnd.setDate(altEnd.getDate() + stayLength);

                            const hasAvailable = areaProperties.some((p: any) =>
                                isPropertyAvailable(p, altStart, altEnd)
                            );

                            if (hasAvailable) {
                                alternativeDates.push({
                                    check_in: altStart.toISOString().split('T')[0],
                                    check_out: altEnd.toISOString().split('T')[0],
                                });
                                if (alternativeDates.length >= 3) break;
                            }
                        }
                    }
                } else if (bedrooms) {
                    reason = 'no_bedroom_match';
                } else {
                    reason = 'no_results';
                }
            } else {
                reason = checkIn && checkOut ? 'no_date_availability' : 'no_results';
            }

            // Fetch suggestions: first same city, then anywhere
            const allSuggestions: any[] = [];

            // 1. Try same city first (if area was specified, try city-level matches)
            if (area) {
                // Get the city of the searched area
                const { data: cityLookup } = await supabase
                    .from('properties')
                    .select('city')
                    .eq('is_active', true)
                    .or(`area.ilike.%${area}%,city.ilike.%${area}%`)
                    .limit(1);

                const city = cityLookup?.[0]?.city;

                if (city) {
                    // Fetch properties in the same city but different area
                    const { data: sameCityProps } = await supabase
                        .from('properties')
                        .select(`
                            *,
                            rooms(
                                id, 
                                price_per_night,
                                max_guests,
                                bookings(check_in, check_out, status)
                            )
                        `)
                        .eq('is_active', true)
                        .eq('city', city)
                        .not('area', 'ilike', `%${area}%`)
                        .limit(10);

                    if (sameCityProps) {
                        let available = sameCityProps;
                        if (checkIn && checkOut) {
                            const start = new Date(checkIn);
                            const end = new Date(checkOut);
                            available = sameCityProps.filter((p: any) => isPropertyAvailable(p, start, end));
                        }
                        allSuggestions.push(...available);
                    }
                }
            }

            // 2. Fill remaining slots with properties from anywhere
            if (allSuggestions.length < 8) {
                const existingIds = allSuggestions.map(p => p.id);
                let fallbackQuery = supabase
                    .from('properties')
                    .select(`
                        *,
                        rooms(
                            id, 
                            price_per_night,
                            max_guests,
                            bookings(check_in, check_out, status)
                        )
                    `)
                    .eq('is_active', true)
                    .limit(20);

                if (type) {
                    fallbackQuery = fallbackQuery.eq('type', type);
                }

                const { data: fallbackProps } = await fallbackQuery;

                if (fallbackProps) {
                    let available = fallbackProps.filter((p: any) => !existingIds.includes(p.id));
                    if (checkIn && checkOut) {
                        const start = new Date(checkIn);
                        const end = new Date(checkOut);
                        available = available.filter((p: any) => isPropertyAvailable(p, start, end));
                    }
                    allSuggestions.push(...available.slice(0, 8 - allSuggestions.length));
                }
            }

            suggestions = allSuggestions.slice(0, 8);
            console.log(`[Suggestions] Found ${suggestions.length} available alternatives.`);
        }

        // Also fetch available bedroom counts for the filter dropdown
        const bedroomCounts = new Set<number>();
        const { data: allProps } = await supabase
            .from('properties')
            .select('id, rooms(id)')
            .eq('is_active', true);

        allProps?.forEach((p: any) => {
            const roomCount = (p.rooms as any[])?.length || 0;
            if (roomCount > 0) {
                bedroomCounts.add(roomCount);
            }
        });

        return NextResponse.json({
            data: filteredData,
            suggestions,
            reason,
            alternativeDates,
            availableBedrooms: Array.from(bedroomCounts).sort((a, b) => a - b),
        });

    } catch (err: any) {
        console.error('API Route Critical Error:', err);
        return NextResponse.json({ error: 'Internal Server Error', details: err.message }, { status: 500 });
    }
}
