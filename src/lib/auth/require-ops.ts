import type { User } from '@supabase/supabase-js';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export type OpsRole = 'admin' | 'customer_rep' | 'caretaker';

export interface OpsAuth {
    user: User;
    adminClient: ReturnType<typeof createAdminClient>;
    role: OpsRole;
    // null = every property. Kept as an array for a future per-property scope.
    propertyIds: string[] | null;
}

export type OpsAuthResult = OpsAuth | { error: string; status: number };

// Guard for the day-to-day operations surface (Today / Units / Bookings).
// Reps and admins see everything; caretakers are scoped to their properties.
export async function requireOps(): Promise<OpsAuthResult> {
    const sessionClient = await createServerClient();
    const { data: { user }, error: authError } = await sessionClient.auth.getUser();
    if (authError || !user) {
        return { error: 'Unauthorized: No active session', status: 401 };
    }

    const adminClient = createAdminClient();
    const { data: roles } = await adminClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
    const have = new Set((roles || []).map(r => r.role as string));

    if (have.has('admin')) return { user, adminClient, role: 'admin', propertyIds: null };
    if (have.has('customer_rep')) return { user, adminClient, role: 'customer_rep', propertyIds: null };
    // Caretakers cover every 9jaRooms property (two people run the whole
    // portfolio), so they are not scoped either — only their powers differ.
    if (have.has('caretaker')) return { user, adminClient, role: 'caretaker', propertyIds: null };

    return { error: 'Forbidden: operations access required', status: 403 };
}

export function canAccessProperty(auth: OpsAuth, propertyId: string | null | undefined): boolean {
    if (!propertyId) return false;
    return auth.propertyIds === null || auth.propertyIds.includes(propertyId);
}
