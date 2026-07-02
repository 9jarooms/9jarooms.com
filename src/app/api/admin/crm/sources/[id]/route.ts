import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { sourceSchema } from '../../_validation';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAdmin();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    if (!auth.adminClient) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const parsed = sourceSchema.partial().safeParse(await request.json());
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
    }

    const { data, error } = await auth.adminClient
        .from('crm_booking_sources')
        .update(parsed.data)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        const msg = error.code === '23505' ? 'A source with that name already exists' : error.message;
        return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ source: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAdmin();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    if (!auth.adminClient) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    // Bookings referencing this source have source_id set to NULL (ON DELETE SET NULL).
    const { error } = await auth.adminClient.from('crm_booking_sources').delete().eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
