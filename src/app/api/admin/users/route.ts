import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';

// Create a new user (owner or caretaker) via Supabase Admin API
export async function POST(request: NextRequest) {
    try {
        const { adminClient, error: reqError, status } = await requireAdmin();
        if (reqError || !adminClient) return NextResponse.json({ error: reqError }, { status });
        const supabase = adminClient;
        const body = await request.json();
        // username is the primary identifier for caretakers/owners; operators use their real email
        const { username: rawUsername, email: realEmail, password, name, phone, role } = body;

        if (!password || !name || !role) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (!['admin', 'owner', 'caretaker', 'call_operator'].includes(role)) {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }

        // Operators log in with their real email — generate username from it if not provided
        const isOperator = role === 'call_operator' || role === 'admin';
        if (!isOperator && !rawUsername) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const username = rawUsername || (realEmail ? realEmail.split('@')[0] : null);
        if (!username) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Sanitise username
        const cleanUsername = username.toLowerCase().replace(/[^a-z0-9_-]/g, '');

        // Operators use their real email for auth; caretakers/owners use fake internal email
        const authEmail = isOperator && realEmail ? realEmail : `${cleanUsername}@9jarooms.internal`;

        // 1. Check email/username isn't already taken
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const taken = existingUsers?.users?.some(u => u.email?.toLowerCase() === authEmail.toLowerCase());
        if (taken) {
            return NextResponse.json({ error: isOperator ? 'That email address is already registered.' : 'Username is already taken.' }, { status: 400 });
        }

        // For non-operators: also check real_email metadata
        if (!isOperator && realEmail) {
            const realEmailTaken = existingUsers?.users?.some(
                u => u.user_metadata?.real_email?.toLowerCase() === realEmail.toLowerCase()
            );
            if (realEmailTaken) {
                return NextResponse.json({ error: 'That email address is already registered.' }, { status: 400 });
            }
        }

        // 2. Create auth user with fake internal email
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: authEmail,
            password,
            email_confirm: true,
            user_metadata: { name, phone, username: cleanUsername, real_email: realEmail || null },
        });

        if (authError) {
            return NextResponse.json({ error: authError.message }, { status: 500 });
        }

        const userId = authData.user.id;

        // 3. Assign role
        await supabase.from('user_roles').insert({ user_id: userId, role });

        // 4. Create profile
        if (role === 'caretaker') {
            await supabase.from('caretakers').insert({
                id: userId,
                name,
                username: cleanUsername,
                email: realEmail || null,
                phone: phone || null,
            });
        } else if (role === 'owner') {
            await supabase.from('owners').insert({
                user_id: userId,
                name,
                username: cleanUsername,
                email: realEmail || null,
                phone: phone || null,
            });
        }

        return NextResponse.json({ success: true, userId, role });
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
