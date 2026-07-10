import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Manrope } from 'next/font/google';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import SidebarNav from './components/SidebarNav';
import MobileNav from './components/MobileNav';

const manrope = Manrope({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'] });

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
    const sessionClient = await createServerClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    if (!user) redirect('/login');

    const adminClient = createAdminClient();
    const { data: role } = await adminClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['admin', 'customer_rep'])
        .maybeSingle();
    if (!role) redirect('/login');

    return (
        <div className={`${manrope.className} min-h-screen bg-[#f4f5f1] md:flex text-stone-800 antialiased [font-feature-settings:'ss01'] [&_input]:font-[inherit] [&_select]:font-[inherit] [&_button]:font-[inherit] [&_textarea]:font-[inherit]`}>
            <aside className="hidden md:flex w-60 shrink-0 bg-gradient-to-b from-[#03471f] to-[#02351a] text-white flex-col sticky top-0 h-screen">
                <div className="px-6 pt-6 pb-5 border-b border-white/[0.08]">
                    <Link href="/crm/overview" className="text-[19px] font-extrabold tracking-tight">
                        9ja<span className="text-[#7ed957]">Rooms</span>
                    </Link>
                    <p className="text-[10.5px] font-semibold tracking-[0.18em] uppercase text-white/40 mt-1.5">
                        {role.role === 'admin' ? 'Admin' : 'Customer Rep'} Console
                    </p>
                </div>
                <SidebarNav />
                <div className="px-6 py-4 border-t border-white/[0.08]">
                    <p className="text-[11px] text-white/45 truncate">{user.email}</p>
                </div>
            </aside>
            <MobileNav role={role.role} email={user.email || ''} />
            <main className="flex-1 min-w-0">{children}</main>
        </div>
    );
}
