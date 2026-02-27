import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
    const supabase = createAdminClient();

    // Fetch all properties to extract unique areas and cities
    // Note: For large datasets, a distinct query or RPC is better, 
    // but for now, fetching 'area' and 'city' columns is sufficient.
    const { data, error } = await supabase
        .from('properties')
        .select('area, city')
        .eq('is_active', true);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Extract unique areas and cities
    const locations = new Set<string>();
    data?.forEach(p => {
        if (p.area) locations.add(p.area.trim());
        if (p.city) locations.add(p.city.trim());
    });

    return NextResponse.json({
        data: Array.from(locations).sort()
    });
}
