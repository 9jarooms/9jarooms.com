import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { requireCrm } from '@/lib/auth/require-crm';

// "Send me a test notification": to every device of the signed-in person.
export async function POST() {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
    if (!pub || !priv) return NextResponse.json({ error: 'Notifications are not set up on the server' }, { status: 500 });
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:team@9jarooms.com', pub, priv);
    const { data: subs } = await auth.adminClient!.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', auth.user!.id);
    let sent = 0;
    for (const s of subs || []) {
        try {
            await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                JSON.stringify({ title: '9jaRooms', body: 'Notifications are working on this phone ✅', url: '/dashboard', tag: 'test' }), { TTL: 600, urgency: 'high' });
            sent++;
        } catch (e: any) {
            if (e?.statusCode === 404 || e?.statusCode === 410) await auth.adminClient!.from('push_subscriptions').delete().eq('id', s.id);
        }
    }
    return NextResponse.json({ sent });
}
