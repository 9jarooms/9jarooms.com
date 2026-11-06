import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export async function requireAdmin() {
    const sessionClient = await createServerClient();
    
    // 1. Check if user is authenticated
    const { data: { user }, error: authError } = await sessionClient.auth.getUser();
    
    if (authError || !user) {
        return { error: 'Unauthorized: No active session', status: 401 };
    }

    // 2. Check if user has admin role (requires Admin client since RLS is now enforcing policies)
    const adminClient = createAdminClient();
    
    const { data: roleData, error: roleError } = await adminClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
        
    if (roleError || !roleData) {
        return { error: 'Forbidden: Admin access required', status: 403 };
    }
    
    return { user, adminClient };
}
