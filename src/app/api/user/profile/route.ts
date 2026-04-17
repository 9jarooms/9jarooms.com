import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/lib/supabase/auth';
import { createClient } from '@supabase/supabase-js';

function getServiceSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

// GET — fetch current profile (name, username, email)
export async function GET() {
    const authClient = await createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = getServiceSupabase();

    // Try caretaker first, then owner
    const { data: caretaker } = await supabase
        .from('caretakers')
        .select('name, username, email')
        .eq('id', user.id)
        .single();

    if (caretaker) return NextResponse.json({ ...caretaker, role: 'caretaker' });

    const { data: owner } = await supabase
        .from('owners')
        .select('name, username, email')
        .eq('user_id', user.id)
        .single();

    if (owner) return NextResponse.json({ ...owner, role: 'owner' });

    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
}

// PATCH — update optional email on the user's own profile
export async function PATCH(request: NextRequest) {
    const authClient = await createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { email } = await request.json();
    if (email !== undefined && email !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const newEmail = email?.trim() || null;

    // Try caretaker
    const { data: caretaker } = await supabase
        .from('caretakers')
        .select('id')
        .eq('id', user.id)
        .single();

    if (caretaker) {
        const { error } = await supabase
            .from('caretakers')
            .update({ email: newEmail })
            .eq('id', user.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // Keep auth metadata in sync
        await supabase.auth.admin.updateUserById(user.id, {
            user_metadata: { ...user.user_metadata, real_email: newEmail },
        });

        return NextResponse.json({ success: true });
    }

    // Try owner
    const { data: owner } = await supabase
        .from('owners')
        .select('id')
        .eq('user_id', user.id)
        .single();

    if (owner) {
        const { error } = await supabase
            .from('owners')
            .update({ email: newEmail })
            .eq('user_id', user.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        await supabase.auth.admin.updateUserById(user.id, {
            user_metadata: { ...user.user_metadata, real_email: newEmail },
        });

        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
}
