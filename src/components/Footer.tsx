'use client';

import Link from 'next/link';

export default function Footer() {
    return (
        <footer className="bg-gray-50 border-t border-gray-200">
            <div className="max-w-7xl mx-auto px-6 py-16 md:py-24">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-8">
                    {/* Brand / Mission */}
                    <div className="md:col-span-4">
                        <Link href="/" className="inline-block mb-6">
                            <span className="font-serif text-2xl font-bold text-gray-900 tracking-tight">9jaRooms</span>
                        </Link>
                        <p className="text-gray-500 font-light leading-relaxed max-w-sm">
                            Redefining short-let living in Abuja. Experience the perfect blend of luxury, comfort, and Nigerian hospitality in our curated collection of serviced apartments.
                        </p>
                    </div>

                    {/* Navigation Columns */}
                    <div className="md:col-span-2 md:col-start-6">
                        <h4 className="font-serif text-lg text-gray-900 mb-6">Explore</h4>
                        <ul className="space-y-4">
                            <li><Link href="/search" className="text-gray-500 hover:text-green-800 transition-colors">The Abuja Collection</Link></li>
                            <li><Link href="/about" className="text-gray-500 hover:text-green-800 transition-colors">About Us</Link></li>
                            <li><Link href="/concierge" className="text-gray-500 hover:text-green-800 transition-colors">Concierge</Link></li>
                            <li><Link href="/partner" className="text-gray-500 hover:text-green-800 transition-colors">Partner With Us</Link></li>
                        </ul>
                    </div>

                    <div className="md:col-span-2">
                        <h4 className="font-serif text-lg text-gray-900 mb-6">Neighborhoods</h4>
                        <ul className="space-y-4">
                            <li><span className="text-gray-500">Maitama</span></li>
                            <li><span className="text-gray-500">Asokoro</span></li>
                            <li><span className="text-gray-500">Wuse II</span></li>
                            <li><span className="text-gray-500">Gwarinpa</span></li>
                        </ul>
                    </div>

                    <div className="md:col-span-3">
                        <h4 className="font-serif text-lg text-gray-900 mb-6">Contact</h4>
                        <ul className="space-y-4 text-gray-500">
                            <li>
                                <span className="block text-gray-400 text-sm mb-1 uppercase tracking-wider">Office</span>
                                58 harper street, neighbourhood centre,<br />zone 7, wuse abuja
                            </li>
                            <li>
                                <span className="block text-gray-400 text-sm mb-1 uppercase tracking-wider">Email</span>
                                <a href="mailto:team@9jarooms.com" className="hover:text-green-800 transition-colors">team@9jarooms.com</a>
                            </li>
                            <li>
                                <span className="block text-gray-400 text-sm mb-1 uppercase tracking-wider">Phone</span>
                                <a href="tel:+2348168078712" className="hover:text-green-800 transition-colors">+234 816 807 8712</a>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Sub-footer */}
                <div className="border-t border-gray-200 mt-16 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-400 font-light">
                    <p>&copy; {new Date().getFullYear()} 9jaRooms. All rights reserved.</p>
                    <div className="flex gap-6">
                        <Link href="/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</Link>
                        <Link href="/terms" className="hover:text-gray-600 transition-colors">Terms of Service</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
