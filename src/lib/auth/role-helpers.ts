import { createClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';

export type UserRole = 'admin' | 'owner' | 'caretaker' | 'call_operator';

// Get the role for the currently authenticated user
export async function getUserRole(userId: string): Promise<UserRole | null> {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

    return (data?.role as UserRole) || null;
}

// Get all roles for a user (in case of multiple)
export async function getUserRoles(userId: string): Promise<UserRole[]> {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

    return (data?.map((r: any) => r.role as UserRole)) || [];
}

// Require a specific role — redirects to login if not authorized
export async function requireRole(userId: string, requiredRole: UserRole): Promise<void> {
    const role = await getUserRole(userId);
    if (role !== requiredRole) {
        redirect('/login');
    }
}

// Get the dashboard redirect path for a role
export function getDashboardPath(role: UserRole | null): string {
    switch (role) {
        case 'admin': return '/admin';
        case 'owner': return '/owner';
        case 'caretaker': return '/dashboard';
        case 'call_operator': return '/operator';
        default: return '/login';
    }
}
