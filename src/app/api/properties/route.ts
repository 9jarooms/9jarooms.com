import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// Get properties with optional filtering
export async function GET(request: NextRequest) {
    try {
        const supabase = createServerClient();
        const { searchParams } = new URL(request.url);

        const area = searchParams.get('area');
        const city = searchParams.get('city');
        const minPrice = searchParams.get('minPrice');
        const maxPrice = searchParams.get('maxPrice');
        const maxGuests = searchParams.get('maxGuests');

        let query = supabase
            .from('properties')
            .select('*, rooms(*), owner:owners(name, paystack_subaccount_code)')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (area) query = query.ilike('area', `%${area}%`);
        if (city) query = query.ilike('city', `%${city}%`);
        if (minPrice) query = query.gte('price_per_night', parseFloat(minPrice));
        if (maxPrice) query = query.lte('price_per_night', parseFloat(maxPrice));
        if (maxGuests) query = query.gte('max_guests', parseInt(maxGuests));

        const { data, error } = await query;

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ properties: data });
    } catch (error) {
        console.error('Properties fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch properties' }, { status: 500 });
    }
}
