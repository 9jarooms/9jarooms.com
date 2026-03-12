import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';

export async function POST(request: NextRequest) {
    const { adminClient, error: authError, status: authStatus } = await requireAdmin();
    if (authError || !adminClient) return NextResponse.json({ error: authError }, { status: authStatus });
    const supabase = adminClient;
    
    const body = await request.json();
    const { property_id, check_in, check_out } = body;

    if (!property_id || !check_in || !check_out) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // A block requires a room. Get the first room for this property.
    const { data: properties, error: dbError } = await supabase
        .from('properties')
        .select('rooms(id)')
        .eq('id', property_id)
        .single();
        
    if (dbError || !properties || !properties.rooms || properties.rooms.length === 0) {
        return NextResponse.json({ error: 'Failed to find a room for this property' }, { status: 404 });
    }

    const room_id = properties.rooms[0].id;

    const { data, error } = await supabase
        .from('bookings')
        .insert({
            room_id,
            property_id,
            guest_name: 'Admin Block',
            guest_email: 'admin@9jarooms.com',
            check_in,
            check_out,
            nights: Math.ceil((new Date(check_out).getTime() - new Date(check_in).getTime()) / (1000 * 60 * 60 * 24)),
            price_per_night: 0,
            total_amount: 0,
            status: 'confirmed',
            notes: 'Dates blocked by admin for drafted property.'
        })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
}
