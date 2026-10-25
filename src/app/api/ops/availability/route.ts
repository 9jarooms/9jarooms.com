import { NextRequest, NextResponse } from 'next/server';
import { requireOps } from '@/lib/auth/require-ops';
import { dateRange } from '@/lib/booking/crm-ops';
import { isBlockedSlot } from '@/lib/booking/room-types';
import { operatedInventory } from '@/lib/booking/occupancy';

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

    const inv = await operatedInventory(supabase);
    const properties = inv.properties
        .filter(p => !auth.propertyIds || auth.propertyIds.includes(p.id))
        .filter(p => !requested || requested === 'all' || p.id === requested);
    const propertyIds = properties.map(p => p.id as string);
    if (propertyIds.length === 0) return NextResponse.json({ from, to, nights, groups: [] });
    const inScope = new Set(propertyIds);
    const roomTypes = inv.types.filter(t => inScope.has(t.property_id));
    const units = inv.units.filter(u => inScope.has(u.property_id))
        .sort((a, b) => (a.unit_code || '').localeCompare(b.unit_code || '', 'en', { numeric: true }));
    const unitIds = (units || []).map(u => u.id as string);

    const typeIds = roomTypes.map(t => t.id);
    const overridesP = typeIds.length
        ? supabase.from('price_overrides').select('room_type_id, start_date, end_date, price_per_night').in('room_type_id', typeIds)
        : Promise.resolve({ data: [] as any[] });
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

    // nightly total per room type: date-range overrides win over the base rate (same rule as priceRoomTypeStay)
    const { data: overrides } = await overridesP;
    const stayPrice = (typeId: string, base: number) => {
        const own = (overrides || []).filter(o => o.room_type_id === typeId);
        let total = 0;
        for (const d of dates) {
            const o = own.find(x => d >= x.start_date && d <= x.end_date);
            total += Number(o ? o.price_per_night : base);
        }
        return { total, perNight: dates.length ? Math.round(total / dates.length) : base };
    };

    const groups: FreeGroup[] = [];
    for (const p of properties || []) {
        const link = `${SITE}/property/${p.id}?in=${from}&out=${to}`;
        const pUnits = (units || []).filter(u => u.property_id === p.id);
        const pTypes = (roomTypes || []).filter(t => t.property_id === p.id);

        for (const t of pTypes) {
            const all = pUnits.filter(u => u.room_type_id === t.id);
            if (all.length === 0) continue;
            const price = stayPrice(t.id, Number(t.price_per_night));
            groups.push({
                key: `${p.id}:${t.id}`, propertyId: p.id, propertyName: p.name, area: p.area,
                label: t.name, perNight: price.perNight, total: price.total, hidden: t.is_active === false || !p.is_active,
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
                unitCount: untyped.length, link, hidden: !p.is_active,
            });
        }
    }

    return NextResponse.json({ from, to, nights, groups });
}
