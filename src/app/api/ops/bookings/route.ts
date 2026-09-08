import { NextRequest, NextResponse } from 'next/server';
import { requireOps, canAccessProperty } from '@/lib/auth/require-ops';
import { listBookings, opsResponse } from '@/lib/booking/crm-ops';

// Booking search for the operations surface. Same query as the CRM
// reservations list, hard-scoped to the caller's properties.
export async function GET(request: NextRequest) {
    const auth = await requireOps();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const sp = new URL(request.url).searchParams;
    const propertyId = sp.get('propertyId');
    if (propertyId && !canAccessProperty(auth, propertyId)) {
        return NextResponse.json({ error: 'Forbidden: not your property' }, { status: 403 });
    }

    const result = await listBookings(auth.adminClient, {
        q: sp.get('q'),
        status: sp.get('status'),
        propertyId,
        propertyIds: auth.propertyIds,
        from: sp.get('from'),
        to: sp.get('to'),
        outFrom: sp.get('outFrom'),
        outTo: sp.get('outTo'),
        sort: sp.get('sort'),
        activeOnly: sp.get('activeOnly') === '1',
        limit: Number(sp.get('limit') || 100),
    });
    return opsResponse(result);
}
