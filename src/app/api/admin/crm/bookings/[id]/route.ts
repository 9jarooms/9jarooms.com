import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { bookingSchema } from '../../_validation';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAdmin({ allowOperator: true });
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    if (!auth.adminClient) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const parsed = bookingSchema.safeParse(await request.json());
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
    }

    const { data, error } = await auth.adminClient
        .from('crm_bookings')
        .update({ ...parsed.data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ booking: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAdmin({ allowOperator: true });
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    if (!auth.adminClient) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { error } = await auth.adminClient.from('crm_bookings').delete().eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
