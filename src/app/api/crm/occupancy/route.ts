import { NextRequest, NextResponse } from 'next/server';
import { requireOps } from '@/lib/auth/require-ops';
import { dailyLog } from '@/lib/booking/occupancy';

// Daily occupancy log for any date (default: today in Lagos). Staff only.
export async function GET(request: NextRequest) {
    const auth = await requireOps();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const sp = new URL(request.url).searchParams;
    const lagosToday = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.get('date') || '') ? sp.get('date')! : lagosToday;
    return NextResponse.json(await dailyLog(auth.adminClient, date, sp.get('propertyId')));
}
