'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';

export default function Header() {
    const [menuOpen, setMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 0) {
                setIsScrolled(true);
            } else {
                setIsScrolled(false);
            }
        };

        window.addEventListener('scroll', handleScroll);

        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-sm transition-all duration-300">
            <div className="max-w-7xl mx-auto px-6 lg:px-12">
                <div className="flex items-center justify-between h-20">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2 z-50 relative">
                        <img
                            src="/logo.png"
                            alt="9jaRooms"
                            className="h-24 w-auto object-contain"
                        />
                    </Link>

                    {/* Desktop Nav */}
                    <nav className="hidden md:flex items-center gap-8">
                        {['Properties', 'About', 'Contact'].map((item) => (
                            <Link
                                key={item}
                                href={`/${item.toLowerCase() === 'properties' ? '' : item.toLowerCase()}`}
                                className="text-sm font-medium text-gray-600 hover:text-green-800 transition-colors relative group"
                            >
                                {item}
                                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-green-800 transition-all duration-300 group-hover:w-full opacity-50" />
                            </Link>
                        ))}

                        <div className="h-4 w-px bg-gray-200 mx-2" />

                        <Link
                            href="/login"
                            className="text-sm font-medium text-gray-900 hover:text-green-800 transition-colors"
                        >
                            Caretaker Login
                        </Link>
                    </nav>

                    {/* Mobile menu button */}
                    <button
                        onClick={() => setMenuOpen(!menuOpen)}
                        className="md:hidden p-2 -mr-2 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        {menuOpen ? <X size={24} strokeWidth={1.5} /> : <Menu size={24} strokeWidth={1.5} />}
                    </button>
                </div>
            </div>

            {/* Mobile Nav */}
            {menuOpen && (
                <nav className="md:hidden py-6 border-t border-gray-100 animate-in slide-in-from-top-2 bg-white/95 backdrop-blur-xl px-6">
                    <div className="flex flex-col gap-4">
                        {['Properties', 'About', 'Contact'].map((item) => (
                            <Link
                                key={item}
                                href={`/${item.toLowerCase() === 'properties' ? '' : item.toLowerCase()}`}
                                className="text-lg font-medium text-gray-900 py-2 border-b border-gray-50 last:border-0"
                                onClick={() => setMenuOpen(false)}
                            >
                                {item}
                            </Link>
                        ))}
                        <Link
                            href="/login"
                            className="text-lg font-medium text-green-700 py-2 mt-2"
                            onClick={() => setMenuOpen(false)}
                        >
                            Caretaker Login
                        </Link>
                    </div>
                </nav>
            )}
        </header>
    );
}
