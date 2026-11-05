import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrm } from '@/lib/auth/require-crm';
import { commissionMonth, currentMonth, isMonth, payableFor } from '@/lib/commission';
import { staffDirectory, displayName, usernameOf } from '@/lib/staff-names';

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
        const s = summaries.find(x => x.userId === id) || { userId: id, month, lines: [], bookings: 0, calculated: 0, verified: 0, pending: 0, payable: 0, special: false, paidOut: null };
        return { ...s, name: displayName(u), username: usernameOf(u?.email), roles: dir.roles.filter(r => r.user_id === id).map(r => r.role), banned: !!(u as any)?.banned_until };
    }).filter(s => s.lines.length || (!s.banned && s.roles.length))
        .sort((a, b) => b.calculated - a.calculated || a.name.localeCompare(b.name));
    return NextResponse.json({ month, staff });
}

// verify / reject / un-check booking lines
const checkSchema = z.object({ bookingIds: z.array(z.string().uuid()).min(1).max(500), status: z.enum(['verified', 'rejected']).nullable() });
export async function PATCH(request: NextRequest) {
    const { auth, res } = await admin();
    if (!auth) return res;
    const parsed = checkSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    const { bookingIds, status } = parsed.data;
    const { error } = await auth.adminClient!.from('bookings').update({
        commission_status: status, commission_checked_by: status ? auth.user!.id : null, commission_checked_at: status ? new Date().toISOString() : null,
    }).in('id', bookingIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}

// change who took a booking (e.g. one entered under a shared account)
const takenBySchema = z.object({ bookingId: z.string().uuid(), userId: z.string().uuid().nullable() });
export async function PUT(request: NextRequest) {
    const { auth, res } = await admin();
    if (!auth) return res;
    const parsed = takenBySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    const { error } = await auth.adminClient!.from('bookings')
        .update({ created_by: parsed.data.userId, commission_status: null, commission_checked_by: null, commission_checked_at: null })
        .eq('id', parsed.data.bookingId);
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
    if (undo) {
        await supabase.from('commission_payouts').delete().eq('user_id', userId).eq('month', month);
        return NextResponse.json({ success: true });
    }
    const [s] = await commissionMonth(supabase, month, userId);
    const amount = payableFor(s?.verified || 0).payable;
    if (amount <= 0) return NextResponse.json({ error: 'Nothing verified to pay for this month' }, { status: 400 });
    const { error } = await supabase.from('commission_payouts')
        .upsert({ user_id: userId, month, amount, paid_by: auth.user!.id, paid_at: new Date().toISOString() }, { onConflict: 'user_id,month' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, amount });
}
