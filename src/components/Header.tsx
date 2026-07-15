'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Menu, X, Phone } from 'lucide-react';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
    { label: 'All Rooms', href: '/properties' },
    { label: 'Budget', href: '/properties?category=budget' },
    { label: 'Standard', href: '/properties?category=standard' },
    { label: 'Luxury', href: '/properties?category=luxury' },
    { label: 'Partner With Us', href: '/partner' },
];

export default function Header() {
    const [menuOpen, setMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => { setMenuOpen(false); }, [pathname]);

    return (
        <>
            <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-black/[0.06] shadow-sm transition-all duration-300">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
                    <div className="flex items-center justify-between h-[60px]">

                        {/* Logo */}
                        <Link href="/" className="shrink-0 flex items-center">
                            <img
                                src="/logo-transparent.png"
                                alt="9jaRooms"
                                className="h-[1.925rem] w-auto object-contain"
                            />
                        </Link>

                        {/* Desktop nav */}
                        <nav className="hidden md:flex items-center gap-1">
                            {NAV_LINKS.map(link => {
                                const active = pathname === link.href || (link.href !== '/properties' && pathname.startsWith(link.href.split('?')[0]) && link.href.includes(pathname));
                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-150 ${
                                            active
                                                ? 'text-green-700 bg-green-50'
                                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/70'
                                        }`}
                                    >
                                        {link.label}
                                    </Link>
                                );
                            })}
                        </nav>

                        {/* Right actions */}
                        <div className="flex items-center gap-3">
                            <div className="hidden md:flex items-center gap-1.5 text-sm text-gray-500">
                                <Phone size={13} />
                                <a href="tel:+2349111101012" className="hover:text-gray-800 transition-colors">
                                    +234 911 110 1012
                                </a>
                                <span className="text-gray-300">/</span>
                                <a href="tel:+2349112224020" className="hover:text-gray-800 transition-colors">
                                    0911 222 4020
                                </a>
                            </div>

                            <Link
                                href="/account"
                                className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 text-gray-700 hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-all duration-150 btn-press"
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                            </Link>

                            {/* Mobile hamburger */}
                            <button
                                onClick={() => setMenuOpen(v => !v)}
                                className="md:hidden w-9 h-9 flex items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 transition-colors"
                                aria-label="Toggle menu"
                            >
                                {menuOpen ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Mobile menu — full overlay */}
            <div
                className={`fixed inset-0 z-40 md:hidden transition-all duration-300 ${
                    menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
            >
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />

                {/* Panel */}
                <div
                    className={`absolute top-0 right-0 bottom-0 w-72 bg-white shadow-2xl transition-transform duration-300 ${
                        menuOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
                    style={{ transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)' }}
                >
                    <div className="flex items-center justify-between px-5 h-[60px] border-b border-gray-100">
                        <img src="/logo-transparent.png" alt="9jaRooms" className="h-[1.575rem] w-auto object-contain" />
                        <button onClick={() => setMenuOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 transition-colors">
                            <X size={18} />
                        </button>
                    </div>

                    <nav className="px-4 py-5 flex flex-col gap-1">
                        {NAV_LINKS.map((link, i) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setMenuOpen(false)}
                                className={`flex items-center px-4 py-3 rounded-xl text-base font-medium transition-colors ${
                                    i === NAV_LINKS.length - 1
                                        ? 'mt-3 bg-green-600 text-white hover:bg-green-700'
                                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>

                    <div className="absolute bottom-8 left-0 right-0 px-8 flex flex-col gap-2">
                        <a href="tel:+2349111101012" className="flex items-center gap-2 text-sm text-gray-400">
                            <Phone size={13} />
                            +234 911 110 1012
                        </a>
                        <a href="tel:+2349112224020" className="flex items-center gap-2 text-sm text-gray-400">
                            <Phone size={13} />
                            0911 222 4020
                        </a>
                    </div>
                </div>
            </div>
        </>
    );
}
