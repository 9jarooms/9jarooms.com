import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { CheckCircle2, DollarSign, Camera, Users, ArrowRight } from 'lucide-react';

export default function PartnerPage() {
    const whatsappUrl = "https://wa.me/2348000000000"; // Replace with actual number if different

    return (
        <>
            <Header />
            <main className="page-enter min-h-screen bg-white">
                {/* 1. Hero Section */}
                <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6 overflow-hidden bg-gray-50">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cube-coat.png')] opacity-[0.03] pointer-events-none" />
                    <div className="max-w-4xl mx-auto text-center relative z-10">
                        <h1 className="text-5xl md:text-7xl font-serif text-gray-900 mb-6 leading-tight">
                            Let 9jaRooms Fill Your <br />
                            <span className="text-green-700 italic">Empty Nights.</span>
                        </h1>
                        <p className="text-xl text-gray-500 font-light mb-10 max-w-2xl mx-auto">
                            We photograph, market, and manage bookings—so you earn more without the stress.
                        </p>
                        <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-green-900 hover:bg-green-800 text-white px-8 py-4 rounded-full text-lg font-medium transition-all shadow-lg hover:shadow-green-900/20"
                        >
                            Chat With Us on WhatsApp
                            <ArrowRight size={20} />
                        </a>
                    </div>
                </section>

                {/* 2. Quick Value Points */}
                <section className="py-20 px-6">
                    <div className="max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                            {[
                                {
                                    icon: <DollarSign className="w-8 h-8 text-green-700" />,
                                    title: "More Bookings",
                                    desc: "We publish your apartment across multiple channels."
                                },
                                {
                                    icon: <CheckCircle2 className="w-8 h-8 text-green-700" />,
                                    title: "No Upfront Fees",
                                    desc: "We only earn when your apartment gets booked."
                                },
                                {
                                    icon: <Camera className="w-8 h-8 text-green-700" />,
                                    title: "Professional Photos",
                                    desc: "We handle visuals, pricing, and promotion."
                                },
                                {
                                    icon: <Users className="w-8 h-8 text-green-700" />,
                                    title: "One Team",
                                    desc: "No random agents or scattered inquiries."
                                }
                            ].map((item, idx) => (
                                <div key={idx} className="p-6 bg-white rounded-2xl border border-gray-100 hover:border-green-100 hover:shadow-lg hover:shadow-green-900/5 transition-all">
                                    <div className="mb-4 bg-green-50 w-16 h-16 rounded-full flex items-center justify-center">
                                        {item.icon}
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
                                    <p className="text-gray-500 font-light leading-relaxed">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* 3. How It Works (Core Section) */}
                <section className="py-24 bg-gray-900 text-white px-6 rounded-[40px] mx-4 mb-20 overflow-hidden relative">
                    {/* Decorative elements */}
                    <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-green-900/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                    <div className="max-w-7xl mx-auto relative z-10">
                        <div className="text-center mb-16">
                            <span className="text-green-400 font-medium tracking-widest uppercase text-sm mb-4 block">Process</span>
                            <h2 className="text-4xl md:text-5xl font-serif mb-6">How 9jaRooms Works</h2>
                            <p className="text-gray-400 text-lg font-light max-w-2xl mx-auto">Simple, transparent, and profitable.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                            {[
                                { step: "01", title: "Property Assessment", desc: "We inspect your apartment and confirm it meets our standards." },
                                { step: "02", title: "Agreement Signed", desc: "We agree on pricing, commission, and terms." },
                                { step: "03", title: "Professional Setup", desc: "We take photos, create listings, and publish across channels." },
                                { step: "04", title: "We Manage Bookings", desc: "We handle inquiries, guests, and reservations—while you earn." }
                            ].map((item, idx) => (
                                <div key={idx} className="relative">
                                    <div className="text-7xl font-serif text-gray-800 mb-4 opacity-50">{item.step}</div>
                                    <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                                    <p className="text-gray-400 font-light leading-relaxed">{item.desc}</p>
                                    {idx < 3 && <div className="hidden md:block absolute top-[15%] right-0 w-px h-20 bg-gray-800 rotate-[15deg]" />}
                                </div>
                            ))}
                        </div>

                        <div className="text-center mt-16">
                            <a
                                href={whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block bg-green-500 hover:bg-green-600 text-white px-10 py-4 rounded-full font-medium transition-all"
                            >
                                Start on WhatsApp
                            </a>
                        </div>
                    </div>
                </section>

                {/* 4. What We Handle & 5. Who This Is For (Split Section) */}
                <section className="py-20 px-6 max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        {/* What We Handle */}
                        <div className="bg-gray-50 p-10 rounded-3xl">
                            <h3 className="text-3xl font-serif text-gray-900 mb-8">What We Handle For You</h3>
                            <ul className="space-y-4">
                                {[
                                    "Professional Photography",
                                    "Listing Creation & Optimization",
                                    "Multi-channel Publishing",
                                    "Guest Inquiries & Vetting",
                                    "Booking Coordination",
                                    "Monthly Performance Reporting"
                                ].map((item, idx) => (
                                    <li key={idx} className="flex items-center gap-3">
                                        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                                        <span className="text-gray-700">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Who This Is For */}
                        <div>
                            <span className="text-green-800 font-medium tracking-widest uppercase text-sm mb-4 block">Partnership</span>
                            <h3 className="text-4xl font-serif text-gray-900 mb-6">Who We Work With</h3>
                            <p className="text-gray-500 font-light text-lg mb-8">
                                We work best with owners who value quality and consistency. To maintain our high standards, we focus on:
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {['Serviced Apartments', 'Short-let Units', 'Fully Furnished Properties', 'Investors seeking passive income'].map((tag, idx) => (
                                    <div key={idx} className="px-6 py-4 bg-white border border-gray-100 rounded-xl shadow-sm text-gray-800 font-medium">
                                        {tag}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* 6. Final Call to Action */}
                <section className="py-24 text-center px-6">
                    <h2 className="text-4xl md:text-5xl font-serif text-gray-900 mb-6">Ready to get more bookings?</h2>
                    <p className="text-xl text-gray-500 font-light mb-10 max-w-2xl mx-auto">
                        Chat with our team and we’ll guide you through the next steps.
                    </p>
                    <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-green-900 hover:bg-green-800 text-white px-12 py-5 rounded-full text-lg font-medium transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1"
                    >
                        Talk to 9jaRooms on WhatsApp
                    </a>
                </section>

            </main>
            <Footer />
        </>
    );
}
