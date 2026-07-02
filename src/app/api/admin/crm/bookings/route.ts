import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { bookingSchema } from '../_validation';

export async function POST(request: Request) {
    const auth = await requireAdmin({ allowOperator: true });
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    if (!auth.adminClient || !auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = bookingSchema.safeParse(await request.json());
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
    }

    const { data, error } = await auth.adminClient
        .from('crm_bookings')
        .insert({ ...parsed.data, created_by: auth.user.id })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ booking: data });
}
