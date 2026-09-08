import { NextRequest, NextResponse } from 'next/server';
import { requireCrm } from '@/lib/auth/require-crm';
import { blockSchema, setBlock, opsResponse } from '@/lib/booking/crm-ops';

// Block (or clear) a range of dates on a unit for cleaning/maintenance.
export async function POST(request: NextRequest) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const parsed = blockSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

    return opsResponse(await setBlock(auth.adminClient!, parsed.data));
}
