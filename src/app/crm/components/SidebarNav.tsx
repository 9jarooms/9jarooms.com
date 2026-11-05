'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sun, CalendarDays, List, Settings, Layers, ClipboardList, GraduationCap, Wallet, UserCircle, Activity } from 'lucide-react';

// The everyday console: what is happening, what to do today, where everyone is, the money.
// Overview, Guests, Properties and Reports still exist (linked from Settings) but are out of the way.
const NAV = [
    { href: '/crm/activity', label: 'Activity', icon: Activity },
    { href: '/crm/today', label: 'Today', icon: Sun },
    { href: '/crm/calendar', label: 'Calendar', icon: CalendarDays },
    { href: '/crm/reservations', label: 'Bookings', icon: List },
    { href: '/crm/occupancy', label: 'Daily log', icon: ClipboardList },
    { href: '/crm/rooms', label: 'Rooms & prices', icon: Layers },
    { href: '/crm/commission', label: 'Commission', icon: Wallet },
    { href: '/crm/settings', label: 'Settings', icon: Settings },
];
const SMALL = [
    { href: '/crm/training', label: 'Training', icon: GraduationCap },
    { href: '/dashboard/account', label: 'My password', icon: UserCircle },
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
            <div className="pt-4 mt-4 border-t border-white/10 flex gap-1">
                {SMALL.map(item => (
                    <Link key={item.href} href={item.href} onClick={onNavigate}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[12px] ${pathname.startsWith(item.href) ? 'text-[#a8f07f] bg-white/[0.07]' : 'text-white/50 hover:text-white hover:bg-white/[0.07]'}`}>
                        <item.icon size={14} /> {item.label}
                    </Link>
                ))}
            </div>
        </nav>
    );
}
