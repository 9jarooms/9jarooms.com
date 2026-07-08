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
    const limit = Math.min(Number(searchParams.get('limit') || 100), 500);

    let query = supabase
        .from('bookings')
        .select('id, guest_name, guest_phone, guest_email, check_in, check_out, nights, status, total_amount, booking_source, created_at, room:rooms(unit_code, name), property:properties(id, name), room_type:room_types(name)')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (q) query = query.or(`guest_name.ilike.%${q}%,guest_phone.ilike.%${q}%,guest_email.ilike.%${q}%`);
    if (status) query = query.eq('status', status);
    if (propertyId) query = query.eq('property_id', propertyId);
    if (from) query = query.gte('check_in', from);
    if (to) query = query.lte('check_in', to);

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
