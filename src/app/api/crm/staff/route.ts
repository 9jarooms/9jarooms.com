import { NextRequest, NextResponse } from 'next/server';
import { requireCrm } from '@/lib/auth/require-crm';
import { z } from 'zod';
import { INTERNAL_DOMAIN, usernameOf } from '@/lib/staff-names';

// Team access: admins, customer reps and caretakers. Anyone in the console can add reps and caretakers;
// only an admin can add or remove an admin.
const ROLES = ['admin', 'customer_rep', 'caretaker'] as const;
export async function GET() {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.adminClient!;

    const { data: roles, error } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', [...ROLES]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // one lookup for everyone (was one request per person)
    const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const byId = new Map((list?.users || []).map(u => [u.id, u] as const));
    const order: Record<string, number> = { admin: 0, customer_rep: 1, caretaker: 2 };
    const staff = (roles || []).map(r => {
        const u = byId.get(r.user_id);
        return { userId: r.user_id, role: r.role, email: u?.email || '(unknown)', username: usernameOf(u?.email), name: u?.user_metadata?.name || null, createdAt: u?.created_at, banned: !!(u as any)?.banned_until };
    }).filter(s => !s.banned).sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9) || a.email.localeCompare(b.email));
    return NextResponse.json({ staff, myRole: auth.role });
}

// Staff sign in with a username (no email needed): it becomes {username}@9jarooms.internal in Supabase Auth.
const createSchema = z.object({
    username: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9._-]{2,29}$/, 'Username: 3–30 letters or numbers (dots, dashes allowed), no spaces'),
    password: z.string().min(8).max(72),
    name: z.string().trim().min(2).max(80).optional(),
    role: z.enum(ROLES).default('customer_rep'),
});

// Create a staff account (auth user + role)
export async function POST(request: NextRequest) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.adminClient!;

    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
    const { username, password, name, role } = parsed.data;
    const email = `${username}@${INTERNAL_DOMAIN}`;
    if (role === 'admin' && auth.role !== 'admin') {
        return NextResponse.json({ error: 'Only an admin can create another admin' }, { status: 403 });
    }

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: name || username, username },
    });
    if (createError) {
        const taken = /already|registered|exists/i.test(createError.message);
        return NextResponse.json({ error: taken ? `The username "${username}" is already taken` : createError.message }, { status: 400 });
    }

    const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: created.user.id, role });
    if (roleError) return NextResponse.json({ error: roleError.message }, { status: 500 });
    if (role === 'caretaker') {
        await supabase.from('caretakers').upsert({ id: created.user.id, name: name || username, email });
    }

    return NextResponse.json({ success: true, userId: created.user.id, username });
}

// Admin sets a new password for someone who forgot theirs
const resetSchema = z.object({ userId: z.string().uuid(), password: z.string().min(8).max(72) });
export async function PATCH(request: NextRequest) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    if (auth.role !== 'admin') return NextResponse.json({ error: 'Only an admin can reset passwords' }, { status: 403 });
    const parsed = resetSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    const { error } = await auth.adminClient!.auth.admin.updateUserById(parsed.data.userId, { password: parsed.data.password });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
}

// Remove one role from a person (does not delete the auth user)
export async function DELETE(request: NextRequest) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.adminClient!;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const role = (searchParams.get('role') || 'customer_rep') as typeof ROLES[number];
    if (!ROLES.includes(role)) return NextResponse.json({ error: 'Unknown role' }, { status: 400 });
    if (role === 'admin' && auth.role !== 'admin') {
        return NextResponse.json({ error: 'Only an admin can remove an admin' }, { status: 403 });
    }
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    if (userId === auth.user!.id) {
        return NextResponse.json({ error: 'You cannot remove your own access' }, { status: 400 });
    }

    const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
