import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
    const supabase = createAdminClient();

    // Fetch all active properties with their rooms
    const { data, error } = await supabase
        .from('properties')
        .select('id, rooms(id)')
        .eq('is_active', true);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Count rooms per property and extract unique bedroom counts
    const bedroomCounts = new Set<number>();
    data?.forEach(p => {
        const roomCount = (p.rooms as any[])?.length || 0;
        if (roomCount > 0) {
            bedroomCounts.add(roomCount);
        }
    });

    return NextResponse.json({
        data: Array.from(bedroomCounts).sort((a, b) => a - b)
    });
}
