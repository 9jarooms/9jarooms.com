import { NextResponse } from 'next/server';
import { requireCrm } from '@/lib/auth/require-crm';

const LIVE = ['confirmed', 'paid', 'checked_in', 'completed'];

// Portfolio overview: per-property occupancy + money, computed for today
// and the current month. The client filters which properties to show.
export async function GET() {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.adminClient!;

    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const monthStart = todayIso.slice(0, 8) + '01';
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

    const [{ data: properties }, { data: rooms }, { data: monthBookings }] = await Promise.all([
        supabase.from('properties')
            .select('id, name, area, is_active')
            .eq('is_deleted', false)
            .eq('is_active', true)
            .order('name'),
        supabase.from('rooms')
            .select('id, property_id, is_active')
            .eq('is_active', true),
        supabase.from('bookings')
            .select('id, property_id, room_id, check_in, check_out, nights, status, total_amount')
            .in('status', LIVE)
            .lt('check_in', monthEnd)
            .gt('check_out', monthStart),
    ]);

    const bookingIds = (monthBookings || []).map(b => b.id);
    const { data: payments } = bookingIds.length
        ? await supabase.from('booking_payments').select('booking_id, amount').in('booking_id', bookingIds)
        : { data: [] };
    const paidBy: Record<string, number> = {};
    for (const p of payments || []) paidBy[p.booking_id] = (paidBy[p.booking_id] || 0) + Number(p.amount);

    const roomsByProperty: Record<string, number> = {};
    for (const r of rooms || []) {
        roomsByProperty[r.property_id] = (roomsByProperty[r.property_id] || 0) + 1;
    }

    const result = (properties || []).map(p => {
        const units = roomsByProperty[p.id] || 0;
        const propBookings = (monthBookings || []).filter(b => b.property_id === p.id);

        let occupiedTonight = 0, arrivalsToday = 0, departuresToday = 0;
        let soldNights = 0, revenueMonth = 0, outstanding = 0;

        for (const b of propBookings) {
            if (b.check_in <= todayIso && b.check_out > todayIso) occupiedTonight += 1;
            if (b.check_in === todayIso) arrivalsToday += 1;
            if (b.check_out === todayIso) departuresToday += 1;
            // clip nights to this month for a true monthly occupancy figure
            const from = b.check_in > monthStart ? b.check_in : monthStart;
            const to = b.check_out < monthEnd ? b.check_out : monthEnd;
            const nights = Math.max(Math.round((+new Date(to) - +new Date(from)) / 86400000), 0);
            soldNights += nights;
            const total = Number(b.total_amount) || 0;
            revenueMonth += total;
            const paid = b.status === 'paid' ? total : (paidBy[b.id] || 0);
            if (b.status !== 'completed') outstanding += Math.max(total - paid, 0);
        }

        const availableNights = units * daysInMonth;
        return {
            id: p.id,
            name: p.name,
            area: p.area,
            units,
            occupiedTonight: Math.min(occupiedTonight, units),
            freeTonight: Math.max(units - occupiedTonight, 0),
            occupancyTonight: units > 0 ? Math.round((Math.min(occupiedTonight, units) / units) * 100) : 0,
            occupancyMonth: availableNights > 0 ? Math.round((soldNights / availableNights) * 1000) / 10 : 0,
            arrivalsToday,
            departuresToday,
            revenueMonth,
            outstanding,
            bookingsMonth: propBookings.length,
        };
    });

    return NextResponse.json({ properties: result, date: todayIso });
}
