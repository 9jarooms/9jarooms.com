import type { createAdminClient } from '@/lib/supabase/server';
import { paidByBooking } from '@/lib/booking/crm-ops';

// Staff commission (announcement of 1 Nov 2026):
//  - 1.5% of the whole stay on every booking a staff member takes on the platform (bookings.created_by)
//  - it counts once the booking is closed: not cancelled/expired, and paid in full
//  - only lines management has verified are paid; a rejected line never counts
//  - monthly cap ₦200,000; ₦500,000+ calculated in a month pays a special ₦300,000 instead
//  - paid on the last calendar day of the month
// The month of a booking is the Lagos month it was taken in.

type Db = ReturnType<typeof createAdminClient>;

export const COMMISSION_RATE = 0.015;
export const MONTHLY_CAP = 200_000;
export const SPECIAL_THRESHOLD = 500_000;
export const SPECIAL_PAYOUT = 300_000;
export const COMMISSION_START = '2026-11';
const OPEN = ['confirmed', 'paid', 'checked_in', 'completed'];

export type LineState = 'awaiting_payment' | 'to_verify' | 'verified' | 'rejected';
export interface CommissionLine {
    bookingId: string; guest: string; unit: string; property: string;
    checkIn: string; checkOut: string; nights: number; takenAt: string;
    total: number; paid: number; commission: number; state: LineState;
}
export interface CommissionSummary {
    userId: string; month: string;
    lines: CommissionLine[];
    bookings: number;
    calculated: number;     // 1.5% of every closed line not rejected
    verified: number;       // of which management has verified
    pending: number;        // 1.5% of lines still waiting for full payment
    payable: number;        // what the verified lines pay this month after the cap / special rule
    special: boolean;       // reached the ₦500k special payout
    paidOut: { amount: number; paidAt: string } | null;
}

export const currentMonth = () => new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 7);   // Lagos
export const isMonth = (m: string | null | undefined): m is string => !!m && /^\d{4}-\d{2}$/.test(m);

// Lagos month → UTC range of created_at
function monthRange(month: string) {
    const [y, m] = month.split('-').map(Number);
    const from = new Date(Date.UTC(y, m - 1, 1) - 60 * 60 * 1000).toISOString();
    const to = new Date(Date.UTC(y, m, 1) - 60 * 60 * 1000).toISOString();
    return { from, to };
}

export function payableFor(amount: number) {
    if (amount >= SPECIAL_THRESHOLD) return { payable: SPECIAL_PAYOUT, special: true };
    return { payable: Math.min(amount, MONTHLY_CAP), special: false };
}

const round = (n: number) => Math.round(n);

// Every staff member's month (or one person's when userId is given)
export async function commissionMonth(supabase: Db, month: string, userId?: string): Promise<CommissionSummary[]> {
    const { from, to } = monthRange(month);
    let q = supabase.from('bookings')
        .select('id, created_by, guest_name, check_in, check_out, nights, total_amount, status, created_at, commission_status, room:rooms(unit_code, name), property:properties(name)')
        .not('created_by', 'is', null).gte('created_at', from).lt('created_at', to).in('status', OPEN)
        .order('created_at', { ascending: false });
    if (userId) q = q.eq('created_by', userId);
    const { data: rows } = await q;
    const list = (rows || []) as any[];
    const paid = await paidByBooking(supabase, list);

    let pq = supabase.from('commission_payouts').select('user_id, amount, paid_at').eq('month', month);
    if (userId) pq = pq.eq('user_id', userId);
    const { data: payouts } = await pq;

    const byUser = new Map<string, CommissionLine[]>();
    for (const b of list) {
        const total = Number(b.total_amount || 0), p = paid[b.id] || 0;
        const state: LineState = b.commission_status === 'rejected' ? 'rejected'
            : p + 1 < total ? 'awaiting_payment'
                : b.commission_status === 'verified' ? 'verified' : 'to_verify';
        const line: CommissionLine = {
            bookingId: b.id, guest: b.guest_name, unit: b.room?.unit_code || b.room?.name || '—', property: b.property?.name || '',
            checkIn: b.check_in, checkOut: b.check_out, nights: b.nights, takenAt: b.created_at,
            total, paid: p, commission: round(total * COMMISSION_RATE), state,
        };
        byUser.set(b.created_by, [...(byUser.get(b.created_by) || []), line]);
    }
    if (userId && !byUser.has(userId)) byUser.set(userId, []);

    return [...byUser.entries()].map(([uid, lines]) => {
        const sum = (s: LineState[]) => lines.filter(l => s.includes(l.state)).reduce((t, l) => t + l.commission, 0);
        const calculated = sum(['to_verify', 'verified']);
        const verified = sum(['verified']);
        const { payable, special } = payableFor(verified);
        const po = (payouts || []).find(x => x.user_id === uid);
        return {
            userId: uid, month, lines, bookings: lines.filter(l => l.state !== 'rejected').length,
            calculated, verified, pending: sum(['awaiting_payment']), payable, special: special || calculated >= SPECIAL_THRESHOLD,
            paidOut: po ? { amount: Number(po.amount), paidAt: po.paid_at } : null,
        };
    });
}
