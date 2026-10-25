import { NextRequest, NextResponse } from 'next/server';
import { requireOps } from '@/lib/auth/require-ops';
import { dateRange } from '@/lib/booking/crm-ops';
import { isBlockedSlot, priceRoomTypeStay } from '@/lib/booking/room-types';

// "Find a room": every unit free for a stay, grouped the way guests buy
// them (room type, or plain rooms), priced for the whole stay, with a
// website link that lands on the property with the dates filled in. The
// exact check the public site runs, so a caretaker and a web guest can
// never disagree about what is free.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://9jarooms.com').replace(/\/$/, '');

export interface FreeGroup {
    key: string;
    propertyId: string;
    propertyName: string;
    area: string | null;
    label: string;          // room type name, or the property name for untyped rooms
    perNight: number | null;
    total: number | null;   // for the stay, after price overrides
    units: { id: string; label: string; perNight: number | null; total: number | null }[];
    unitCount: number;      // every active unit in the group, free or not
    link: string;           // public page with the dates pre-filled
    hidden?: boolean;       // room type switched off the website (still bookable by staff)
}

export async function GET(request: NextRequest) {
    const auth = await requireOps();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.adminClient;

    const sp = new URL(request.url).searchParams;
    const from = sp.get('from') || '';
    const to = sp.get('to') || '';
    const requested = sp.get('propertyId');
    if (!DATE_RE.test(from) || !DATE_RE.test(to) || to <= from) {
        return NextResponse.json({ error: 'from and to must be dates with to after from' }, { status: 400 });
    }
    const dates = dateRange(from, to);
    const nights = dates.length;

    let propsQuery = supabase
        .from('properties')
        .select('id, name, area, price_per_night, minimum_stay')
        .eq('is_deleted', false)
        .eq('is_active', true)
        .order('name');
    if (auth.propertyIds) propsQuery = propsQuery.in('id', auth.propertyIds);
    if (requested && requested !== 'all') propsQuery = propsQuery.eq('id', requested);
    const { data: properties, error } = await propsQuery;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const propertyIds = (properties || []).map(p => p.id as string);
    if (propertyIds.length === 0) return NextResponse.json({ from, to, nights, groups: [] });

    const [{ data: roomTypes }, { data: units }] = await Promise.all([
        supabase.from('room_types')
            .select('id, name, price_per_night, sort_order, property_id, is_active')
            .in('property_id', propertyIds)
            .order('sort_order'),
        supabase.from('rooms')
            .select('id, name, unit_code, room_type_id, price_per_night, property_id')
            .in('property_id', propertyIds)
            .eq('is_active', true)
            .order('unit_code'),
    ]);
    const unitIds = (units || []).map(u => u.id as string);

    const { data: slots } = unitIds.length
        ? await supabase
            .from('availability')
            .select('room_id, status, booking:bookings(expires_at)')
            .in('room_id', unitIds)
            .in('date', dates)
        : { data: [] };
    const now = new Date();
    const blocked = new Set<string>();
    for (const slot of (slots || []) as unknown as Array<{ room_id: string; status: string; booking?: { expires_at: string | null } | null }>) {
        if (isBlockedSlot(slot, now)) blocked.add(slot.room_id);
    }

    const groups: FreeGroup[] = [];
    for (const p of properties || []) {
        const link = `${SITE}/property/${p.id}?in=${from}&out=${to}`;
        const pUnits = (units || []).filter(u => u.property_id === p.id);
        const pTypes = (roomTypes || []).filter(t => t.property_id === p.id);

        for (const t of pTypes) {
            const all = pUnits.filter(u => u.room_type_id === t.id);
            if (all.length === 0) continue;
            const price = await priceRoomTypeStay(supabase, { id: t.id, price_per_night: Number(t.price_per_night) }, dates);
            groups.push({
                key: `${p.id}:${t.id}`, propertyId: p.id, propertyName: p.name, area: p.area,
                label: t.name, perNight: price.perNight, total: price.total, hidden: t.is_active === false,
                units: all.filter(u => !blocked.has(u.id)).map(u => ({
                    id: u.id, label: u.unit_code || u.name, perNight: price.perNight, total: price.total,
                })),
                unitCount: all.length, link,
            });
        }

        const untyped = pUnits.filter(u => !u.room_type_id || !pTypes.some(t => t.id === u.room_type_id));
        if (untyped.length > 0) {
            const perNightOf = (u: { price_per_night: number | string | null }) =>
                u.price_per_night != null && u.price_per_night !== '' ? Number(u.price_per_night)
                    : p.price_per_night != null ? Number(p.price_per_night) : null;
            const free = untyped.filter(u => !blocked.has(u.id));
            const first = free[0] ? perNightOf(free[0]) : (untyped[0] ? perNightOf(untyped[0]) : null);
            groups.push({
                key: `${p.id}:rooms`, propertyId: p.id, propertyName: p.name, area: p.area,
                label: p.name, perNight: first, total: first != null ? first * nights : null,
                units: free.map(u => {
                    const pn = perNightOf(u);
                    return { id: u.id, label: u.unit_code || u.name, perNight: pn, total: pn != null ? pn * nights : null };
                }),
                unitCount: untyped.length, link,
            });
        }
    }

    return NextResponse.json({ from, to, nights, groups });
}
