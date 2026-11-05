import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createSessionClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
    // 1. Verify the user is authenticated using the session client
    const sessionSupabase = await createSessionClient();
    // getUser checks the token with Supabase (getSession only trusts the cookie)
    const { data: { user: session_user }, error: authError } = await sessionSupabase.auth.getUser();
    const session = session_user ? { user: session_user } : null;

    if (authError || !session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Use admin client to bypass RLS and fetch this user's bookings
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('bookings')
        .select(`
            *,
            property:properties(name, city, area, thumbnail),
            room:rooms(name)
        `)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
}
