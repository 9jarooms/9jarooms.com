'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Menu, X, ChevronDown, Phone } from 'lucide-react';
import { usePathname } from 'next/navigation';

const CATEGORIES = [
    { label: 'Budget', value: 'budget' },
    { label: 'Standard', value: 'standard' },
    { label: 'Luxury', value: 'luxury' },
];

export default function Header() {
    const [menuOpen, setMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const pathname = usePathname();

    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 0);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        setMenuOpen(false);
        setOpenDropdown(null);
    }, [pathname]);

    return (
        <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white shadow-sm' : 'bg-white'}`}>
            {/* ── ROW 1: Logo | Phone + Login ── */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
                <div className="flex items-center justify-between h-14 md:h-16">
                    {/* Logo - Using icon instead of full text logo as requested */}
                    <Link href="/" className="flex items-center z-50 relative shrink-0">
                        <img src="/icon.png" alt="9jaRooms Logo" className="h-[3.5rem] md:h-[4.5rem] w-auto object-contain" />
                    </Link>

                    {/* Desktop right: Phone + Login */}
                    <div className="hidden md:flex items-center gap-5">
                        <a href="tel:+2348168078712" className="text-sm text-gray-500 hover:text-gray-800 transition-colors flex items-center gap-1.5">
                            <Phone size={13} />
                            08031333333
                        </a>
                        <Link
                            href="/login"
                            className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-300 text-gray-700 hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-all duration-200"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                        </Link>
                    </div>

                    {/* Mobile right: Phone + hamburger */}
                    <div className="md:hidden flex items-center gap-2">
                        <a href="tel:+2348168078712" className="p-2 text-gray-500">
                            <Phone size={19} />
                        </a>
                        <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 text-gray-600">
                            {menuOpen ? <X size={22} strokeWidth={1.5} /> : <Menu size={22} strokeWidth={1.5} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── ROW 2: Category tabs (Desktop only) ── */}
            <div className="hidden md:block border-t border-gray-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
                    <div className="flex items-center justify-center gap-1 h-10">
                        {CATEGORIES.map((cat) => (
                            <div key={cat.value} className="relative">
                                <button
                                    onMouseEnter={() => setOpenDropdown(cat.value)}
                                    onMouseLeave={() => setOpenDropdown(null)}
                                    className={`flex items-center gap-1.5 px-5 py-2 text-sm font-medium transition-colors rounded-full ${openDropdown === cat.value ? 'text-gray-900 bg-gray-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                        }`}
                                >
                                    {cat.label}
                                    <ChevronDown size={12} className={`transition-transform duration-200 ${openDropdown === cat.value ? 'rotate-180' : ''}`} />
                                </button>

                                {openDropdown === cat.value && (
                                    <div
                                        className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-[60]"
                                        onMouseEnter={() => setOpenDropdown(cat.value)}
                                        onMouseLeave={() => setOpenDropdown(null)}
                                    >
                                        <Link href={`/properties?category=${cat.value}`} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                                            Browse {cat.label} rooms
                                        </Link>
                                        <Link href="/properties" className="block px-4 py-2.5 text-sm text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors">
                                            View all rooms
                                        </Link>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Mobile menu */}
            {menuOpen && (
                <nav className="md:hidden border-t border-gray-100 bg-white px-4 py-4">
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        {CATEGORIES.map((cat) => (
                            <Link
                                key={cat.value}
                                href={`/properties?category=${cat.value}`}
                                onClick={() => setMenuOpen(false)}
                                className="text-center py-3 px-2 bg-gray-50 rounded-xl text-sm font-medium text-gray-700 hover:bg-green-50 hover:text-green-700 transition-colors"
                            >
                                {cat.label}
                            </Link>
                        ))}
                    </div>
                    <div className="flex flex-col gap-1 pt-3 border-t border-gray-50">
                        {[
                            { label: 'All Rooms', href: '/properties' },
                            { label: 'About', href: '/about' },
                            { label: 'Partner With Us', href: '/partner' },
                        ].map((item) => (
                            <Link key={item.label} href={item.href} className="py-3 px-2 text-base font-medium text-gray-800 border-b border-gray-50 last:border-0" onClick={() => setMenuOpen(false)}>
                                {item.label}
                            </Link>
                        ))}
                        <Link href="/login" className="mt-3 text-sm font-medium text-center text-green-600 border border-green-500 rounded-full px-5 py-3 hover:bg-green-500 hover:text-white transition-all" onClick={() => setMenuOpen(false)}>
                            Login / Sign Up
                        </Link>
                    </div>
                </nav>
            )}
        </header>
    );
}
