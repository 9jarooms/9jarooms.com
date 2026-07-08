import { NextRequest, NextResponse } from 'next/server';
import { requireCrm } from '@/lib/auth/require-crm';
import { z } from 'zod';

// Customer rep management. Creating/removing reps is admin-or-rep work —
// the CRM guard covers both.
export async function GET() {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.adminClient!;

    const { data: roles, error } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['customer_rep', 'admin']);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const staff = [];
    for (const r of roles || []) {
        const { data } = await supabase.auth.admin.getUserById(r.user_id);
        staff.push({
            userId: r.user_id,
            role: r.role,
            email: data?.user?.email || '(unknown)',
            createdAt: data?.user?.created_at,
        });
    }
    return NextResponse.json({ staff });
}

const createSchema = z.object({
    email: z.string().trim().email(),
    password: z.string().min(8).max(72),
    name: z.string().trim().min(2).max(80).optional(),
});

// Create a customer rep account (auth user + role)
export async function POST(request: NextRequest) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.adminClient!;

    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    const { email, password, name } = parsed.data;

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: name ? { name } : undefined,
    });
    if (createError) return NextResponse.json({ error: createError.message }, { status: 400 });

    const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: created.user.id, role: 'customer_rep' });
    if (roleError) return NextResponse.json({ error: roleError.message }, { status: 500 });

    return NextResponse.json({ success: true, userId: created.user.id });
}

// Remove the customer_rep role (does not delete the auth user)
export async function DELETE(request: NextRequest) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.adminClient!;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    if (userId === auth.user!.id) {
        return NextResponse.json({ error: 'You cannot remove your own access' }, { status: 400 });
    }

    const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', 'customer_rep');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
