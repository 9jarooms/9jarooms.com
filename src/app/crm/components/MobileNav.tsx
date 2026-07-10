'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import SidebarNav from './SidebarNav';

// Mobile-only top bar + slide-in drawer. The desktop sidebar is hidden below
// md; this gives phone users a compact header and a full-height nav drawer.
export default function MobileNav({ role, email }: { role: string; email: string }) {
    const [open, setOpen] = useState(false);
    const pathname = usePathname();

    // close the drawer whenever the route changes
    useEffect(() => { setOpen(false); }, [pathname]);

    // lock body scroll while the drawer is open
    useEffect(() => {
        if (open) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = '';
        return () => { document.body.style.overflow = ''; };
    }, [open]);

    const current = pathname.split('/')[2] || 'overview';

    return (
        <>
            <header className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 h-14 bg-gradient-to-r from-[#03471f] to-[#02351a] text-white shadow-sm">
                <Link href="/crm/overview" className="text-[17px] font-extrabold tracking-tight">
                    9ja<span className="text-[#7ed957]">Rooms</span>
                </Link>
                <span className="text-[13px] font-semibold capitalize text-white/70">{current.replace('-', ' ')}</span>
                <button
                    onClick={() => setOpen(true)}
                    aria-label="Open menu"
                    className="p-2 -mr-2 rounded-lg active:bg-white/10"
                >
                    <Menu size={22} />
                </button>
            </header>

            {open && (
                <div className="md:hidden fixed inset-0 z-50">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
                    <div className="absolute left-0 top-0 bottom-0 w-[82%] max-w-[320px] bg-gradient-to-b from-[#03471f] to-[#02351a] text-white flex flex-col shadow-2xl">
                        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.08]">
                            <div>
                                <span className="text-[19px] font-extrabold tracking-tight">
                                    9ja<span className="text-[#7ed957]">Rooms</span>
                                </span>
                                <p className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-white/40 mt-1">
                                    {role === 'admin' ? 'Admin' : 'Customer Rep'} Console
                                </p>
                            </div>
                            <button onClick={() => setOpen(false)} aria-label="Close menu" className="p-2 -mr-2 rounded-lg active:bg-white/10">
                                <X size={22} />
                            </button>
                        </div>
                        <SidebarNav onNavigate={() => setOpen(false)} />
                        <div className="px-5 py-4 border-t border-white/[0.08]">
                            <p className="text-[11px] text-white/45 truncate">{email}</p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
