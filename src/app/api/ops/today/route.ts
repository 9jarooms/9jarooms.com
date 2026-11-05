import { NextRequest, NextResponse } from 'next/server';
import { lagosToday } from '@/lib/booking/hold';
import { requireOps } from '@/lib/auth/require-ops';
import { paidByBooking } from '@/lib/booking/crm-ops';
import { operatedInventory } from '@/lib/booking/occupancy';

// Everything the Today / Units screens need for one property in a single
// call: the properties this user may operate, the property's units and
// room types, every booking touching the next WINDOW_DAYS, manual blocks
// and booking-held cells in that window.
const WINDOW_DAYS = 30;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// pure string date arithmetic — no timezone surprises on a UTC server
function shiftIso(iso: string, days: number) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

const BOOKING_COLS = 'id, room_id, room_type_id, property_id, guest_name, guest_phone, guest_email, check_in, check_out, nights, status, total_amount, booking_source, notes, adults, children, expires_at, checked_in_at, checked_out_at';

export async function GET(request: NextRequest) {
    const auth = await requireOps();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.adminClient;
    const role = auth.role;

    const { searchParams } = new URL(request.url);
    const requestedId = searchParams.get('propertyId');
    // Lagos date from the server clock: a phone with the wrong date or time zone cannot shift the day
    const today = lagosToday();
    const to = shiftIso(today, WINDOW_DAYS);

    const empty = (properties: any[], propertyId: string | null) => NextResponse.json({
        today, role, properties, propertyId,
        roomTypes: [], units: [], bookings: [], blocks: [], held: [],
    });

    // everything staff operate: live properties plus switched-off ones with real rooms (not on the website yet)
    const inv = await operatedInventory(supabase);
    let propertyRows = inv.properties.map(p => ({ id: p.id, name: p.name, area: p.area }));
    if (auth.propertyIds) {
        if (auth.propertyIds.length === 0) return empty([], null);
        propertyRows = propertyRows.filter(p => auth.propertyIds!.includes(p.id));
    }

    const properties = propertyRows || [];
    // 'all' = every property at once (the default for a two-person team)
    const propertyId = requestedId === 'all' && properties.length > 0
        ? 'all'
        : requestedId && properties.some(p => p.id === requestedId)
            ? requestedId
            : (properties.length > 1 ? 'all' : (properties[0]?.id ?? null));
    if (!propertyId) return empty(properties, null);
    const propertyIds = propertyId === 'all' ? properties.map(p => p.id as string) : [propertyId];

    const inScope = new Set(propertyIds);
    const roomTypes = inv.types.filter(t => inScope.has(t.property_id))
        .map(t => ({ id: t.id, name: t.name, price_per_night: t.price_per_night, sort_order: t.sort_order, property_id: t.property_id, images: t.images, is_active: t.is_active }));
    const units = inv.units.filter(u => inScope.has(u.property_id))
        .map(u => ({ id: u.id, name: u.name, unit_code: u.unit_code, room_type_id: u.room_type_id, price_per_night: u.price_per_night, property_id: u.property_id }))
        .sort((a, b) => (a.unit_code || '').localeCompare(b.unit_code || '', 'en', { numeric: true }));
    const unitIds = (units || []).map(u => u.id);

    const windowBookingsP = supabase.from('bookings')
        .select(BOOKING_COLS)
        .in('property_id', propertyIds)
        .lt('check_in', to)
        .gt('check_out', today)
        .not('status', 'in', '("cancelled","expired","no_show")');
    // Guests still marked checked-in after their check-out date — the unit
    // is physically occupied until someone checks them out.
    const overdueP = supabase.from('bookings')
        .select(BOOKING_COLS)
        .in('property_id', propertyIds)
        .eq('status', 'checked_in')
        .lte('check_out', today);
    // booked but never checked in, dates just passed: keep them on screen to mark no-show or check in
    const missedP = supabase.from('bookings')
        .select(BOOKING_COLS)
        .in('property_id', propertyIds)
        .in('status', ['confirmed', 'paid'])
        .lte('check_out', today)
        .gte('check_out', shiftIso(today, -3));
    const blocksP = unitIds.length
        ? supabase.from('availability')
            .select('room_id, date, status')
            .in('room_id', unitIds)
            .gte('date', today)
            .lt('date', to)
            .in('status', ['cleaning', 'maintenance'])
        : Promise.resolve({ data: [] as any[] });
    // Cells held by a booking — includes the extra rooms of a duplex /
    // whole-apartment booking that only lists its first room in room_id.
    const heldP = unitIds.length
        ? supabase.from('availability')
            .select('room_id, date, booking_id, booking:bookings(status, expires_at)')
            .in('room_id', unitIds)
            .gte('date', today)
            .lt('date', to)
            .in('status', ['booked', 'held'])
            .not('booking_id', 'is', null)
        : Promise.resolve({ data: [] as any[] });

    // transfer locks that ran out in the last hour: the money may still arrive (bank transfers are slow)
    const lapsedP = supabase.from('bookings')
        .select(BOOKING_COLS)
        .in('property_id', propertyIds)
        .in('status', ['pending', 'expired'])
        .lt('expires_at', new Date().toISOString())
        .gt('expires_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
        .not('created_by', 'is', null);
    const [{ data: windowBookings }, { data: overdue }, { data: blocks }, { data: heldRaw }, { data: missed }, { data: lapsedRaw }] =
        await Promise.all([windowBookingsP, overdueP, blocksP, heldP, missedP, lapsedP]);

    const now = Date.now();
    // an unpaid lock past its 15 minutes no longer holds the room (the expiry job may not have run yet)
    const held = ((heldRaw || []) as any[])
        .filter(c => !(c.booking?.status === 'pending' && c.booking.expires_at && new Date(c.booking.expires_at).getTime() < now))
        .map(({ booking: _b, ...c }) => c);
    const byId = new Map<string, any>();
    for (const b of [...(windowBookings || []), ...(overdue || []), ...(missed || [])]) {
        // hide expired unpaid holds
        if (b.status === 'pending' && b.expires_at && new Date(b.expires_at).getTime() < now) continue;
        byId.set(b.id, b);
    }
    const rows = [...byId.values()];
    const paid = await paidByBooking(supabase, rows);

    return NextResponse.json({
        today,
        role,
        properties,
        propertyId,
        roomTypes: roomTypes || [],
        units: units || [],
        bookings: rows.map(b => ({ ...b, paid: paid[b.id] || 0 })),
        blocks: blocks || [],
        held: held || [],
        lapsed: (lapsedRaw || []).map(b => ({ ...b, paid: 0 })),
        serverNow: Date.now(),
    });
}
