import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';

// Create a new user (owner or caretaker) via Supabase Admin API
export async function POST(request: NextRequest) {
    try {
        const { adminClient, error: reqError, status } = await requireAdmin();
        if (reqError || !adminClient) return NextResponse.json({ error: reqError }, { status });
        const supabase = adminClient;
        const body = await request.json();
        const { email, password, name, phone, role } = body;

        if (!email || !password || !name || !role) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (!['admin', 'owner', 'caretaker', 'call_operator'].includes(role)) {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }

        // 1. Check if email already exists on the platform
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const emailExists = existingUsers?.users?.some(u => u.email?.toLowerCase() === email.toLowerCase());
        if (emailExists) {
            return NextResponse.json({ error: 'This email is already registered on the platform. Please use a different email address.' }, { status: 400 });
        }

        // 2. Create auth user
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name, phone },
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
        const { adminClient, error: reqError, status } = await requireAdmin();
        if (reqError || !adminClient) return NextResponse.json({ error: reqError }, { status });
        const supabase = adminClient;
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

        if (role === 'call_operator' || role === 'admin') {
            const { data: roles } = await supabase
                .from('user_roles')
                .select('*')
                .eq('role', role);

            const targetIds = roles?.map(r => r.user_id) || [];

            if (targetIds.length === 0) {
                return NextResponse.json({ data: [] });
            }

            const { data: authUsers, error } = await supabase.auth.admin.listUsers();
            if (error) throw error;

            const users = authUsers.users
                .filter(u => targetIds.includes(u.id))
                .map(u => ({
                    id: u.id,
                    name: u.user_metadata?.name || u.email?.split('@')[0] || 'Unknown',
                    email: u.email,
                    phone: u.user_metadata?.phone || u.phone || null,
                    created_at: u.created_at
                }));

            return NextResponse.json({ data: users });
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

// Update user details (profile fields + paystack for owners)
export async function PATCH(request: NextRequest) {
    try {
        const { adminClient, error: reqError, status } = await requireAdmin();
        if (reqError || !adminClient) return NextResponse.json({ error: reqError }, { status });
        const supabase = adminClient;
        const body = await request.json();
        const { id, owner_id, role, name, phone, email, paystack_subaccount_code } = body;

        const targetId = id || owner_id;
        if (!targetId) {
            return NextResponse.json({ error: 'Missing user ID' }, { status: 400 });
        }

        // Update paystack subaccount code for owners
        if (paystack_subaccount_code !== undefined && (role === 'owner' || owner_id)) {
            const { error } = await supabase
                .from('owners')
                .update({ paystack_subaccount_code })
                .eq('id', targetId);
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Update profile fields in the role-specific table
        if (name || phone || email) {
            const profileUpdates: Record<string, any> = {};
            if (name) profileUpdates.name = name;
            if (phone) profileUpdates.phone = phone;
            if (email) profileUpdates.email = email;

            if (role === 'caretaker') {
                const { error } = await supabase
                    .from('caretakers')
                    .update(profileUpdates)
                    .eq('id', targetId);
                if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            } else if (role === 'owner') {
                const { error } = await supabase
                    .from('owners')
                    .update(profileUpdates)
                    .eq('id', targetId);
                if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            }

            // Also update auth user metadata
            const metaUpdates: Record<string, any> = {};
            if (name) metaUpdates.name = name;
            if (phone) metaUpdates.phone = phone;
            const updatePayload: any = { user_metadata: metaUpdates };
            if (email) updatePayload.email = email;

            const { error: authUpdateError } = await supabase.auth.admin.updateUserById(targetId, updatePayload);
            if (authUpdateError) {
                console.error('Auth metadata update error:', authUpdateError);
                // Non-critical — profile table was already updated
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('User update error:', error);
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
}
