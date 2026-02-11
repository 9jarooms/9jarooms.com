import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Update availability status for a specific room + date
// Using untyped client to avoid complex Supabase type resolution issues
export async function POST(request: NextRequest) {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        const body = await request.json();
        const roomId = body.roomId as string;
        const date = body.date as string;
        const status = body.status as string;

        if (!roomId || !date || !status) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const validStatuses = ['available', 'cleaning', 'maintenance'];
        if (!validStatuses.includes(status)) {
            return NextResponse.json({ error: 'Invalid status. Cannot manually set booked/held.' }, { status: 400 });
        }

        // Check if record exists
        const { data: existing } = await supabase
            .from('availability')
            .select('id')
            .eq('room_id', roomId)
            .eq('date', date)
            .single();

        if (existing) {
            const { error } = await supabase
                .from('availability')
                .update({ status })
                .eq('room_id', roomId)
                .eq('date', date);

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }
        } else {
            const { error } = await supabase
                .from('availability')
                .insert({ room_id: roomId, date, status });

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Availability update error:', error);
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }
}
