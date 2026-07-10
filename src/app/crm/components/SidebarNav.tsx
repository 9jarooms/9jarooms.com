'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CalendarDays, List, Users, Building2, BarChart3, Settings } from 'lucide-react';

const NAV = [
    { href: '/crm/overview', label: 'Overview', icon: LayoutDashboard },
    { href: '/crm/calendar', label: 'Calendar', icon: CalendarDays },
    { href: '/crm/reservations', label: 'Reservations', icon: List },
    { href: '/crm/guests', label: 'Guests', icon: Users },
    { href: '/crm/properties', label: 'Properties', icon: Building2 },
    { href: '/crm/reports', label: 'Reports', icon: BarChart3 },
    { href: '/crm/settings', label: 'Settings', icon: Settings },
];

export default function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
    const pathname = usePathname();
    return (
        <nav className="flex-1 py-4 px-3 space-y-0.5">
            {NAV.map(item => {
                const active = pathname.startsWith(item.href);
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        className={`flex items-center gap-3 px-4 py-3 md:py-2.5 text-[15px] md:text-[13.5px] font-medium rounded-xl transition-all duration-150 ${
                            active
                                ? 'bg-[#7ed957]/15 text-[#a8f07f] shadow-[inset_0_0_0_1px_rgba(126,217,87,0.25)]'
                                : 'text-white/70 hover:bg-white/[0.07] hover:text-white'
                        }`}
                    >
                        <item.icon size={17} strokeWidth={active ? 2.4 : 2} />
                        {item.label}
                    </Link>
                );
            })}
        </nav>
    );
}
