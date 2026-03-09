import { NextRequest, NextResponse } from 'next/server';
import { requirePropertyAccess } from '@/lib/auth/require-property-access';

interface Props {
    params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Props) {
    try {
        const { id } = await params;

        const { adminClient, error: authError, status } = await requirePropertyAccess(id);
        if (authError || !adminClient) return NextResponse.json({ error: authError }, { status });

        const supabase = adminClient;

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
