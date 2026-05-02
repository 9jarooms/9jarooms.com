'use client';

import Link from 'next/link';

export default function Footer() {
    return (
        <footer className="bg-[#0c1a0e] text-white">
            <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-16 pb-10">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8 pb-12 border-b border-white/10">

                    {/* Brand */}
                    <div className="md:col-span-4">
                        <Link href="/" className="inline-block mb-4">
                            <img src="/WHITE.jpg" alt="9jaRooms" className="h-10 w-auto object-contain" />
                        </Link>
                        <p className="text-white/40 text-sm italic mb-4">The Right Room, Every Time.</p>
                        <p className="text-white/50 text-sm leading-relaxed max-w-xs">
                            Redefining short-let living in Abuja. Curated shortlets and serviced apartments, fully managed.
                        </p>
                    </div>

                    {/* Explore */}
                    <div className="md:col-span-2 md:col-start-6">
                        <p className="text-white/30 text-xs font-semibold uppercase tracking-widest mb-5">Explore</p>
                        <ul className="space-y-3">
                            {[
                                { label: 'All Properties', href: '/properties' },
                                { label: 'Budget', href: '/properties?category=budget' },
                                { label: 'Standard', href: '/properties?category=standard' },
                                { label: 'Luxury', href: '/properties?category=luxury' },
                                { label: 'Partner With Us', href: '/partner' },
                            ].map(l => (
                                <li key={l.href}>
                                    <Link href={l.href} className="text-white/55 hover:text-white text-sm transition-colors duration-150">
                                        {l.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Contact */}
                    <div className="md:col-span-3 md:col-start-10">
                        <p className="text-white/30 text-xs font-semibold uppercase tracking-widest mb-5">Contact</p>
                        <ul className="space-y-4 text-sm text-white/55">
                            <li>
                                <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">Office</p>
                                58 Harper Street, Neighbourhood Centre,<br />Zone 7, Wuse, Abuja
                            </li>
                            <li>
                                <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">Email</p>
                                <a href="mailto:team@9jarooms.com" className="hover:text-white transition-colors">team@9jarooms.com</a>
                            </li>
                            <li>
                                <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">Phone</p>
                                <a href="tel:+2349111101012" className="hover:text-white transition-colors">+234 911 110 1012</a>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Sub-footer */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 text-xs text-white/25">
                    <p>&copy; {new Date().getFullYear()} 9jaRooms. All rights reserved.</p>
                    <div className="flex gap-6">
                        <Link href="/privacy" className="hover:text-white/60 transition-colors">Privacy Policy</Link>
                        <Link href="/terms" className="hover:text-white/60 transition-colors">Terms of Service</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
