import { NextRequest, NextResponse } from 'next/server';
import { requireCrm } from '@/lib/auth/require-crm';
import { staffDirectory, displayName } from '@/lib/staff-names';

// Everything that happened, newest first: bookings and locks made, money in and out, check-ins and
// check-outs, cancellations, price changes, payments removed and locks that ran out, with who did it.
export interface ActivityEvent {
    id: string; at: string; kind: 'booking' | 'lock' | 'hold' | 'payment' | 'refund' | 'checkin' | 'checkout' | 'cancel' | 'change' | 'lapsed' | 'online';
    who: string; text: string; detail?: string; amount?: number; bookingId?: string;
    by?: string | null;   // the staff user who did it (so their own phone does not alert them)
}

const BOOKING = 'id, guest_name, status, total_amount, booking_source, check_in, check_out, nights, created_at, created_by, checked_in_at, checked_out_at, expires_at, room:rooms(unit_code, name), property:properties(name)';

export async function GET(request: NextRequest) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.adminClient!;
    const days = Math.min(Math.max(Number(new URL(request.url).searchParams.get('days')) || 3, 1), 31);
    const since = new Date(Date.now() - days * 86_400_000).toISOString();

    const [made, ins, outs, pays, log, lapsed, dir] = await Promise.all([
        supabase.from('bookings').select(BOOKING).gte('created_at', since).order('created_at', { ascending: false }).limit(400),
        supabase.from('bookings').select(BOOKING).gte('checked_in_at', since).limit(400),
        supabase.from('bookings').select(BOOKING).gte('checked_out_at', since).limit(400),
        supabase.from('booking_payments').select(`id, amount, method, reference, paystack_reference, created_at, recorded_by, note, booking:bookings(${BOOKING})`).gte('created_at', since).limit(600),
        supabase.from('audit_log').select(`id, at, actor, action, detail, booking:bookings(${BOOKING})`).gte('at', since).order('at', { ascending: false }).limit(600),
        supabase.from('bookings').select(BOOKING).eq('status', 'expired').gte('expires_at', since).limit(200),
        staffDirectory(supabase),
    ]);

    const who = (id: string | null | undefined, fallback = 'Website guest') => id ? displayName(dir.byId.get(id)) : fallback;
    const where = (b: any) => b ? `${b.room?.unit_code || b.room?.name || ''}${b.property?.name ? `, ${b.property.name}` : ''}` : '';
    const stay = (b: any) => b ? `${fmt(b.check_in)} → ${fmt(b.check_out)} · ${b.nights} night${b.nights === 1 ? '' : 's'}` : '';
    const ev: ActivityEvent[] = [];

    for (const b of (made.data || []) as any[]) {
        if (b.booking_source === 'maintenance') continue;
        // a website guest paying right now holds the room: show it. One who left without paying is noise.
        if (!b.created_by && b.status === 'pending') {
            ev.push({ id: `hold-${b.id}`, at: b.created_at, kind: 'hold', who: '', text: `${b.guest_name} is paying on the website: ${where(b)} is held for them`, detail: stay(b), amount: Number(b.total_amount), bookingId: b.id });
            continue;
        }
        if (!b.created_by && ['expired', 'cancelled'].includes(b.status)) continue;
        const lock = b.status === 'pending' || (b.expires_at && b.status === 'expired');
        ev.push({ id: `new-${b.id}`, at: b.created_at, by: b.created_by, kind: b.created_by ? (lock ? 'lock' : 'booking') : 'online', who: b.created_by ? who(b.created_by) : '',
            text: b.created_by ? `${lock ? 'locked' : 'booked'} ${where(b)} for ${b.guest_name}` : `${b.guest_name} booked ${where(b)} on the website`,
            detail: stay(b), amount: Number(b.total_amount), bookingId: b.id });
    }
    for (const b of (ins.data || []) as any[]) ev.push({ id: `in-${b.id}`, at: b.checked_in_at, kind: 'checkin', who: '', text: `${b.guest_name} checked in to ${where(b)}`, detail: stay(b), bookingId: b.id });
    for (const b of (outs.data || []) as any[]) ev.push({ id: `out-${b.id}`, at: b.checked_out_at, kind: 'checkout', who: '', text: `${b.guest_name} checked out of ${where(b)}`, detail: stay(b), bookingId: b.id });
    for (const p of (pays.data || []) as any[]) {
        const b = p.booking, refund = Number(p.amount) < 0, online = !!p.paystack_reference;
        ev.push({ id: `pay-${p.id}`, at: p.created_at, by: p.recorded_by, kind: refund ? 'refund' : 'payment', who: online ? 'Paystack' : who(p.recorded_by, 'Someone'),
            text: refund ? `refunded ${b?.guest_name || 'a guest'}` : online ? `${b?.guest_name || 'A guest'} paid online` : `recorded ${p.method || 'a payment'} from ${b?.guest_name || 'a guest'}`,
            detail: [where(b), p.reference ? `ref ${p.reference}` : ''].filter(Boolean).join(' · '), amount: Math.abs(Number(p.amount)), bookingId: b?.id });
    }
    const LABEL: Record<string, string> = {
        cancelled: 'cancelled', no_show: 'marked as no-show', total_changed: 'changed the price for', agreed_price: 'set an agreed price for',
        payment_removed: 'removed a payment from', commission_reassigned: 'changed who took the booking of', lost_room_after_payment: 'lost the room right after payment for',
        stay_changed: 'changed the dates or room of', status_changed: 'changed the status of', source_changed: 'changed where the booking came from for',
    };
    // changes that are not about one booking (prices, listings, rooms off sale; staff and bank for admins only)
    const n2 = (x: unknown) => `₦${n(x)}`;
    const GENERAL: Record<string, (d: any) => string> = {
        price_changed: d => d.from ? `changed the price of ${d.what}: ${n2(d.from)} → ${n2(d.to)}` : `set the price of ${d.what} at ${n2(d.to)}`,
        listing_changed: d => `${d.live ? 'put' : 'took'} ${d.what} ${d.live ? 'on' : 'off'} the website`,
        room_renamed: d => `renamed room ${d.what} to ${d.to}`,
        room_blocked: d => `took ${d.room} off sale (${d.status}) for ${d.nights} night${d.nights === 1 ? '' : 's'} from ${fmt(d.from)}`,
        room_unblocked: d => `put ${d.room} back on sale from ${fmt(d.from)}`,
        maintenance_booking: d => `blocked ${d.room} for maintenance for ${d.nights} night${d.nights === 1 ? '' : 's'} from ${fmt(d.from)}`,
        rooms_added: d => `added ${d.rooms} to ${d.property}`,
        rooms_removed: d => `removed ${d.rooms} from use`,
        rooms_grouped: d => `moved ${d.rooms} into the group ${d.group}`,
        property_added: d => `added the property ${d.what}`,
        property_removed: d => `deleted the property ${d.what}`,
        listing_text_changed: d => `edited ${d.fields} of ${d.what}`,
        ...(auth.role === 'admin' ? {
            staff_added: (d: any) => `created the login ${d.username} (${d.role})`,
            staff_removed: () => 'removed a team member',
            owner_added: (d: any) => `created the owner login ${d.username}`,
            owner_changed: (d: any) => `edited owner ${d.name || ''}${d.payout ? ' (payout account changed)' : ''}`,
            password_reset: () => 'set a new password for a team member',
            bank_changed: (d: any) => `changed the bank account to ${d.bank} ending ${d.accountEnding}`,
        } : {}),
    };
    for (const l of (log.data || []) as any[]) {
        if (GENERAL[l.action]) ev.push({ id: `gen-${l.id}`, at: l.at, by: l.actor, kind: 'change', who: who(l.actor, 'System'), text: GENERAL[l.action](l.detail || {}) });
    }
    for (const l of (log.data || []) as any[]) {
        if (!LABEL[l.action]) continue;   // refunds already show as payments, commission checks stay on the Commission page
        const b = l.booking, d = l.detail || {};
        const money = ['stay_changed', 'status_changed', 'source_changed'].includes(l.action) ? `${d.from} → ${d.to}` : l.action === 'total_changed' ? `₦${n(d.from)} → ₦${n(d.to)}` : l.action === 'agreed_price' ? `standard ₦${n(d.standard)}, agreed ₦${n(d.agreed)}` : l.action === 'payment_removed' ? `₦${n(d.amount)} ${d.method || ''}` : '';
        ev.push({ id: `log-${l.id}`, at: l.at, by: l.actor, kind: ['cancelled', 'no_show'].includes(l.action) ? 'cancel' : 'change', who: who(l.actor, 'System'),
            text: `${LABEL[l.action]} ${b?.guest_name || 'a booking'}`, detail: [where(b), money].filter(Boolean).join(' · '), bookingId: b?.id });
    }
    for (const b of (lapsed.data || []) as any[]) {
        if (!b.created_by) continue;   // only staff locks (website checkouts left unpaid are not news)
        ev.push({ id: `lapse-${b.id}`, at: b.expires_at, kind: 'lapsed', who: '', text: `Lock for ${b.guest_name} on ${where(b)} ran out unpaid`, detail: stay(b), bookingId: b.id });
    }

    ev.sort((a, b) => (a.at < b.at ? 1 : -1));
    const at = (k: ActivityEvent['kind'][]) => ev.filter(e => k.includes(e.kind));
    const today = new Date(Date.now() + 3600_000).toISOString().slice(0, 10);
    const isToday = (e: ActivityEvent) => new Date(new Date(e.at).getTime() + 3600_000).toISOString().slice(0, 10) === today;
    return NextResponse.json({
        days, me: auth.user!.id, events: ev.slice(0, 500),
        today: {
            bookings: at(['booking', 'lock', 'online']).filter(isToday).length,
            money: at(['payment']).filter(isToday).reduce((t, e) => t + (e.amount || 0), 0),
            checkins: at(['checkin']).filter(isToday).length,
            checkouts: at(['checkout']).filter(isToday).length,
        },
    });
}

const n = (x: unknown) => Math.round(Number(x || 0)).toLocaleString('en-NG');
const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
