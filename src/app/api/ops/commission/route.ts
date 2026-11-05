import { NextRequest, NextResponse } from 'next/server';
import { requireCrm } from '@/lib/auth/require-crm';
import { commissionMonth, currentMonth, isMonth, COMMISSION_RATE, MONTHLY_CAP, SPECIAL_THRESHOLD, SPECIAL_PAYOUT } from '@/lib/commission';

// "My earnings": the signed-in staff member's commission for a month.
export async function GET(request: NextRequest) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const m = new URL(request.url).searchParams.get('month');
    const month = isMonth(m) ? m : currentMonth();
    const [me] = await commissionMonth(auth.adminClient!, month, auth.user!.id);
    return NextResponse.json({
        month, me,
        rules: { rate: COMMISSION_RATE, cap: MONTHLY_CAP, specialThreshold: SPECIAL_THRESHOLD, specialPayout: SPECIAL_PAYOUT },
    });
}
