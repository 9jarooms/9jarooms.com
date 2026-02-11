import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface Props {
    params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Props) {
    try {
        const { id } = await params;

        // Using untyped client to avoid Supabase type resolution issues
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        const body = await request.json();
        const { check_in_instructions, house_rules } = body;

        const { error } = await supabase
            .from('properties')
            .update({ check_in_instructions, house_rules })
            .eq('id', id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Property settings update error:', error);
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }
}
