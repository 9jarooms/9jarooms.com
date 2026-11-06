import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

// Anonymous funnel events from the listing page. Known event names and a real property id only, so
// nobody can fill the database through this door.
const EVENTS = new Set(['page_view', 'dates_selected', 'whatsapp_click', 'call_click']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const recent = new Map<string, { n: number; until: number }>();

export async function POST(request: NextRequest) {
    try {
        if (Number(request.headers.get('content-length') || 0) > 1024) return NextResponse.json({ ok: false }, { status: 413 });
        const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
        const now = Date.now();
        const r = recent.get(ip);
        if (r && r.until > now) { if (++r.n > 60) return NextResponse.json({ ok: false }, { status: 429 }); }
        else { if (recent.size > 5000) recent.clear(); recent.set(ip, { n: 1, until: now + 60_000 }); }

        const { event_type, property_id } = await request.json();
        if (!EVENTS.has(event_type) || !UUID.test(String(property_id || ''))) return NextResponse.json({ ok: false }, { status: 400 });
        await createAdminClient().from('property_events').insert({ event_type, property_id });
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ ok: false }, { status: 400 });
    }
}
