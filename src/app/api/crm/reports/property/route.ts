import { NextRequest, NextResponse } from 'next/server';
import { requireCrm } from '@/lib/auth/require-crm';

const LIVE = ['confirmed', 'paid', 'checked_in', 'completed'];

// Numbers for ONE property over a date range — powers the downloadable PDF.
// A booking counts toward the range if it overlaps it; nights and revenue are
// clipped to the portion inside [from, to).
export async function GET(request: NextRequest) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.adminClient!;

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const from = searchParams.get('from'); // inclusive YYYY-MM-DD
    const to = searchParams.get('to');     // exclusive YYYY-MM-DD
    if (!propertyId || !from || !to) {
        return NextResponse.json({ error: 'propertyId, from and to are required' }, { status: 400 });
    }
    if (from >= to) return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });

    const [{ data: property }, { data: units }, { data: bookings }] = await Promise.all([
        supabase.from('properties').select('id, name, area, city').eq('id', propertyId).single(),
        supabase.from('rooms').select('id').eq('property_id', propertyId).eq('is_active', true),
        supabase.from('bookings')
            .select('id, guest_name, check_in, check_out, nights, status, total_amount, booking_source, room:rooms(unit_code, name), room_type:room_types(name)')
            .eq('property_id', propertyId)
            .in('status', LIVE)
            .lt('check_in', to)
            .gt('check_out', from)
            .order('check_in'),
    ]);

    if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

    const ids = (bookings || []).map(b => b.id);
    const { data: payments } = ids.length
        ? await supabase.from('booking_payments').select('booking_id, amount').in('booking_id', ids)
        : { data: [] };
    const paidBy: Record<string, number> = {};
    for (const p of payments || []) paidBy[p.booking_id] = (paidBy[p.booking_id] || 0) + Number(p.amount);

    const dayMs = 86400000;
    const rangeDays = Math.round((+new Date(to) - +new Date(from)) / dayMs);
    const unitCount = (units || []).length;

    let revenue = 0, soldNights = 0, outstanding = 0;
    const bySource: Record<string, number> = {};
    const byRoomType: Record<string, { revenue: number; nights: number }> = {};

    const rows = (bookings || []).map(b => {
        const total = Number(b.total_amount) || 0;
        // clip nights to the requested window for occupancy/nights accuracy
        const clipFrom = b.check_in > from ? b.check_in : from;
        const clipTo = b.check_out < to ? b.check_out : to;
        const nightsInRange = Math.max(Math.round((+new Date(clipTo) - +new Date(clipFrom)) / dayMs), 0);
        const paid = b.status === 'paid' ? total : (paidBy[b.id] || 0);
        const balance = Math.max(total - paid, 0);

        revenue += total;
        soldNights += nightsInRange;
        if (b.status !== 'completed') outstanding += balance;

        const src = (b.booking_source || 'unknown').replace('_', ' ');
        bySource[src] = (bySource[src] || 0) + total;
        const rt = (b.room_type as any)?.name || 'Room';
        if (!byRoomType[rt]) byRoomType[rt] = { revenue: 0, nights: 0 };
        byRoomType[rt].revenue += total;
        byRoomType[rt].nights += nightsInRange;

        return {
            guest: b.guest_name,
            unit: (b.room as any)?.unit_code || (b.room as any)?.name || '',
            roomType: (b.room_type as any)?.name || '',
            checkIn: b.check_in,
            checkOut: b.check_out,
            nights: b.nights,
            source: src,
            status: b.status,
            total,
            paid,
            balance,
        };
    });

    const availableNights = unitCount * rangeDays;
    const occupancy = availableNights > 0 ? Math.round((soldNights / availableNights) * 1000) / 10 : 0;
    const adr = soldNights > 0 ? Math.round(revenue / soldNights) : 0;

    return NextResponse.json({
        property: { name: property.name, area: property.area, city: property.city },
        range: { from, to, days: rangeDays },
        summary: {
            revenue,
            bookings: rows.length,
            nightsSold: soldNights,
            occupancy,
            adr,
            outstanding,
            units: unitCount,
        },
        bySource: Object.entries(bySource).sort((a, b) => b[1] - a[1]).map(([source, amount]) => ({ source, amount })),
        byRoomType: Object.entries(byRoomType).sort((a, b) => b[1].revenue - a[1].revenue).map(([name, v]) => ({ name, ...v })),
        bookings: rows,
    });
}
