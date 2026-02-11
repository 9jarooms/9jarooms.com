'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
    LayoutDashboard,
    Building2,
    DollarSign,
    LogOut,
    Menu,
    Briefcase,
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
    { href: '/owner', label: 'Overview', icon: LayoutDashboard },
    { href: '/owner/properties', label: 'My Properties', icon: Building2 },
    { href: '/owner/financials', label: 'Financials', icon: DollarSign },
];

export default function OwnerShell({ children, userName }: { children: React.ReactNode; userName?: string }) {
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
            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
            )}

            <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white transform transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="flex flex-col h-full">
                    <div className="p-6 border-b border-gray-800">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-purple-500/20 rounded-lg flex items-center justify-center">
                                <Briefcase size={18} className="text-purple-400" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold">9ja<span className="text-green-400">Rooms</span></h1>
                                <p className="text-xs text-gray-500">Owner Portal</p>
                            </div>
                        </div>
                    </div>

                    <nav className="flex-1 py-4 px-3 space-y-1">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href || (item.href !== '/owner' && pathname.startsWith(item.href));
                            return (
                                <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-purple-500/20 text-purple-400' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                                        }`}>
                                    <item.icon size={18} />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="p-4 border-t border-gray-800">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-400 text-sm font-bold">
                                {userName?.[0] || 'O'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{userName || 'Owner'}</p>
                                <p className="text-xs text-gray-500">Property Owner</p>
                            </div>
                        </div>
                        <button onClick={handleLogout} className="flex items-center gap-2 text-gray-500 hover:text-red-400 text-sm transition-colors w-full">
                            <LogOut size={14} /> Sign out
                        </button>
                    </div>
                </div>
            </aside>

            <div className="flex-1 flex flex-col min-h-screen">
                <header className="bg-white border-b border-gray-100 px-4 py-3 lg:hidden">
                    <button onClick={() => setSidebarOpen(true)} className="text-gray-600"><Menu size={24} /></button>
                </header>
                <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
            </div>
        </div>
    );
}
