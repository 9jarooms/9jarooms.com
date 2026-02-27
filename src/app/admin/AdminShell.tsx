'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
    LayoutDashboard,
    Building2,
    Users,
    UserCog,
    CalendarDays,
    LogOut,
    Menu,
    X,
    Shield,
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
    { href: '/admin', label: 'Overview', icon: LayoutDashboard },
    { href: '/admin/owners', label: 'Owners', icon: Users },
    { href: '/admin/caretakers', label: 'Caretakers', icon: UserCog },
    { href: '/admin/properties', label: 'Properties', icon: Building2 },
    { href: '/admin/bookings', label: 'Bookings', icon: CalendarDays },
];

export default function AdminShell({ children, userName }: { children: React.ReactNode; userName?: string }) {
    const pathname = usePathname();
    const router = useRouter();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/login');
    };

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-100 text-gray-900 transform transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                <div className="flex flex-col h-full">
                    {/* Brand */}
                    <div className="p-6 border-b border-gray-100">
                        <Link href="/" className="block">
                            <img src="/logo.png" alt="9jaRooms" className="h-10 w-auto object-contain" />
                        </Link>
                        <div className="mt-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                            Admin Portal
                        </div>
                    </div>

                    {/* Nav */}
                    <nav className="flex-1 py-6 px-4 space-y-1">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setSidebarOpen(false)}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${isActive
                                        ? 'bg-green-50 text-green-700'
                                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                                        }`}
                                >
                                    <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Profile */}
                    <div className="p-4 border-t border-gray-100 bg-gray-50/50">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 bg-red-100 rounded-full flex items-center justify-center text-red-600 text-sm font-bold border border-red-200">
                                {userName?.[0] || 'A'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{userName || 'Admin'}</p>
                                <p className="text-xs text-red-500 font-medium">Administrator</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 text-gray-500 hover:text-red-600 text-sm transition-colors w-full px-2 py-1"
                        >
                            <LogOut size={16} />
                            Sign out
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 flex flex-col min-h-screen">
                {/* Top bar */}
                <header className="bg-white border-b border-gray-100 px-4 py-3 lg:hidden">
                    <button onClick={() => setSidebarOpen(true)} className="text-gray-600">
                        <Menu size={24} />
                    </button>
                </header>

                {/* Content */}
                <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
            </div>
        </div>
    );
}
