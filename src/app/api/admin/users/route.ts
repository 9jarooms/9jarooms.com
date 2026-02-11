import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

// Create a new user (owner or caretaker) via Supabase Admin API
export async function POST(request: NextRequest) {
    try {
        const supabase = getAdminSupabase();
        const body = await request.json();
        const { email, password, name, phone, role } = body;

        if (!email || !password || !name || !role) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (!['admin', 'owner', 'caretaker'].includes(role)) {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }

        // 1. Create auth user
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        });

        if (authError) {
            return NextResponse.json({ error: authError.message }, { status: 500 });
        }

        const userId = authData.user.id;

        // 2. Assign role
        await supabase.from('user_roles').insert({ user_id: userId, role });

        // 3. Create profile based on role
        if (role === 'caretaker') {
            await supabase.from('caretakers').insert({
                id: userId,
                name,
                email,
                phone: phone || null,
            });
        } else if (role === 'owner') {
            await supabase.from('owners').insert({
                user_id: userId,
                name,
                email,
                phone: phone || null,
            });
        }

        return NextResponse.json({
            success: true,
            userId,
            role,
        });
    } catch (error) {
        console.error('User creation error:', error);
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }
}

// List users by role
export async function GET(request: NextRequest) {
    try {
        const supabase = getAdminSupabase();
        const { searchParams } = new URL(request.url);
        const role = searchParams.get('role');

        if (role === 'owner') {
            const { data } = await supabase
                .from('owners')
                .select('*')
                .order('created_at', { ascending: false });
            return NextResponse.json({ data });
        }

        if (role === 'caretaker') {
            const { data } = await supabase
                .from('caretakers')
                .select('*')
                .order('created_at', { ascending: false });
            return NextResponse.json({ data });
        }

        // All roles
        const { data } = await supabase
            .from('user_roles')
            .select('*')
            .order('role');
        return NextResponse.json({ data });
    } catch (error) {
        console.error('User list error:', error);
        return NextResponse.json({ error: 'Failed to list users' }, { status: 500 });
    }
}

// Update user details (specifically for owners subaccount)
export async function PATCH(request: NextRequest) {
    try {
        const supabase = getAdminSupabase();
        const body = await request.json();
        const { id, owner_id, paystack_subaccount_code } = body;

        // Target can be passed as 'id' (from owner table) or 'owner_id'
        const targetId = id || owner_id;

        if (paystack_subaccount_code && targetId) {
            const { error } = await supabase
                .from('owners')
                .update({ paystack_subaccount_code })
                .eq('id', targetId);

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Missing required fields (id/owner_id and code)' }, { status: 400 });
    } catch (error) {
        console.error('User update error:', error);
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
}
