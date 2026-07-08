import { NextRequest, NextResponse } from 'next/server';
import { requireCrm } from '@/lib/auth/require-crm';
import { z } from 'zod';

const paymentSchema = z.object({
    amount: z.number().positive(),
    method: z.string().max(40).optional().nullable(),
    note: z.string().max(300).optional().nullable(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.adminClient!;
    const { id } = await params;

    const parsed = paymentSchema.safeParse(await request.json());
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid payment' }, { status: 400 });
    }

    const { data: booking } = await supabase
        .from('bookings')
        .select('id, status, total_amount')
        .eq('id', id)
        .single();
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    const { data: payment, error } = await supabase
        .from('booking_payments')
        .insert({
            booking_id: id,
            amount: parsed.data.amount,
            method: parsed.data.method || null,
            note: parsed.data.note || null,
            recorded_by: auth.user!.id,
        })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // A pending booking with money against it becomes confirmed
    if (booking.status === 'pending') {
        await supabase.from('bookings')
            .update({ status: 'confirmed', expires_at: null })
            .eq('id', id);
    }

    const { data: payments } = await supabase
        .from('booking_payments')
        .select('amount')
        .eq('booking_id', id);
    const paid = (payments || []).reduce((s, p) => s + Number(p.amount), 0);

    return NextResponse.json({ success: true, payment, paid });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.adminClient!;
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');
    if (!paymentId) return NextResponse.json({ error: 'paymentId is required' }, { status: 400 });

    const { error } = await supabase
        .from('booking_payments')
        .delete()
        .eq('id', paymentId)
        .eq('booking_id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
