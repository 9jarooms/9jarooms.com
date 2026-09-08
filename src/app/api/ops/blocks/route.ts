import { NextRequest, NextResponse } from 'next/server';
import { requireOps, canAccessProperty } from '@/lib/auth/require-ops';
import { blockSchema, setBlock, opsResponse } from '@/lib/booking/crm-ops';

// Block a unit for cleaning / maintenance, or clear a block.
export async function POST(request: NextRequest) {
    const auth = await requireOps();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const parsed = blockSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

    const { data: room } = await auth.adminClient
        .from('rooms')
        .select('property_id')
        .eq('id', parsed.data.roomId)
        .maybeSingle();
    if (!room) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    if (!canAccessProperty(auth, room.property_id)) {
        return NextResponse.json({ error: 'Forbidden: not your property' }, { status: 403 });
    }

    return opsResponse(await setBlock(auth.adminClient, parsed.data));
}
