import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { sourceSchema } from '../_validation';

export async function POST(request: Request) {
    const auth = await requireAdmin();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    if (!auth.adminClient) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = sourceSchema.safeParse(await request.json());
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
    }

    const { data, error } = await auth.adminClient
        .from('crm_booking_sources')
        .insert(parsed.data)
        .select()
        .single();

    if (error) {
        const msg = error.code === '23505' ? 'A source with that name already exists' : error.message;
        return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ source: data });
}
