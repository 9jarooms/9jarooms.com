import { NextRequest, NextResponse } from 'next/server';
import { requireCrm } from '@/lib/auth/require-crm';

// CRM calendar data: units (grouped by room type), bookings overlapping the
// window, and manual blocks (cleaning/maintenance) not tied to a booking.
export async function GET(request: NextRequest) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.adminClient!;

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!propertyId || !from || !to) {
        return NextResponse.json({ error: 'propertyId, from and to are required' }, { status: 400 });
    }

    const [{ data: roomTypes }, { data: units }] = await Promise.all([
        supabase.from('room_types')
            .select('id, name, price_per_night, sort_order')
            .eq('property_id', propertyId)
            .order('sort_order'),
        supabase.from('rooms')
            .select('id, name, unit_code, room_type_id, is_active, price_per_night')
            .eq('property_id', propertyId)
            .eq('is_active', true)
            .order('unit_code'),
    ]);

    const unitIds = (units || []).map(u => u.id);

    // Bookings overlapping [from, to): check_in < to AND check_out > from
    const { data: bookings } = unitIds.length
        ? await supabase.from('bookings')
            .select('id, room_id, room_type_id, guest_name, guest_phone, guest_email, check_in, check_out, nights, status, total_amount, booking_source, notes, adults, children, expires_at, checked_in_at, checked_out_at')
            .in('room_id', unitIds)
            .lt('check_in', to)
            .gt('check_out', from)
            .not('status', 'in', '("cancelled","expired")')
        : { data: [] };

    // Payments for those bookings
    const bookingIds = (bookings || []).map(b => b.id);
    const { data: payments } = bookingIds.length
        ? await supabase.from('booking_payments')
            .select('booking_id, amount')
            .in('booking_id', bookingIds)
        : { data: [] };

    const paidByBooking: Record<string, number> = {};
    for (const p of payments || []) {
        paidByBooking[p.booking_id] = (paidByBooking[p.booking_id] || 0) + Number(p.amount);
    }

    // Manual blocks (cleaning / maintenance) in the window, no booking attached
    const { data: blocks } = unitIds.length
        ? await supabase.from('availability')
            .select('room_id, date, status')
            .in('room_id', unitIds)
            .gte('date', from)
            .lt('date', to)
            .in('status', ['cleaning', 'maintenance'])
        : { data: [] };

    const now = new Date();
    return NextResponse.json({
        roomTypes: roomTypes || [],
        units: units || [],
        bookings: (bookings || [])
            // hide expired unpaid holds
            .filter(b => !(b.status === 'pending' && b.expires_at && new Date(b.expires_at) < now))
            .map(b => ({ ...b, paid: b.status === 'paid' ? Number(b.total_amount) : (paidByBooking[b.id] || 0) })),
        blocks: blocks || [],
    });
}
