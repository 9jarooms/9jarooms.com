import { NextResponse } from 'next/server';
import { createAuthClient } from '@/lib/supabase/auth';

export async function GET() {
    const supabase = await createAuthClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: properties, error } = await supabase
        .from('properties')
        .select('*, rooms(id, name, price_per_night)')
        .eq('caretaker_id', user.id)
        .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ properties: properties || [] });
}
