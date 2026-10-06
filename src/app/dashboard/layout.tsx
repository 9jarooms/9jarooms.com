import { createAuthClient } from '@/lib/supabase/auth';
import { redirect } from 'next/navigation';
import { staffLinkPath, linkVersion } from '@/lib/auth/staff-link';
import DashboardShell from './DashboardShell';
import type { Metadata, Viewport } from 'next';

// The install manifest is personal: the home-screen icon opens the user's
// own sign-in link, so a phone whose session was cleared signs itself back in.
export async function generateMetadata(): Promise<Metadata> {
    const base: Metadata = {
        title: 'Today · 9jaRooms',
        appleWebApp: { capable: true, statusBarStyle: 'default', title: '9jaRooms' },
    };
    try {
        const supabase = await createAuthClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) return { ...base, manifest: `${staffLinkPath(user.id, linkVersion(user.app_metadata))}/manifest.webmanifest` };
    } catch { /* fall back to the site manifest */ }
    return base;
}
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
            personalLink={staffLinkPath(user.id, linkVersion(user.app_metadata))}
        >
            {children}
        </DashboardShell>
    );
}
