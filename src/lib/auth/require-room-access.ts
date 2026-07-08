import { createServerClient, createAdminClient } from '@/lib/supabase/server';

// Write access to a room's availability (blocking dates, cleaning, etc.).
// Booking/blocking is CRM-only: admin, customer_rep and call_operator.
// Caretakers and owners have read-only dashboards and no write access.
export async function requireRoomAccess(roomId: string) {
    const sessionClient = await createServerClient();
    const { data: { user }, error: authError } = await sessionClient.auth.getUser();

    if (authError || !user) {
        return { error: 'Unauthorized', status: 401 };
    }

    const adminClient = createAdminClient();

    const { data: roleData } = await adminClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['admin', 'customer_rep', 'call_operator'])
        .limit(1)
        .maybeSingle();

    if (roleData) return { authorized: true, adminClient };

    return { error: 'Forbidden: booking and date control is handled by customer reps', status: 403 };
}
