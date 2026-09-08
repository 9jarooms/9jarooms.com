import { NextRequest, NextResponse } from 'next/server';
import { requireCrm } from '@/lib/auth/require-crm';
import { listBookings, opsResponse } from '@/lib/booking/crm-ops';

// Reservations list with search + filters
export async function GET(request: NextRequest) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const sp = new URL(request.url).searchParams;
    const result = await listBookings(auth.adminClient!, {
        q: sp.get('q'),
        status: sp.get('status'),
        propertyId: sp.get('propertyId'),
        from: sp.get('from'),
        to: sp.get('to'),
        outFrom: sp.get('outFrom'), // check_out >= (departures view)
        outTo: sp.get('outTo'),     // check_out <=
        sort: sp.get('sort'),       // 'check_in' | 'check_out' | default created_at
        activeOnly: sp.get('activeOnly') === '1',
        limit: Number(sp.get('limit') || 100),
    });
    return opsResponse(result);
}
