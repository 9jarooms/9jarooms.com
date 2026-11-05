import { NextResponse } from 'next/server';
import { requireOps } from '@/lib/auth/require-ops';

// What happened to a staff booking request whose reply never reached the phone: the booking it
// created (if any), so the phone can say so instead of guessing.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireOps();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { id } = await params;
    const { data: b } = await auth.adminClient.from('bookings')
        .select('id, status, guest_name, room_id, total_amount, check_in, check_out, room:rooms(unit_code, name)')
        .eq('client_request_id', id).maybeSingle();
    if (!b) return NextResponse.json({ found: false });
    const { data: pays } = await auth.adminClient.from('booking_payments').select('amount').eq('booking_id', b.id);
    const room = (b as any).room;
    return NextResponse.json({
        found: true, bookingId: b.id, status: b.status, guestName: b.guest_name, unit: room?.unit_code || room?.name || '',
        total: Number(b.total_amount), paid: (pays || []).reduce((t, p) => t + Number(p.amount), 0), checkIn: b.check_in, checkOut: b.check_out,
    });
}
