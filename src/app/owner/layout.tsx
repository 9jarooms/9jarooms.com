import { createAuthClient } from '@/lib/supabase/auth';
import { redirect } from 'next/navigation';
import OwnerShell from './OwnerShell';

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createAuthClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    console.log('OwnerLayout Debug - User:', user?.id, 'Error:', userError);

    if (!user) {
        console.log('OwnerLayout Debug - No user, redirecting to login');
        redirect('/login');
    }

    // Check owner role
    const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'owner')
        .single();

    console.log('OwnerLayout Debug - Role Data:', roleData, 'Error:', roleError);

    if (!roleData) {
        console.log('OwnerLayout Debug - No owner role, redirecting to login');
        redirect('/login');
    }

    const name = user.email?.split('@')[0] || 'Owner';

    return <OwnerShell userName={name}>{children}</OwnerShell>;
}
