import { NextRequest, NextResponse } from 'next/server';
import { requireCrm } from '@/lib/auth/require-crm';
import { bookingUpdateSchema, getBookingDetail, updateBooking, opsResponse } from '@/lib/booking/crm-ops';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { id } = await params;
    return opsResponse(await getBookingDetail(auth.adminClient!, id));
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { id } = await params;

    const parsed = bookingUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
    }

    return opsResponse(await updateBooking(auth.adminClient!, id, parsed.data, auth.user!.id));
}
