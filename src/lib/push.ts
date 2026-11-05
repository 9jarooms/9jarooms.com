import webpush from 'web-push';
import type { createAdminClient } from '@/lib/supabase/server';

type Db = ReturnType<typeof createAdminClient>;
let ready = false;
function setup() {
    if (ready) return true;
    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
    if (!pub || !priv) return false;
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:team@9jarooms.com', pub, priv);
    return (ready = true);
}

// A notification on every staff phone that allowed them (lock screen, even with the app closed),
// except the person who did it. Never throws: a failed notification must not undo a booking.
export async function pushToStaff(supabase: Db, msg: { title: string; body: string; url?: string; tag?: string; exceptUserId?: string | null }) {
    try {
        if (!setup()) return;
        const { data: staff } = await supabase.from('user_roles').select('user_id').in('role', ['admin', 'customer_rep', 'caretaker']);
        const ids = [...new Set((staff || []).map(s => s.user_id))].filter(id => id !== msg.exceptUserId);
        if (!ids.length) return;
        const { data: subs } = await supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth').in('user_id', ids);
        const payload = JSON.stringify({ title: msg.title, body: msg.body, url: msg.url || '/dashboard', tag: msg.tag });
        await Promise.all((subs || []).map(async s => {
            try {
                await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600, urgency: 'high' });
            } catch (e: any) {
                // the phone uninstalled the app or turned notifications off: forget it
                if (e?.statusCode === 404 || e?.statusCode === 410) await supabase.from('push_subscriptions').delete().eq('id', s.id);
            }
        }));
    } catch (e: any) {
        console.error('[push]', e?.message);
    }
}

const naira = (n: unknown) => `₦${Math.round(Number(n || 0)).toLocaleString('en-NG')}`;

// "New booking" / "Room locked" notification for a booking, worded from the saved booking itself
export async function pushBooking(supabase: Db, bookingId: string) {
    const { data: b } = await supabase.from('bookings')
        .select('id, guest_name, status, total_amount, check_in, nights, created_by, booking_source, room:rooms(unit_code, name), property:properties(name)')
        .eq('id', bookingId).single();
    if (!b || b.booking_source === 'maintenance') return;
    const room = (b as any).room, prop = (b as any).property;
    const where = `${room?.unit_code || room?.name || ''}${prop?.name ? `, ${prop.name}` : ''}`;
    let who = 'Website';
    if (b.created_by) {
        const { data: u } = await supabase.auth.admin.getUserById(b.created_by);
        who = u?.user?.user_metadata?.name || (u?.user?.email || '').split('@')[0] || 'Staff';
    }
    const lock = b.status === 'pending';
    await pushToStaff(supabase, {
        title: lock ? 'Room locked (15 min)' : b.created_by ? 'New booking' : 'New website booking (paid)',
        body: `${b.created_by ? `${who}: ` : ''}${b.guest_name} · ${where} · ${b.nights} night${b.nights === 1 ? '' : 's'} from ${b.check_in} · ${naira(b.total_amount)}`,
        url: '/dashboard?tab=bookings', tag: `booking-${b.id}`, exceptUserId: b.created_by,
    });
}

export async function pushPayment(supabase: Db, bookingId: string, amount: number, method: string | null, recordedBy: string | null) {
    const { data: b } = await supabase.from('bookings').select('guest_name, room:rooms(unit_code, name), property:properties(name)').eq('id', bookingId).single();
    if (!b) return;
    const room = (b as any).room, prop = (b as any).property;
    await pushToStaff(supabase, {
        title: amount < 0 ? 'Refund recorded' : 'Payment received',
        body: `${naira(Math.abs(amount))}${method ? ` ${method}` : ''} · ${b.guest_name} · ${room?.unit_code || room?.name || ''}${prop?.name ? `, ${prop.name}` : ''}`,
        url: '/dashboard?tab=bookings', tag: `pay-${bookingId}-${Date.now()}`, exceptUserId: recordedBy,
    });
}
