import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';

export async function GET(request: NextRequest) {
    const { adminClient, error, status } = await requireAdmin();
    if (error || !adminClient) return NextResponse.json({ error }, { status });
    const supabase = adminClient;

    const { data, error: dbError } = await supabase
        .from('properties')
        .select(`
            *,
            owner:owners(id, name, email),
            caretaker:caretakers(id, name, email),
            rooms(*)
        `)
        .order('created_at', { ascending: false });

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
    return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
    const { adminClient, error: authError, status } = await requireAdmin();
    if (authError || !adminClient) return NextResponse.json({ error: authError }, { status });
    const supabase = adminClient;
    const body = await request.json();

    // Destructure known fields to avoid passing junk
    const {
        name, description, address, area, city, state, price_per_night, max_guests,
        owner_id, caretaker_id, check_in_instructions, house_rules, amenities,
        check_in_time, check_out_time,
        type, images, thumbnail,
        is_featured, category,
        minimum_stay, discount_rules,
        rooms
    } = body;

    // Validate
    if (!name || !owner_id || !price_per_night) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: property, error } = await supabase
        .from('properties')
        .insert({
            name, description, address, area, city: city || 'Lagos', state: state || 'Lagos',
            price_per_night: Number(price_per_night),
            max_guests: Number(max_guests) || 2,
            owner_id, caretaker_id: caretaker_id || null,
            check_in_instructions, house_rules, amenities,
            check_in_time, check_out_time,
            type: type || 'Entire Apartment',
            images: images || [],
            thumbnail,
            is_featured: Boolean(is_featured),
            category: category || 'standard',
            minimum_stay: minimum_stay ? Number(minimum_stay) : null,
            discount_rules: discount_rules || null,
        })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Handle rooms creation if provided
    if (rooms && rooms.length > 0) {
        const roomsToInsert = rooms.map((r: any) => ({
            property_id: property.id,
            name: r.name,
            price_per_night: Number(r.price_per_night) || Number(price_per_night),
            max_guests: Number(r.max_guests) || Number(max_guests),
            description: r.description,
            images: r.images || []
        }));

        const { error: roomError } = await supabase.from('rooms').insert(roomsToInsert);
        if (roomError) console.error('Error creating rooms:', roomError);
    } else {
        // Default Room
        await supabase.from('rooms').insert({
            property_id: property.id,
            name: 'Entire Property',
            description: 'The full property',
            price_per_night: Number(price_per_night),
            max_guests: Number(max_guests) || 2,
            images: images || [],
        });
    }

    return NextResponse.json({ data: property });
}

export async function PATCH(request: NextRequest) {
    const { adminClient, error: authError, status } = await requireAdmin();
    if (authError || !adminClient) return NextResponse.json({ error: authError }, { status });
    const supabase = adminClient;
    const body = await request.json();

    // Strip relations and ID from updates
    const { id, rooms, owner, caretaker, ...updates } = body;

    if (!id) return NextResponse.json({ error: 'Property ID required' }, { status: 400 });

    const { data, error } = await supabase
        .from('properties')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data });
}
