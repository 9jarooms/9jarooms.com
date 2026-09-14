import { createAuthClient } from '@/lib/supabase/auth';
import { redirect } from 'next/navigation';
import DashboardShell from './DashboardShell';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
    title: 'Today · 9jaRooms',
    appleWebApp: { capable: true, statusBarStyle: 'default', title: '9jaRooms' },
};
export const viewport: Viewport = { themeColor: '#008737', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

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
