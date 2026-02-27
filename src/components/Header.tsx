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
        <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white shadow-sm' : 'bg-white/90 backdrop-blur-sm'}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
                <div className="flex items-center justify-between h-16 md:h-20">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2 z-50 relative">
                        <img
                            src="/logo.png"
                            alt="9jaRooms"
                            className="h-20 md:h-24 w-auto object-contain"
                        />
                    </Link>

                    {/* Desktop Nav - Center */}
                    <nav className="hidden md:flex items-center gap-6 lg:gap-8">
                        {[
                            { label: 'Home', href: '/' },
                            { label: 'Rooms', href: '/properties' },
                            { label: 'About', href: '/about' },
                            { label: 'Contact', href: '/contact' },
                        ].map((item) => (
                            <Link
                                key={item.label}
                                href={item.href}
                                className="text-sm font-medium text-gray-700 hover:text-green-500 transition-colors"
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>

                    {/* Login/Sign Up Button - Right */}
                    <div className="hidden md:flex items-center">
                        <Link
                            href="/login"
                            className="text-sm font-medium text-gray-900 border border-gray-900 rounded-full px-5 py-2 hover:bg-gray-900 hover:text-white transition-all duration-200"
                        >
                            Login/Sign Up
                        </Link>
                    </div>

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
                <nav className="md:hidden py-6 border-t border-gray-100 bg-white px-6">
                    <div className="flex flex-col gap-4">
                        {[
                            { label: 'Home', href: '/' },
                            { label: 'Rooms', href: '/properties' },
                            { label: 'About', href: '/about' },
                            { label: 'Contact', href: '/contact' },
                        ].map((item) => (
                            <Link
                                key={item.label}
                                href={item.href}
                                className="text-lg font-medium text-gray-900 py-2 border-b border-gray-50 last:border-0"
                                onClick={() => setMenuOpen(false)}
                            >
                                {item.label}
                            </Link>
                        ))}
                        <Link
                            href="/login"
                            className="text-sm font-medium text-center text-green-500 border border-green-500 rounded-full px-5 py-2.5 mt-2 hover:bg-green-500 hover:text-white transition-all"
                            onClick={() => setMenuOpen(false)}
                        >
                            Login/Sign Up
                        </Link>
                    </div>
                </nav>
            )}
        </header>
    );
}
