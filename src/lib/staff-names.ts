import type { createAdminClient } from '@/lib/supabase/server';

type Db = ReturnType<typeof createAdminClient>;
export const INTERNAL_DOMAIN = '9jarooms.internal';

// Staff sign in with a username; behind the scenes it is the auth email {username}@9jarooms.internal.
export function usernameOf(email: string | null | undefined) {
    if (!email) return null;
    const [local, domain] = email.toLowerCase().split('@');
    return domain === INTERNAL_DOMAIN ? local : null;
}

// What to call someone on screen: their name, else username, else email
// (app_metadata only an admin can write; user_metadata anyone can edit about themselves, so a name
// taken from there could be used to pose as someone else in the activity feed)
export function displayName(u: { email?: string | null; app_metadata?: Record<string, any> | null } | undefined) {
    if (!u) return 'Unknown';
    return u.app_metadata?.name || usernameOf(u.email) || u.email || 'Unknown';
}

export async function staffDirectory(supabase: Db) {
    const [{ data: roles }, { data: list }] = await Promise.all([
        supabase.from('user_roles').select('user_id, role').in('role', ['admin', 'customer_rep', 'caretaker']),
        supabase.auth.admin.listUsers({ perPage: 1000 }),
    ]);
    const byId = new Map((list?.users || []).map(u => [u.id, u] as const));
    return { roles: roles || [], byId };
}
