import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrm } from '@/lib/auth/require-crm';

// This device wants phone notifications (or no longer does).
const schema = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(300), auth: z.string().max(100) }) });

export async function POST(request: NextRequest) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    const { endpoint, keys } = parsed.data;
    const { error } = await auth.adminClient!.from('push_subscriptions').upsert({
        user_id: auth.user!.id, endpoint, p256dh: keys.p256dh, auth: keys.auth,
        user_agent: (request.headers.get('user-agent') || '').slice(0, 200), last_used_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const endpoint = new URL(request.url).searchParams.get('endpoint') || '';
    await auth.adminClient!.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', auth.user!.id);
    return NextResponse.json({ success: true });
}
