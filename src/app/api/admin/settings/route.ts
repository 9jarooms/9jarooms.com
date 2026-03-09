import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';

export async function GET() {
    const { adminClient, error: reqError, status } = await requireAdmin();
    if (reqError || !adminClient) return NextResponse.json({ error: reqError }, { status });
    const supabase = adminClient;
    const { data, error } = await supabase
        .from('site_settings')
        .select('key, value');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Convert rows to a flat object { key: value }
    const settings: Record<string, any> = {};
    for (const row of data || []) {
        settings[row.key] = row.value;
    }
    return NextResponse.json({ data: settings });
}

export async function PATCH(request: NextRequest) {
    const { adminClient, error: reqError, status } = await requireAdmin();
    if (reqError || !adminClient) return NextResponse.json({ error: reqError }, { status });
    const supabase = adminClient;
    const body = await request.json();
    const { key, value } = body;

    if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });

    const { data, error } = await supabase
        .from('site_settings')
        .upsert({ key, value }, { onConflict: 'key' })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
}
