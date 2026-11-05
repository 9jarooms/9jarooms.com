import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrm } from '@/lib/auth/require-crm';
import { commissionMonth, currentMonth, isMonth, payableFor, COMMISSION_START as START_MONTH } from '@/lib/commission';

const nextMonth = (m: string) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 7); };
import { staffDirectory, displayName, usernameOf } from '@/lib/staff-names';
import { audit } from '@/lib/booking/crm-ops';

// Management's commission desk (admins): every staff member's month, verify or reject each booking,
// fix who took a booking, and mark the month paid.
async function admin() {
    const auth = await requireCrm();
    if ('error' in auth) return { res: NextResponse.json({ error: auth.error }, { status: auth.status }) };
    if (auth.role !== 'admin') return { res: NextResponse.json({ error: 'Only an admin can manage commission' }, { status: 403 }) };
    return { auth };
}

export async function GET(request: NextRequest) {
    const { auth, res } = await admin();
    if (!auth) return res;
    const supabase = auth.adminClient!;
    const m = new URL(request.url).searchParams.get('month');
    const month = isMonth(m) ? m : currentMonth();
    const [summaries, dir] = await Promise.all([commissionMonth(supabase, month), staffDirectory(supabase)]);

    // everyone on the team appears, even with nothing yet this month
    const ids = new Set([...dir.roles.map(r => r.user_id), ...summaries.map(s => s.userId)]);
    const staff = [...ids].map(id => {
        const u = dir.byId.get(id);
        const s = summaries.find(x => x.userId === id) || { userId: id, month, lines: [], bookings: 0, calculated: 0, verified: 0, pending: 0, payable: 0, special: false, nearSpecial: false, paidOut: null, due: 0 };
        return { ...s, name: displayName(u), username: usernameOf(u?.email), roles: dir.roles.filter(r => r.user_id === id).map(r => r.role), banned: !!(u as any)?.banned_until };
    }).filter(s => s.lines.length || (!s.banned && s.roles.length))
        .sort((a, b) => b.calculated - a.calculated || a.name.localeCompare(b.name));
    const pastDue: { month: string; name: string; due: number; over: number }[] = [];
    for (let m = START_MONTH; m < currentMonth(); m = nextMonth(m)) {
        for (const x of await commissionMonth(supabase, m)) {
            const paidAmt = x.paidOut?.amount || 0;
            if (x.due > 0 || paidAmt > x.payable + 1) pastDue.push({ month: m, name: displayName(dir.byId.get(x.userId)), due: x.due, over: Math.max(paidAmt - x.payable, 0) });
        }
    }
    return NextResponse.json({ month, staff, pastDue });
}

// verify / reject / un-check booking lines
// totals = the stay total each line showed on the admin's screen: a line changed since is not verified blind
const checkSchema = z.object({ bookingIds: z.array(z.string().uuid()).min(1).max(500), status: z.enum(['verified', 'rejected']).nullable(), totals: z.record(z.string(), z.number()).optional() });
export async function PATCH(request: NextRequest) {
    const { auth, res } = await admin();
    if (!auth) return res;
    const parsed = checkSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    const { bookingIds, status } = parsed.data;
    const supabase = auth.adminClient!;
    // the amount verified is saved with the check: a later change to the stay resets the check
    const { data: rows } = await supabase.from('bookings').select('id, total_amount, created_by').in('id', bookingIds);
    // nobody approves their own commission: another admin does
    if ((rows || []).some(r => r.created_by === auth.user!.id)) {
        return NextResponse.json({ error: 'These include your own bookings. Another admin has to check your commission.' }, { status: 403 });
    }
    const changed = (rows || []).filter(r => parsed.data.totals && parsed.data.totals[r.id] != null && Math.round(parsed.data.totals[r.id]) !== Math.round(Number(r.total_amount)));
    if (changed.length) return NextResponse.json({ error: 'A booking changed since you opened this page. Reload and check again.' }, { status: 409 });
    for (const r of rows || []) {
        const { error } = await supabase.from('bookings').update({
            commission_status: status, commission_checked_by: status ? auth.user!.id : null, commission_checked_at: status ? new Date().toISOString() : null,
            commission_amount: status === 'verified' ? Math.round(Number(r.total_amount) * 0.015) : null,
        }).eq('id', r.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await audit(supabase, auth.user!.id, null, `commission_${status || 'unchecked'}`, { bookingIds });
    return NextResponse.json({ success: true });
}

// change who took a booking (e.g. one entered under a shared account)
const takenBySchema = z.object({ bookingId: z.string().uuid(), userId: z.string().uuid().nullable() });
export async function PUT(request: NextRequest) {
    const { auth, res } = await admin();
    if (!auth) return res;
    const parsed = takenBySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    const supabase = auth.adminClient!;
    if (parsed.data.userId) {
        const { count } = await supabase.from('user_roles').select('user_id', { count: 'exact', head: true })
            .eq('user_id', parsed.data.userId).in('role', ['admin', 'customer_rep', 'caretaker']);
        if (!count) return NextResponse.json({ error: 'That person is not on the team' }, { status: 400 });
    }
    const { data: before } = await supabase.from('bookings').select('created_by').eq('id', parsed.data.bookingId).single();
    const { error } = await supabase.from('bookings')
        .update({ created_by: parsed.data.userId, commission_status: null, commission_checked_by: null, commission_checked_at: null, commission_amount: null })
        .eq('id', parsed.data.bookingId);
    await audit(supabase, auth.user!.id, parsed.data.bookingId, 'commission_reassigned', { from: before?.created_by || null, to: parsed.data.userId });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}

// mark a month paid (amount = what the verified lines pay) or undo it
const payoutSchema = z.object({ userId: z.string().uuid(), month: z.string().regex(/^\d{4}-\d{2}$/), undo: z.boolean().optional() });
export async function POST(request: NextRequest) {
    const { auth, res } = await admin();
    if (!auth) return res;
    const supabase = auth.adminClient!;
    const parsed = payoutSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    const { userId, month, undo } = parsed.data;
    if (userId === auth.user!.id) return NextResponse.json({ error: 'Another admin has to pay out your own commission.' }, { status: 403 });
    if (undo) {
        // undo the most recent payment only; earlier ones stay on record
        const { data: last } = await supabase.from('commission_payouts').select('id, amount').eq('user_id', userId).eq('month', month).order('paid_at', { ascending: false }).limit(1).maybeSingle();
        if (last) {
            await supabase.from('commission_payouts').delete().eq('id', last.id);
            await audit(supabase, auth.user!.id, null, 'commission_payout_undone', { userId, month, amount: last.amount });
        }
        return NextResponse.json({ success: true });
    }
    // pay what is due now: the verified total after the cap, minus anything already paid this month
    const [s] = await commissionMonth(supabase, month, userId);
    const amount = s?.due ?? payableFor(s?.verified || 0).payable;
    if (amount <= 0) return NextResponse.json({ error: 'Nothing new to pay for this month' }, { status: 400 });
    const { error } = await supabase.from('commission_payouts')
        .insert({ user_id: userId, month, amount, paid_by: auth.user!.id, paid_at: new Date().toISOString(), note: s?.paidOut ? 'Top-up' : null });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await audit(supabase, auth.user!.id, null, 'commission_paid', { userId, month, amount });
    return NextResponse.json({ success: true, amount });
}
