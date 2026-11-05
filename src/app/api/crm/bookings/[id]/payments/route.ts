import { NextRequest, NextResponse } from 'next/server';
import { requireCrm } from '@/lib/auth/require-crm';
import { paymentSchema, recordPayment, deletePayment, opsResponse } from '@/lib/booking/crm-ops';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { id } = await params;

    const parsed = paymentSchema.safeParse(await request.json());
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid payment' }, { status: 400 });
    }

    return opsResponse(await recordPayment(auth.adminClient!, id, parsed.data, auth.user!.id, auth.role));
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    // removing money is admin / customer rep work (it is logged); caretakers can only add
    if (auth.role === 'caretaker') return NextResponse.json({ error: 'Ask a customer rep to remove a payment' }, { status: 403 });
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');
    if (!paymentId) return NextResponse.json({ error: 'paymentId is required' }, { status: 400 });

    return opsResponse(await deletePayment(auth.adminClient!, id, paymentId, auth.user!.id));
}
