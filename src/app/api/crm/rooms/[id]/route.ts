import { NextRequest, NextResponse } from 'next/server';
import { requireCrm } from '@/lib/auth/require-crm';
import { z } from 'zod';

// Edit a single physical unit (e.g. Kaura "6A") straight from the calendar:
// its code, display name, nightly price, or active state.
const patchSchema = z.object({
    unitCode: z.string().trim().min(1).max(20).optional().nullable(),
    name: z.string().trim().min(1).max(80).optional(),
    pricePerNight: z.number().min(0).optional(),
    isActive: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.adminClient!;
    const { id } = await params;

    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
    const body = parsed.data;

    const update: Record<string, unknown> = {};
    if (body.unitCode !== undefined) update.unit_code = body.unitCode || null;
    if (body.name !== undefined) update.name = body.name;
    if (body.pricePerNight !== undefined) update.price_per_night = body.pricePerNight;
    if (body.isActive !== undefined) update.is_active = body.isActive;

    if (Object.keys(update).length === 0) return NextResponse.json({ success: true, unchanged: true });

    const { data, error } = await supabase.from('rooms').update(update).eq('id', id).select('id, unit_code, name, price_per_night, is_active').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, unit: data });
}
