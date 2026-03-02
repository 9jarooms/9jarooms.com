import { createSessionClient, createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import OperatorShell from './OperatorShell';

export default async function OperatorLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createSessionClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        console.log('Operator Layout: No user session found', userError);
        redirect('/login');
    }

    const adminClient = createAdminClient();
    const { data: roleData, error: roleError } = await adminClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'call_operator')
        .single();

    if (roleError || !roleData) {
        console.error('Operator Layout: Access Denied for user', user.id);
        redirect('/login');
    }

    const name = user.email?.split('@')[0] || 'Operator';

    return <OperatorShell userName={name}>{children}</OperatorShell>;
}
