import { createAuthClient } from '@/lib/supabase/auth';
import { redirect } from 'next/navigation';
import DashboardShell from './DashboardShell';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createAuthClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Get caretaker info
    const { data: caretaker } = await supabase
        .from('caretakers')
        .select('*')
        .eq('id', user.id)
        .single();

    return (
        <DashboardShell
            user={user}
            caretakerName={caretaker?.name || user.email || 'Caretaker'}
        >
            {children}
        </DashboardShell>
    );
}
