import { NextRequest, NextResponse } from 'next/server';
import { requireCrm } from '@/lib/auth/require-crm';
import { z } from 'zod';

// List all live properties with room types + unit counts
export async function GET() {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.adminClient!;

    const { data: properties, error } = await supabase
        .from('properties')
        .select('id, name, area, city, price_per_night, is_active, is_apartment, max_guests, thumbnail, images, created_at')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const ids = (properties || []).map(p => p.id);
    const [{ data: types }, { data: rooms }] = await Promise.all([
        ids.length
            ? supabase.from('room_types').select('id, property_id, name, price_per_night, is_active, sort_order').in('property_id', ids).order('sort_order')
            : Promise.resolve({ data: [] as any[] }),
        ids.length
            ? supabase.from('rooms').select('id, property_id, room_type_id, unit_code, name, is_active').in('property_id', ids)
            : Promise.resolve({ data: [] as any[] }),
    ]);

    return NextResponse.json({
        properties: (properties || []).map(p => ({
            ...p,
            roomTypes: (types || []).filter(t => t.property_id === p.id).map(t => ({
                ...t,
                unitCount: (rooms || []).filter(r => r.room_type_id === t.id && r.is_active).length,
            })),
            unitCount: (rooms || []).filter(r => r.property_id === p.id && r.is_active).length,
        })),
    });
}

const createSchema = z.object({
    name: z.string().trim().min(3).max(120),
    area: z.string().trim().min(2).max(80),
    city: z.string().trim().min(2).max(80).default('Abuja'),
    state: z.string().trim().max(80).default('FCT'),
    address: z.string().trim().max(200).optional().nullable(),
    description: z.string().max(3000).optional().nullable(),
    pricePerNight: z.number().positive(),
    maxGuests: z.number().int().min(1).max(30).default(2),
    ownerId: z.string().uuid().optional().nullable(),
    // optional room types created alongside, each with N pooled units
    roomTypes: z.array(z.object({
        name: z.string().trim().min(2).max(80),
        description: z.string().max(500).optional().nullable(),
        pricePerNight: z.number().positive(),
        units: z.number().int().min(1).max(50),
    })).optional(),
});

// Create a property (optionally with room types + units in one go)
export async function POST(request: NextRequest) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.adminClient!;

    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
    }
    const body = parsed.data;

    // Default owner: first owner on file (single-operator setup) unless given
    let ownerId = body.ownerId;
    if (!ownerId) {
        const { data: firstOwner } = await supabase.from('owners').select('id').order('created_at').limit(1).single();
        ownerId = firstOwner?.id;
    }
    if (!ownerId) return NextResponse.json({ error: 'No owner found — create an owner first' }, { status: 400 });

    const { data: property, error } = await supabase
        .from('properties')
        .insert({
            name: body.name,
            area: body.area,
            city: body.city,
            state: body.state,
            address: body.address || null,
            description: body.description || null,
            price_per_night: body.pricePerNight,
            max_guests: body.maxGuests,
            owner_id: ownerId,
            is_active: true,
            is_deleted: false,
            is_apartment: false,
        })
        .select()
        .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    for (const [i, t] of (body.roomTypes || []).entries()) {
        const { data: type, error: typeError } = await supabase
            .from('room_types')
            .insert({
                property_id: property.id,
                name: t.name,
                description: t.description || null,
                price_per_night: t.pricePerNight,
                max_guests: body.maxGuests,
                sort_order: i + 1,
            })
            .select()
            .single();
        if (typeError) return NextResponse.json({ error: typeError.message }, { status: 500 });

        const letter = letters[i] || `T${i + 1}`;
        const units = Array.from({ length: t.units }, (_, n) => ({
            property_id: property.id,
            room_type_id: type.id,
            unit_code: `${letter}${n + 1}`,
            name: `Unit ${letter}${n + 1}`,
            price_per_night: t.pricePerNight,
            max_guests: body.maxGuests,
            is_active: true,
        }));
        const { error: unitsError } = await supabase.from('rooms').insert(units);
        if (unitsError) return NextResponse.json({ error: unitsError.message }, { status: 500 });
    }

    // No room types given -> one bookable room so the listing works
    if (!body.roomTypes || body.roomTypes.length === 0) {
        await supabase.from('rooms').insert({
            property_id: property.id,
            name: 'Entire Property',
            price_per_night: body.pricePerNight,
            max_guests: body.maxGuests,
            is_active: true,
        });
    }

    return NextResponse.json({ success: true, property });
}

const patchSchema = z.object({
    propertyId: z.string().uuid(),
    isActive: z.boolean().optional(),
    name: z.string().trim().min(3).max(120).optional(),
    pricePerNight: z.number().positive().optional(),
    description: z.string().max(3000).optional().nullable(),
});

export async function PATCH(request: NextRequest) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.adminClient!;

    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    const body = parsed.data;

    const update: Record<string, unknown> = {};
    if (body.isActive !== undefined) update.is_active = body.isActive;
    if (body.name !== undefined) update.name = body.name;
    if (body.pricePerNight !== undefined) update.price_per_night = body.pricePerNight;
    if (body.description !== undefined) update.description = body.description;

    const { error } = await supabase.from('properties').update(update).eq('id', body.propertyId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
