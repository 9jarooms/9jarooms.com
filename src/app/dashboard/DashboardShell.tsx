'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Home, Search, Building2, UserCircle, LogOut, Smartphone, X, Layers, ClipboardList, GraduationCap } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';

const navItems = [
    { href: '/dashboard', label: 'Today', icon: Home },
    { href: '/dashboard?tab=find', label: 'Find', icon: Search },
    { href: '/dashboard/rooms', label: 'Rooms', icon: Layers },
    { href: '/dashboard/log', label: 'Daily log', icon: ClipboardList },
];
// the desktop sidebar also has property details and the account page
const moreItems = [
    { href: '/dashboard/training', label: 'Training', icon: GraduationCap },
    { href: '/dashboard/properties', label: 'Properties', icon: Building2 },
    { href: '/dashboard/account', label: 'Account', icon: UserCircle },
];

const ROLE_NAME: Record<string, string> = { admin: 'Admin', customer_rep: 'Customer rep', caretaker: 'Caretaker' };

interface Props {
    user: User;
    role?: string;
    caretakerName: string;
    children: React.ReactNode;
}

// Phone-first shell: slim top bar + bottom tab bar on mobile, a sidebar on
// desktop. No hamburger — every section is one tap away.
export default function DashboardShell({ user, role = 'caretaker', caretakerName, children }: Props) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const router = useRouter();
    const onFind = pathname === '/dashboard' && searchParams.get('tab') === 'find';
    const [showInstall, setShowInstall] = useState(false);
    const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');

    // One-time nudge to add the portal to the home screen, so it opens like
    // an app. Hidden once installed (standalone) or dismissed.
    useEffect(() => {
        // deferred so it runs after hydration rather than inside the effect body
        const t = setTimeout(() => {
            try {
                const standalone = window.matchMedia('(display-mode: standalone)').matches
                    || (navigator as unknown as { standalone?: boolean }).standalone === true;
                const dismissed = localStorage.getItem('install-hint-dismissed') === '1';
                const ua = navigator.userAgent;
                setPlatform(/iPhone|iPad|iPod/i.test(ua) ? 'ios' : /Android/i.test(ua) ? 'android' : 'other');
                setShowInstall(!standalone && !dismissed && /iPhone|iPad|iPod|Android/i.test(ua));
            } catch { /* ignore */ }
        }, 0);
        return () => clearTimeout(t);
    }, []);
    const dismissInstall = () => {
        setShowInstall(false);
        try { localStorage.setItem('install-hint-dismissed', '1'); } catch { /* ignore */ }
    };

    const isActive = (href: string) => {
        if (href === '/dashboard?tab=find') return onFind;
        if (href === '/dashboard') return !onFind && (pathname === '/dashboard' || pathname.startsWith('/dashboard/bookings'));
        return pathname.startsWith(href);
    };

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
    };

    return (
        <div className="min-h-screen bg-gray-50 text-gray-800">
            {/* Mobile top bar */}
            <header className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 bg-white/95 backdrop-blur-md border-b border-black/[0.06] shadow-sm px-4 flex items-center justify-between">
                <Link href="/dashboard" className="shrink-0 flex items-center">
                    <img src="/logo-transparent.png" alt="9jaRooms" className="h-7 w-auto object-contain" />
                </Link>
                <div className="flex items-center gap-1 min-w-0">
                    <Link href="/dashboard/training" className={`h-8 px-3 mr-1 rounded-full text-[12.5px] font-semibold flex items-center gap-1.5 shrink-0 ${pathname.startsWith('/dashboard/training') ? 'bg-green-500 text-white' : 'bg-green-50 text-green-700'}`}>
                        <GraduationCap size={15} /> Training
                    </Link>
                    {role !== 'caretaker' ? (
                        <Link href="/crm/calendar" className="h-8 px-3 rounded-full bg-gray-900 text-white text-[12px] font-semibold flex items-center shrink-0">
                            {ROLE_NAME[role]} · Console
                        </Link>
                    ) : (
                        <span className="text-[12px] font-semibold text-gray-500 truncate max-w-[34vw]">{caretakerName}</span>
                    )}
                    <button type="button" onClick={handleLogout} aria-label="Sign out" className="w-9 h-9 -mr-1 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 transition-colors">
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            {/* Desktop sidebar */}
            <aside className="hidden lg:flex fixed top-0 left-0 bottom-0 w-64 bg-white border-r border-black/[0.06] flex-col z-40">
                <div className="p-6 border-b border-gray-100">
                    <Link href="/" className="block">
                        <img src="/logo-transparent.png" alt="9jaRooms" className="h-8 w-auto object-contain" />
                    </Link>
                    <div className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                        {ROLE_NAME[role] || 'Caretaker'} · phone app
                    </div>
                </div>
                <nav className="flex-1 py-6 px-4 space-y-1">
                    {[...navItems, ...moreItems].map(item => {
                        const active = isActive(item.href);
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium transition-colors duration-150 ${active
                                    ? 'bg-green-50 text-green-700'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/70'}`}
                            >
                                <Icon size={18} />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
                <Link href="/crm/calendar" className="mx-4 mb-3 flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:border-gray-900 transition-colors">
                    Desktop console →
                </Link>
                <div className="p-4 border-t border-gray-100">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 bg-green-50 rounded-full flex items-center justify-center text-green-700 font-semibold text-sm">
                            {caretakerName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{caretakerName}</p>
                            <p className="text-xs text-gray-400 truncate">{user.email}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleLogout}
                        className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 transition-colors w-full px-3 py-2 rounded-xl hover:bg-red-50"
                    >
                        <LogOut size={16} />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <main className="lg:ml-64 pt-14 lg:pt-0 pb-24 lg:pb-8 min-h-screen">
                {showInstall && (
                    <div className="lg:hidden mx-4 mt-3 rounded-2xl bg-gradient-to-br from-green-600 to-green-700 text-white px-4 py-3 flex items-start gap-3 shadow-md">
                        <Smartphone size={20} className="shrink-0 mt-0.5 text-green-300" />
                        <div className="text-[13px] leading-snug flex-1">
                            <p className="font-semibold">Add 9jaRooms to your home screen</p>
                            <p className="text-white/80 mt-0.5">
                                {platform === 'ios'
                                    ? 'Tap the Share button below, then “Add to Home Screen”.'
                                    : 'Tap the ⋮ menu at the top right, then “Add to Home screen”.'}
                                {' '}It then opens like an app, straight to Today.
                            </p>
                        </div>
                        <button type="button" onClick={dismissInstall} aria-label="Dismiss" className="p-1 -mr-1 rounded-lg text-white/70 active:bg-white/10"><X size={18} /></button>
                    </div>
                )}
                <div className="p-4 sm:p-6 lg:p-8 page-enter">
                    {children}
                </div>
            </main>

            {/* Mobile bottom tabs */}
            <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-black/[0.06] safe-area-inset-bottom">
                <div className="grid grid-cols-4 h-16">
                    {navItems.map(item => {
                        const active = isActive(item.href);
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex flex-col items-center justify-center gap-1 text-[11px] font-semibold ${active ? 'text-green-600' : 'text-gray-400'}`}
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
