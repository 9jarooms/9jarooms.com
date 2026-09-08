'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Home, Building2, UserCircle, LogOut } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

const navItems = [
    { href: '/dashboard', label: 'Today', icon: Home },
    { href: '/dashboard/properties', label: 'Properties', icon: Building2 },
    { href: '/dashboard/account', label: 'Account', icon: UserCircle },
];

interface Props {
    user: User;
    caretakerName: string;
    children: React.ReactNode;
}

// Phone-first shell: slim top bar + bottom tab bar on mobile, a sidebar on
// desktop. No hamburger — every section is one tap away.
export default function DashboardShell({ user, caretakerName, children }: Props) {
    const pathname = usePathname();
    const router = useRouter();

    const isActive = (href: string) =>
        href === '/dashboard'
            ? pathname === '/dashboard' || pathname.startsWith('/dashboard/bookings')
            : pathname.startsWith(href);

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
    };

    return (
        <div className="min-h-screen bg-[#f4f5f1] text-stone-800">
            {/* Mobile top bar */}
            <header className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 bg-white border-b border-stone-200 px-4 flex items-center justify-between">
                <span className="font-extrabold text-[17px] tracking-tight">9ja<span className="text-[#008737]">Rooms</span></span>
                <div className="flex items-center gap-1 min-w-0">
                    <span className="text-[12px] font-semibold text-stone-500 truncate max-w-[40vw]">{caretakerName}</span>
                    <button type="button" onClick={handleLogout} aria-label="Sign out" className="p-2 -mr-2 rounded-lg text-stone-400 active:bg-stone-100">
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            {/* Desktop sidebar */}
            <aside className="hidden lg:flex fixed top-0 left-0 bottom-0 w-64 bg-white border-r border-stone-200 flex-col z-40">
                <div className="p-6 border-b border-stone-200">
                    <Link href="/" className="block">
                        <img src="/WHITE.jpg" alt="9jaRooms" className="h-14 w-auto object-contain" />
                    </Link>
                    <div className="mt-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
                        Caretaker Portal
                    </div>
                </div>
                <nav className="flex-1 py-6 px-4 space-y-1">
                    {navItems.map(item => {
                        const active = isActive(item.href);
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${active
                                    ? 'bg-[#7ed957]/15 text-[#02572a] font-semibold'
                                    : 'text-stone-600 hover:bg-stone-50'}`}
                            >
                                <Icon size={18} />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
                <div className="p-4 border-t border-stone-200">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 bg-[#7ed957]/25 rounded-full flex items-center justify-center text-[#02572a] font-semibold text-sm">
                            {caretakerName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-stone-900 truncate">{caretakerName}</p>
                            <p className="text-xs text-stone-400 truncate">{user.email}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleLogout}
                        className="flex items-center gap-2 text-sm text-stone-500 hover:text-red-600 transition-colors w-full px-3 py-2 rounded-xl hover:bg-red-50"
                    >
                        <LogOut size={16} />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <main className="lg:ml-64 pt-14 lg:pt-0 pb-24 lg:pb-8 min-h-screen">
                <div className="p-4 sm:p-6 lg:p-8 page-enter">
                    {children}
                </div>
            </main>

            {/* Mobile bottom tabs */}
            <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-stone-200 safe-area-inset-bottom">
                <div className="grid grid-cols-3 h-16">
                    {navItems.map(item => {
                        const active = isActive(item.href);
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex flex-col items-center justify-center gap-1 text-[11px] font-bold ${active ? 'text-[#008737]' : 'text-stone-400'}`}
                            >
                                <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                                {item.label}
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}
