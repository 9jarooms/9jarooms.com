import type { createAdminClient } from '@/lib/supabase/server';
import { paidByBooking } from '@/lib/booking/crm-ops';

// The daily occupancy log, computed from bookings for any date: one row per unit with who is in it,
// their rate, dates, total, paid and balance — the same sheet the team used to fill in by hand, now
// generated automatically every day. Also future bookings and outstanding balances.

type Db = ReturnType<typeof createAdminClient>;
const LIVE = ['pending', 'confirmed', 'paid', 'checked_in'];

function shift(iso: string, days: number) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
const natural = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });

export interface LogRow {
    unitId: string; unit: string; group: string | null;
    status: 'occupied' | 'arriving' | 'leaving' | 'vacant' | 'cleaning' | 'maintenance' | 'held';
    bookingId?: string; guest?: string; phone?: string | null;
    rate?: number; checkIn?: string; checkOut?: string; nights?: number;
    total?: number; paid?: number; balance?: number; source?: string | null;
}
export interface LogProperty { id: string; name: string; live: boolean; rows: LogRow[]; occupied: number; units: number }

// Properties staff operate: everything live, plus switched-off ones that have real coded units
// (rooms imported from the occupancy log that are not on the website yet).
export interface InvUnit { id: string; name: string; unit_code: string | null; room_type_id: string | null; price_per_night: number | null; property_id: string; is_active: boolean | null }
export interface InvType { id: string; name: string; price_per_night: number; sort_order: number | null; property_id: string; is_active: boolean | null; images: string[] | null; description: string | null }
export interface InvProperty { id: string; name: string; area: string | null; is_active: boolean | null; price_per_night: number | null; minimum_stay: number | null; whole_apartment_price: number | null; two_bed_price: number | null; images: string[] | null }

// Everything staff screens need about the inventory in ONE database round trip: operated properties
// (live, plus switched-off ones with real coded rooms), their active rooms and their room types.
export async function operatedInventory(supabase: Db) {
    const { data } = await supabase.from('properties')
        .select('id, name, area, is_active, price_per_night, minimum_stay, whole_apartment_price, two_bed_price, images, ' +
            'rooms(id, name, unit_code, room_type_id, price_per_night, property_id, is_active), ' +
            'room_types(id, name, price_per_night, sort_order, property_id, is_active, images, description)')
        .eq('is_deleted', false).order('name');
    const all = (data || []) as unknown as (InvProperty & { rooms: InvUnit[]; room_types: InvType[] })[];
    const operated = all.filter(p => p.is_active || p.rooms.some(r => r.is_active && r.unit_code));
    return {
        properties: operated.map(({ rooms: _r, room_types: _t, ...p }) => p as InvProperty),
        units: operated.flatMap(p => p.rooms.filter(r => r.is_active)),
        types: operated.flatMap(p => p.room_types).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    };
}

export async function operatedProperties(supabase: Db) {
    return (await operatedInventory(supabase)).properties;
}

export async function dailyLog(supabase: Db, date: string, propertyId?: string | null) {
    const inv = await operatedInventory(supabase);
    let props = inv.properties;
    if (propertyId && propertyId !== 'all') props = props.filter(p => p.id === propertyId);
    const ids = props.map(p => p.id);
    if (!ids.length) return { date, properties: [], future: [], owing: [], totals: { units: 0, occupied: 0, revenueToday: 0, owing: 0 } };

    const scope = new Set(ids);
    const units = inv.units.filter(u => scope.has(u.property_id));
    const types = inv.types.filter(t => scope.has(t.property_id));
    const unitIds = (units || []).map(u => u.id);
    const typeName = new Map((types || []).map(t => [t.id, t.name] as const));
    const cols = 'id, room_id, property_id, guest_name, guest_phone, check_in, check_out, nights, price_per_night, total_amount, status, booking_source, expires_at';

    const [{ data: inHouse }, { data: overdue }, { data: future }, { data: blocks }, { data: cells }] = await Promise.all([
        supabase.from('bookings').select(cols).in('property_id', ids).lte('check_in', date).gt('check_out', date).in('status', LIVE),
        supabase.from('bookings').select(cols).in('property_id', ids).eq('status', 'checked_in').lte('check_out', date),
        supabase.from('bookings').select(cols).in('property_id', ids).gt('check_in', date).lte('check_in', shift(date, 30)).in('status', LIVE).order('check_in'),
        unitIds.length ? supabase.from('availability').select('room_id, status').in('room_id', unitIds).eq('date', date).in('status', ['cleaning', 'maintenance']) : Promise.resolve({ data: [] as any[] }),
        unitIds.length ? supabase.from('availability').select('room_id, booking_id').in('room_id', unitIds).eq('date', date).not('booking_id', 'is', null) : Promise.resolve({ data: [] as any[] }),
    ]);

    const now = Date.now();
    const alive = (b: any) => !(b.status === 'pending' && b.expires_at && new Date(b.expires_at).getTime() < now);
    const current = [...(inHouse || []), ...(overdue || [])].filter(alive);
    const byId = new Map(current.map(b => [b.id, b] as const));
    const paid = await paidByBooking(supabase, [...current, ...(future || [])]);

    const byUnit = new Map<string, any>();
    for (const b of current) if (!byUnit.has(b.room_id) || b.status === 'checked_in') byUnit.set(b.room_id, b);
    for (const c of cells || []) { const b = byId.get(c.booking_id); if (b && !byUnit.has(c.room_id)) byUnit.set(c.room_id, b); } // extra rooms of a bundle
    const blockOf = new Map((blocks || []).map(k => [k.room_id, k.status] as const));

    const row = (u: any): LogRow => {
        const base = { unitId: u.id, unit: u.unit_code || u.name, group: u.room_type_id ? typeName.get(u.room_type_id) || null : null };
        const b = byUnit.get(u.id);
        if (!b) {
            const k = blockOf.get(u.id);
            return { ...base, status: k === 'cleaning' ? 'cleaning' : k === 'maintenance' ? 'maintenance' : 'vacant', rate: u.price_per_night != null ? Number(u.price_per_night) : undefined };
        }
        const p = paid[b.id] || 0, total = Number(b.total_amount || 0);
        const status: LogRow['status'] = b.status === 'pending' ? 'held'
            : b.status === 'checked_in' ? (b.check_out <= date ? 'leaving' : 'occupied')
                : b.check_in === date ? 'arriving' : 'occupied';
        return { ...base, status, bookingId: b.id, guest: b.guest_name, phone: b.guest_phone, rate: Number(b.price_per_night || 0),
            checkIn: b.check_in, checkOut: b.check_out, nights: b.nights, total, paid: p, balance: Math.max(total - p, 0), source: b.booking_source };
    };

    const properties: LogProperty[] = props.map(p => {
        const rows = (units || []).filter(u => u.property_id === p.id).sort((a, b) => natural(a.unit_code || a.name, b.unit_code || b.name)).map(row);
        return { id: p.id, name: p.name, live: !!p.is_active, rows, units: rows.length,
            occupied: rows.filter(r => r.status === 'occupied' || r.status === 'arriving' || r.status === 'leaving').length };
    });

    // money still owed by guests who have stayed (any date), biggest first
    const { data: owingRows } = await supabase.from('bookings').select(cols)
        .in('property_id', ids).in('status', ['checked_in', 'completed', 'confirmed']).lte('check_in', date).order('check_in', { ascending: false }).limit(400);
    const owPaid = await paidByBooking(supabase, owingRows || []);
    const unitName = new Map((units || []).map(u => [u.id, u.unit_code || u.name] as const));
    const owing = (owingRows || [])
        .map(b => ({ bookingId: b.id, guest: b.guest_name, phone: b.guest_phone, unit: unitName.get(b.room_id) || '—', checkIn: b.check_in, checkOut: b.check_out,
            total: Number(b.total_amount || 0), paid: owPaid[b.id] || 0, balance: Math.max(Number(b.total_amount || 0) - (owPaid[b.id] || 0), 0), status: b.status }))
        .filter(o => o.balance > 0).sort((a, b) => b.balance - a.balance);

    const all = properties.flatMap(p => p.rows);
    return {
        date,
        properties,
        future: (future || []).map(b => ({ bookingId: b.id, guest: b.guest_name, phone: b.guest_phone, unit: unitName.get(b.room_id) || '—',
            checkIn: b.check_in, checkOut: b.check_out, nights: b.nights, total: Number(b.total_amount || 0), paid: paid[b.id] || 0, status: b.status })),
        owing,
        totals: {
            units: all.length,
            occupied: all.filter(r => ['occupied', 'arriving', 'leaving'].includes(r.status)).length,
            revenueToday: all.reduce((s, r) => s + (['occupied', 'arriving', 'leaving'].includes(r.status) ? (r.rate || 0) : 0), 0),
            owing: owing.reduce((s, o) => s + o.balance, 0),
        },
    };
}
