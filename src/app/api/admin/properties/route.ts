import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

// Admin: Full property CRUD with room management
export async function POST(request: NextRequest) {
    try {
        const supabase = getAdminSupabase();
        const body = await request.json();

        const {
            name, description, address, city, state, area,
            price_per_night, amenities, images, max_guests,
            check_in_time, check_out_time, check_in_instructions,
            house_rules, owner_id, caretaker_id, rooms,
        } = body;

        if (!name || !owner_id || !price_per_night) {
            return NextResponse.json({ error: 'Name, owner, and price are required' }, { status: 400 });
        }

        // 1. Create property
        const { data: property, error: propError } = await supabase
            .from('properties')
            .insert({
                name,
                description: description || null,
                address: address || null,
                city: city || 'Lagos',
                state: state || 'Lagos',
                area: area || null,
                price_per_night,
                amenities: amenities || [],
                images: images || [],
                max_guests: max_guests || 2,
                check_in_time: check_in_time || '2:00 PM',
                check_out_time: check_out_time || '11:00 AM',
                check_in_instructions: check_in_instructions || null,
                house_rules: house_rules || null,
                owner_id,
                caretaker_id: caretaker_id || null,
            })
            .select()
            .single();

        if (propError) {
            return NextResponse.json({ error: propError.message }, { status: 500 });
        }

        // 2. Create rooms if provided
        if (rooms && Array.isArray(rooms) && rooms.length > 0) {
            const roomInserts = rooms.map((room: any) => ({
                property_id: property.id,
                name: room.name,
                description: room.description || null,
                price_per_night: room.price_per_night || null,
                max_guests: room.max_guests || 2,
                images: room.images || [],
            }));

            await supabase.from('rooms').insert(roomInserts);
        } else {
            // Default: create a single "Entire Property" room
            await supabase.from('rooms').insert({
                property_id: property.id,
                name: 'Entire Property',
                description: 'The full property',
                price_per_night: price_per_night,
                max_guests: max_guests || 2,
            });
        }

        return NextResponse.json({ success: true, property });
    } catch (error) {
        console.error('Property creation error:', error);
        return NextResponse.json({ error: 'Failed to create property' }, { status: 500 });
    }
}

// List all properties with owner + caretaker info
export async function GET() {
    try {
        const supabase = getAdminSupabase();

        const { data } = await supabase
            .from('properties')
            .select('*, owner:owners(id, name, email), caretaker:caretakers(id, name, email), rooms(id, name, price_per_night)')
            .order('created_at', { ascending: false });

        return NextResponse.json({ data });
    } catch (error) {
        console.error('Property list error:', error);
        return NextResponse.json({ error: 'Failed to list properties' }, { status: 500 });
    }
}

// Update a property
export async function PATCH(request: NextRequest) {
    try {
        const supabase = getAdminSupabase();
        const body = await request.json();
        const { id, rooms, owner, caretaker, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Property ID required' }, { status: 400 });
        }

        const { error } = await supabase
            .from('properties')
            .update(updates)
            .eq('id', id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Property update error:', error);
        return NextResponse.json({ error: 'Failed to update property' }, { status: 500 });
    }
}
