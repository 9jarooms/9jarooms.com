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
export async function operatedProperties(supabase: Db) {
    const { data: props } = await supabase.from('properties')
        .select('id, name, area, is_active').eq('is_deleted', false).order('name');
    const ids = (props || []).map(p => p.id);
    const { data: coded } = ids.length
        ? await supabase.from('rooms').select('property_id').in('property_id', ids).not('unit_code', 'is', null).eq('is_active', true)
        : { data: [] as { property_id: string }[] };
    const withUnits = new Set((coded || []).map(r => r.property_id));
    return (props || []).filter(p => p.is_active || withUnits.has(p.id));
}

export async function dailyLog(supabase: Db, date: string, propertyId?: string | null) {
    let props = await operatedProperties(supabase);
    if (propertyId && propertyId !== 'all') props = props.filter(p => p.id === propertyId);
    const ids = props.map(p => p.id);
    if (!ids.length) return { date, properties: [], future: [], owing: [], totals: { units: 0, occupied: 0, revenueToday: 0, owing: 0 } };

    const [{ data: units }, { data: types }] = await Promise.all([
        supabase.from('rooms').select('id, property_id, unit_code, name, room_type_id, price_per_night').in('property_id', ids).eq('is_active', true),
        supabase.from('room_types').select('id, name').in('property_id', ids),
    ]);
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
