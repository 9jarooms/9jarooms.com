import { NextRequest, NextResponse } from 'next/server';
import { requireOps, canAccessProperty } from '@/lib/auth/require-ops';
import { paymentSchema, recordPayment, deletePayment, opsResponse } from '@/lib/booking/crm-ops';

async function scopedBooking(auth: Awaited<ReturnType<typeof requireOps>>, id: string) {
    if ('error' in auth) return { error: auth.error, status: auth.status };
    const { data: booking } = await auth.adminClient
        .from('bookings')
        .select('id, property_id')
        .eq('id', id)
        .maybeSingle();
    if (!booking) return { error: 'Booking not found', status: 404 };
    if (!canAccessProperty(auth, booking.property_id)) return { error: 'Forbidden: not your property', status: 403 };
    return { ok: true as const };
}

// Record cash / transfer / POS received against a booking.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireOps();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { id } = await params;

    const scope = await scopedBooking(auth, id);
    if ('error' in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

    const parsed = paymentSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payment' }, { status: 400 });

    return opsResponse(await recordPayment(auth.adminClient, id, parsed.data, auth.user.id));
}

// Removing a payment is rep/admin work — caretakers can only add.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireOps();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    if (auth.role === 'caretaker') {
        return NextResponse.json({ error: 'Ask a customer rep to remove a payment' }, { status: 403 });
    }
    const { id } = await params;

    const scope = await scopedBooking(auth, id);
    if ('error' in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

    const paymentId = new URL(request.url).searchParams.get('paymentId');
    if (!paymentId) return NextResponse.json({ error: 'paymentId is required' }, { status: 400 });

    return opsResponse(await deletePayment(auth.adminClient, id, paymentId));
}
