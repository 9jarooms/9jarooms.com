import { createSessionClient, createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AdminShell from './AdminShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    // 1. Get current user from session (cookies)
    const supabase = await createSessionClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        console.log('Admin Layout: No user session found', userError);
        redirect('/login');
    }

    // 2. Check admin role using Service Role (Bypasses RLS)
    const adminClient = createAdminClient();
    const { data: roleData, error: roleError } = await adminClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

    if (roleError || !roleData) {
        console.error('Admin Layout: Access Denied for user', user.id);
        redirect('/login');
    }

    const name = user.email?.split('@')[0] || 'Admin';

    return <AdminShell userName={name}>{children}</AdminShell>;
}
