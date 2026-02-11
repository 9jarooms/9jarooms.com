
import { createServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
    const supabase = createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Not authenticated', details: userError }, { status: 401 });
    }

    const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id);

    return NextResponse.json({
        user: {
            id: user.id,
            email: user.email,
        },
        roles: roleData,
        roleError: roleError,
        serviceRoleKeyUsed: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    });
}
