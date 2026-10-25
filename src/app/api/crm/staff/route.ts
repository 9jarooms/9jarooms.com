import { NextRequest, NextResponse } from 'next/server';
import { requireCrm } from '@/lib/auth/require-crm';
import { z } from 'zod';

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
        return { userId: r.user_id, role: r.role, email: u?.email || '(unknown)', name: u?.user_metadata?.name || null, createdAt: u?.created_at };
    }).sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9) || a.email.localeCompare(b.email));
    return NextResponse.json({ staff });
}

const createSchema = z.object({
    email: z.string().trim().email(),
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
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    const { email, password, name, role } = parsed.data;
    if (role === 'admin' && auth.role !== 'admin') {
        return NextResponse.json({ error: 'Only an admin can create another admin' }, { status: 403 });
    }

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email: email.toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: name ? { name } : undefined,
    });
    if (createError) return NextResponse.json({ error: createError.message }, { status: 400 });

    const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: created.user.id, role });
    if (roleError) return NextResponse.json({ error: roleError.message }, { status: 500 });
    if (role === 'caretaker') {
        await supabase.from('caretakers').upsert({ id: created.user.id, name: name || email.split('@')[0], email: email.toLowerCase() });
    }

    return NextResponse.json({ success: true, userId: created.user.id });
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
