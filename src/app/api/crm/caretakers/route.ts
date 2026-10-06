import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, randomInt } from 'crypto';
import { z } from 'zod';
import { requireCrm } from '@/lib/auth/require-crm';
import { staffLinkPath, linkVersion, waNumber } from '@/lib/auth/staff-link';

// Caretakers and their personal phone links (CRM → Settings).
// Admins and reps can add caretakers, send links, reset or remove access.

type Admin = NonNullable<Awaited<ReturnType<typeof requireCrm>>['adminClient']>;

function origin(request: NextRequest) {
    return process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
}

async function describe(supabase: Admin, userId: string, base: string) {
    const [{ data: found }, { data: ct }] = await Promise.all([
        supabase.auth.admin.getUserById(userId),
        supabase.from('caretakers').select('name, phone, username').eq('id', userId).maybeSingle(),
    ]);
    const u = found?.user;
    if (!u) return null;
    const phone = ct?.phone || (u.user_metadata?.phone as string | undefined) || null;
    return {
        userId,
        name: ct?.name || (u.user_metadata?.name as string | undefined) || u.email || 'Caretaker',
        phone,
        whatsapp: waNumber(phone),
        username: ct?.username || null,
        lastSignIn: u.last_sign_in_at || null,
        link: base + staffLinkPath(userId, linkVersion(u.app_metadata)),
    };
}

export async function GET(request: NextRequest) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.adminClient!;

    const { data: roles, error } = await supabase.from('user_roles').select('user_id').eq('role', 'caretaker');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const base = origin(request);
    const rows = (await Promise.all((roles || []).map(r => describe(supabase, r.user_id, base)))).filter(Boolean);
    // people who actually use it first, then by name
    rows.sort((a, b) => (b!.lastSignIn || '').localeCompare(a!.lastSignIn || '') || a!.name.localeCompare(b!.name));
    return NextResponse.json({ caretakers: rows }, { headers: { 'Cache-Control': 'no-store' } });
}

const createSchema = z.object({
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().min(7).max(20),
});

// Add a caretaker: just a name and a phone number. No password is ever
// shown or needed; they sign in with their personal link.
export async function POST(request: NextRequest) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.adminClient!;

    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Enter a name and a phone number' }, { status: 400 });
    const { name, phone } = parsed.data;
    if (!waNumber(phone)) return NextResponse.json({ error: 'That phone number does not look right' }, { status: 400 });

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 14) || 'caretaker';
    const username = `${slug}${randomInt(100, 1000)}`;
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email: `${username}@9jarooms.internal`,
        password: randomBytes(24).toString('base64url'),
        email_confirm: true,
        user_metadata: { name, phone, username },
        app_metadata: { staff_link_v: 1 },
    });
    if (createError || !created?.user) {
        return NextResponse.json({ error: createError?.message || 'Could not create the caretaker' }, { status: 400 });
    }
    const userId = created.user.id;

    const { error: roleError } = await supabase.from('user_roles').insert({ user_id: userId, role: 'caretaker' });
    const { error: ctError } = await supabase.from('caretakers').insert({ id: userId, name, username, phone, email: null });
    if (roleError || ctError) {
        // don't leave a half-made account behind
        await supabase.from('user_roles').delete().eq('user_id', userId);
        await supabase.auth.admin.deleteUser(userId);
        return NextResponse.json({ error: (roleError || ctError)!.message }, { status: 500 });
    }

    return NextResponse.json({ caretaker: await describe(supabase, userId, origin(request)) });
}

const patchSchema = z.object({
    userId: z.string().uuid(),
    phone: z.string().trim().max(20).optional(),
    resetLink: z.boolean().optional(),
});

// Save a phone number, or reset the link (every older link stops working).
export async function PATCH(request: NextRequest) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.adminClient!;

    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    const { userId, phone, resetLink } = parsed.data;

    const { data: role } = await supabase.from('user_roles').select('user_id').eq('user_id', userId).eq('role', 'caretaker').maybeSingle();
    if (!role) return NextResponse.json({ error: 'Not a caretaker' }, { status: 404 });

    if (phone !== undefined) {
        if (phone && !waNumber(phone)) return NextResponse.json({ error: 'That phone number does not look right' }, { status: 400 });
        const { error } = await supabase.from('caretakers').update({ phone: phone || null }).eq('id', userId);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (resetLink) {
        const { data: found } = await supabase.auth.admin.getUserById(userId);
        const next = linkVersion(found?.user?.app_metadata) + 1;
        const { error } = await supabase.auth.admin.updateUserById(userId, {
            app_metadata: { ...(found?.user?.app_metadata || {}), staff_link_v: next },
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ caretaker: await describe(supabase, userId, origin(request)) });
}

// Remove caretaker access. Their Today screen stops working at once (every
// request checks the role); the account itself is kept for history.
export async function DELETE(request: NextRequest) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.adminClient!;

    const userId = new URL(request.url).searchParams.get('userId');
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

    const { data: found } = await supabase.auth.admin.getUserById(userId);
    await supabase.auth.admin.updateUserById(userId, {
        app_metadata: { ...(found?.user?.app_metadata || {}), staff_link_v: linkVersion(found?.user?.app_metadata) + 1 },
    });
    const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'caretaker');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
