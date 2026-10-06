import type { Metadata, Viewport } from 'next';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyStaffToken, linkVersion } from '@/lib/auth/staff-link';
import StaffWelcome from './StaffWelcome';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
    const { token } = await params;
    return {
        title: '9jaRooms Today',
        robots: { index: false, follow: false },
        manifest: `/s/${token}/manifest.webmanifest`,
        appleWebApp: { capable: true, statusBarStyle: 'default', title: '9jaRooms' },
        referrer: 'no-referrer',
    };
}
export const viewport: Viewport = { themeColor: '#008737', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

// What a caretaker sees when they tap the link the team sent on WhatsApp:
// their name, one big button, and how to put the app on their home screen.
export default async function StaffLinkPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const parsed = verifyStaffToken(token);

    let name: string | null = null;
    let valid = false;
    if (parsed) {
        const admin = createAdminClient();
        const { data } = await admin.auth.admin.getUserById(parsed.userId);
        if (data?.user && linkVersion(data.user.app_metadata) === parsed.version) {
            valid = true;
            const { data: ct } = await admin.from('caretakers').select('name').eq('id', parsed.userId).maybeSingle();
            name = ct?.name || (data.user.user_metadata?.name as string | undefined) || null;
        }
    }

    return <StaffWelcome valid={valid} name={name} enterHref={`/s/${token}/enter`} />;
}
