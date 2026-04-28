import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET() {
    try {
        const supabase = createAdminClient();

        const since = new Date();
        since.setDate(since.getDate() - 30);
        const sinceISO = since.toISOString();

        const { data, error } = await supabase
            .from('property_events')
            .select('event_type, property_id, created_at')
            .gte('created_at', sinceISO);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        const events = data || [];

        // Overall funnel counts
        const counts: Record<string, number> = {
            page_view: 0,
            dates_selected: 0,
            whatsapp_click: 0,
            call_click: 0,
        };
        events.forEach(e => {
            if (counts[e.event_type] !== undefined) counts[e.event_type]++;
        });

        // Per-property breakdown
        const byProperty: Record<string, Record<string, number>> = {};
        events.forEach(e => {
            const pid = e.property_id || 'unknown';
            if (!byProperty[pid]) byProperty[pid] = {};
            byProperty[pid][e.event_type] = (byProperty[pid][e.event_type] || 0) + 1;
        });

        // Daily trend (last 14 days)
        const dailyCounts: Record<string, number> = {};
        for (let i = 13; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            dailyCounts[d.toISOString().split('T')[0]] = 0;
        }
        events.filter(e => e.event_type === 'page_view').forEach(e => {
            const day = e.created_at.split('T')[0];
            if (dailyCounts[day] !== undefined) dailyCounts[day]++;
        });

        return NextResponse.json({ counts, byProperty, dailyCounts });
    } catch {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
