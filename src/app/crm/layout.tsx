import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { CalendarDays, List, Users, Building2, BarChart3, Settings } from 'lucide-react';

const NAV = [
    { href: '/crm/calendar', label: 'Calendar', icon: CalendarDays },
    { href: '/crm/reservations', label: 'Reservations', icon: List },
    { href: '/crm/guests', label: 'Guests', icon: Users },
    { href: '/crm/properties', label: 'Properties', icon: Building2 },
    { href: '/crm/reports', label: 'Reports', icon: BarChart3 },
    { href: '/crm/settings', label: 'Settings', icon: Settings },
];

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
        <div className="min-h-screen bg-stone-100 flex">
            <aside className="w-56 shrink-0 bg-[#02572a] text-white flex flex-col">
                <div className="px-5 py-5 border-b border-white/10">
                    <Link href="/crm/calendar" className="text-lg font-bold tracking-tight">
                        9ja<span className="text-[#7ed957]">Rooms</span> CRM
                    </Link>
                    <p className="text-xs text-white/60 mt-1 capitalize">{role.role.replace('_', ' ')}</p>
                </div>
                <nav className="flex-1 py-4">
                    {NAV.map(item => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="flex items-center gap-3 px-5 py-2.5 text-sm text-white/85 hover:bg-white/10 hover:text-white transition-colors"
                        >
                            <item.icon size={17} />
                            {item.label}
                        </Link>
                    ))}
                </nav>
                <div className="px-5 py-4 border-t border-white/10 text-xs text-white/50">
                    {user.email}
                </div>
            </aside>
            <main className="flex-1 min-w-0">{children}</main>
        </div>
    );
}
