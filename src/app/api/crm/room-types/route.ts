import { NextRequest, NextResponse } from 'next/server';
import { requireCrm } from '@/lib/auth/require-crm';
import { z } from 'zod';

const patchSchema = z.object({
    roomTypeId: z.string().uuid(),
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().max(500).optional().nullable(),
    pricePerNight: z.number().positive().optional(),
    images: z.array(z.string().url()).max(30).optional(),
    isActive: z.boolean().optional(),
});

// Update a room type (photos, name, price)
export async function PATCH(request: NextRequest) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.adminClient!;

    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    const body = parsed.data;

    const update: Record<string, unknown> = {};
    if (body.name !== undefined) update.name = body.name;
    if (body.description !== undefined) update.description = body.description;
    if (body.pricePerNight !== undefined) update.price_per_night = body.pricePerNight;
    if (body.images !== undefined) update.images = body.images;
    if (body.isActive !== undefined) update.is_active = body.isActive;

    const { error } = await supabase.from('room_types').update(update).eq('id', body.roomTypeId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // keep unit prices in sync when the type price changes
    if (body.pricePerNight !== undefined) {
        await supabase.from('rooms').update({ price_per_night: body.pricePerNight }).eq('room_type_id', body.roomTypeId);
    }

    return NextResponse.json({ success: true });
}

const createSchema = z.object({
    propertyId: z.string().uuid(),
    name: z.string().trim().min(2).max(80),
    description: z.string().max(500).optional().nullable(),
    pricePerNight: z.number().positive(),
    units: z.number().int().min(1).max(50),
    images: z.array(z.string().url()).max(30).optional(),
});

// Add a room type (with N pooled units) to an existing property
export async function POST(request: NextRequest) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.adminClient!;

    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    const body = parsed.data;

    const { data: property } = await supabase
        .from('properties')
        .select('id, max_guests')
        .eq('id', body.propertyId)
        .single();
    if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

    const { data: siblings } = await supabase
        .from('room_types')
        .select('sort_order')
        .eq('property_id', body.propertyId)
        .order('sort_order', { ascending: false })
        .limit(1);
    const sortOrder = ((siblings?.[0]?.sort_order) || 0) + 1;

    const { data: type, error } = await supabase
        .from('room_types')
        .insert({
            property_id: body.propertyId,
            name: body.name,
            description: body.description || null,
            price_per_night: body.pricePerNight,
            max_guests: property.max_guests || 2,
            sort_order: sortOrder,
            images: body.images || [],
        })
        .select()
        .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K'];
    const letter = letters[sortOrder - 1] || `T${sortOrder}`;
    const { error: unitsError } = await supabase.from('rooms').insert(
        Array.from({ length: body.units }, (_, n) => ({
            property_id: body.propertyId,
            room_type_id: type.id,
            unit_code: `${letter}${n + 1}`,
            name: `Unit ${letter}${n + 1}`,
            price_per_night: body.pricePerNight,
            max_guests: property.max_guests || 2,
            is_active: true,
        }))
    );
    if (unitsError) return NextResponse.json({ error: unitsError.message }, { status: 500 });

    return NextResponse.json({ success: true, roomType: type });
}
