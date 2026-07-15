import { NextRequest, NextResponse } from 'next/server';
import { requireCrm } from '@/lib/auth/require-crm';

// Reservations list with search + filters
export async function GET(request: NextRequest) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.adminClient!;

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const status = searchParams.get('status');
    const propertyId = searchParams.get('propertyId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const outFrom = searchParams.get('outFrom'); // check_out >= (departures view)
    const outTo = searchParams.get('outTo');     // check_out <=
    const sort = searchParams.get('sort');       // 'check_in' | 'check_out' | default created_at
    const activeOnly = searchParams.get('activeOnly') === '1';
    const limit = Math.min(Number(searchParams.get('limit') || 100), 500);

    const orderCol = sort === 'check_in' || sort === 'check_out' ? sort : 'created_at';
    let query = supabase
        .from('bookings')
        .select('id, guest_name, guest_phone, guest_email, check_in, check_out, nights, status, total_amount, booking_source, created_at, room:rooms(unit_code, name), property:properties(id, name), room_type:room_types(name)')
        .order(orderCol, { ascending: orderCol !== 'created_at' })
        .limit(limit);

    if (q) query = query.or(`guest_name.ilike.%${q}%,guest_phone.ilike.%${q}%,guest_email.ilike.%${q}%`);
    if (status) query = query.eq('status', status);
    if (activeOnly) query = query.not('status', 'in', '("cancelled","no_show","expired")');
    if (propertyId) query = query.eq('property_id', propertyId);
    if (from) query = query.gte('check_in', from);
    if (to) query = query.lte('check_in', to);
    if (outFrom) query = query.gte('check_out', outFrom);
    if (outTo) query = query.lte('check_out', outTo);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const ids = (data || []).map(b => b.id);
    const { data: payments } = ids.length
        ? await supabase.from('booking_payments').select('booking_id, amount').in('booking_id', ids)
        : { data: [] };
    const paidBy: Record<string, number> = {};
    for (const p of payments || []) paidBy[p.booking_id] = (paidBy[p.booking_id] || 0) + Number(p.amount);

    return NextResponse.json({
        bookings: (data || []).map(b => ({
            ...b,
            paid: b.status === 'paid' ? Number(b.total_amount) : (paidBy[b.id] || 0),
        })),
    });
}
