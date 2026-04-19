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

// GET — fetch current profile (name, username, email, phone)
export async function GET() {
    const authClient = await createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = getServiceSupabase();

    const { data: caretaker } = await supabase
        .from('caretakers')
        .select('name, username, email, phone')
        .eq('id', user.id)
        .single();

    if (caretaker) return NextResponse.json({ ...caretaker, role: 'caretaker' });

    const { data: owner } = await supabase
        .from('owners')
        .select('name, username, email, phone')
        .eq('user_id', user.id)
        .single();

    if (owner) return NextResponse.json({ ...owner, role: 'owner' });

    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
}

// PATCH — update email and/or phone on the user's own profile
export async function PATCH(request: NextRequest) {
    const authClient = await createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { email, phone } = body;

    if (email !== undefined && email !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const updates: Record<string, string | null> = {};
    if (email !== undefined) updates.email = email?.trim() || null;
    if (phone !== undefined) updates.phone = phone?.trim() || null;

    const { data: caretaker } = await supabase
        .from('caretakers')
        .select('id')
        .eq('id', user.id)
        .single();

    if (caretaker) {
        const { error } = await supabase.from('caretakers').update(updates).eq('id', user.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        if (updates.email !== undefined) {
            await supabase.auth.admin.updateUserById(user.id, {
                user_metadata: { ...user.user_metadata, real_email: updates.email },
            });
        }
        return NextResponse.json({ success: true });
    }

    const { data: owner } = await supabase
        .from('owners')
        .select('id')
        .eq('user_id', user.id)
        .single();

    if (owner) {
        const { error } = await supabase.from('owners').update(updates).eq('user_id', user.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        if (updates.email !== undefined) {
            await supabase.auth.admin.updateUserById(user.id, {
                user_metadata: { ...user.user_metadata, real_email: updates.email },
            });
        }
        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
}
