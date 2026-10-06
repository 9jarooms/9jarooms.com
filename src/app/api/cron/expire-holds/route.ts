import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { releaseExpiredHolds } from '@/lib/booking/claim';

// Daily tidy-up (vercel.json → crons). Correctness does not depend on it:
// every claim releases lapsed holds inline first. This just keeps the
// bookings table honest for reporting. Vercel sends
// `Authorization: Bearer $CRON_SECRET` when that variable is set.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const secret = process.env.CRON_SECRET;
    if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const expired = await releaseExpiredHolds(createAdminClient());
        return NextResponse.json({ ok: true, expired: expired.length });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e?.message || 'failed' }, { status: 500 });
    }
}
