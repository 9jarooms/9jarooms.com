import { createServerClient, createAdminClient } from '@/lib/supabase/server';

// Guard for the CRM: customer reps and admins only.
// Returns { user, adminClient } on success, { error, status } otherwise.
export async function requireCrm() {
    const sessionClient = await createServerClient();

    const { data: { user }, error: authError } = await sessionClient.auth.getUser();
    if (authError || !user) {
        return { error: 'Unauthorized: No active session', status: 401 };
    }

    const adminClient = createAdminClient();
    const { data: roleData, error: roleError } = await adminClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['admin', 'customer_rep'])
        .maybeSingle();

    if (roleError || !roleData) {
        return { error: 'Forbidden: CRM access required', status: 403 };
    }

    return { user, adminClient, role: roleData.role as 'admin' | 'customer_rep' };
}
