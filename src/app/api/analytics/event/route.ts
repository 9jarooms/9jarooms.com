import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
    try {
        const { event_type, property_id } = await request.json();
        if (!event_type) return NextResponse.json({ ok: false }, { status: 400 });

        const supabase = createAdminClient();
        await supabase.from('property_events').insert({ event_type, property_id: property_id || null });

        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}
