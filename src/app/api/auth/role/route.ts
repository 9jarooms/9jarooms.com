import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const supabase = createServerClient();

    // Check for Authorization header first (more reliable for API calls directly after login)
    const authHeader = request.headers.get('Authorization');
    let user = null;

    if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user: authUser }, error } = await supabase.auth.getUser(token);
        if (!error) user = authUser;
    } else {
        // Fallback to cookies
        const { data: { user: authUser }, error } = await supabase.auth.getUser();
        if (!error) user = authUser;
    }

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use Service Role Client to fetch roles (Bypasses RLS)
    // createServerClient uses the service role key internally
    const { data: roles, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

    if (roleError) {
        console.error('Role Fetch Error:', roleError);
        return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
    }

    // Determine highest privilege role
    const roleList = roles.map(r => r.role);
    let finalRole = 'guest';
    if (roleList.includes('admin')) finalRole = 'admin';
    else if (roleList.includes('owner')) finalRole = 'owner';
    else if (roleList.includes('caretaker')) finalRole = 'caretaker';

    return NextResponse.json({ role: finalRole, roles: roleList });
}
