import { createServerClient } from '@/lib/supabase/server';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PropertyCard from '@/components/PropertyCard';
import HomeSearch from '@/components/HomeSearch';
import Image from 'next/image';
import Link from 'next/link';
import { Search, User } from 'lucide-react';

const TRUST_ITEMS = [
    '60+ Properties Across Abuja',
    '80% Average Occupancy',
    'Instant Booking Confirmation',
    'Verified & Inspected Rooms',
    'Maitama · Wuse II · Asokoro · Gwarinpa · Jabi',
    'Nigerian Hospitality, Every Stay',
];

export default async function HomePage() {
    const supabase = await createServerClient();

    const [propertiesRes, settingsRes] = await Promise.all([
        supabase.from('properties').select('*, bookings(count)').eq('is_active', true).neq('is_deleted', true),
        supabase.from('site_settings').select('value').eq('key', 'category_thumbnails').maybeSingle(),
    ]);

    const allProperties = propertiesRes.data || [];
    const top4Properties = allProperties
        .sort((a: any, b: any) => (b.bookings?.[0]?.count || 0) - (a.bookings?.[0]?.count || 0))
        .slice(0, 4);

    const savedThumbs = (settingsRes.data?.value as Record<string, string> | null) || {};
    const categoryHero: Record<string, string> = {
        budget: savedThumbs.budget || allProperties.find((p: any) => p.category === 'budget')?.thumbnail || '',
        standard: savedThumbs.standard || allProperties.find((p: any) => p.category === 'standard')?.thumbnail || '',
        luxury: savedThumbs.luxury || allProperties.find((p: any) => p.category === 'luxury')?.thumbnail || '',
    };

    const [featured, ...rest] = top4Properties;
    const hasProperties = top4Properties.length > 0;
    const trustRepeated = [...TRUST_ITEMS, ...TRUST_ITEMS];

    return (
        <>
            <Header />

            <main className="page-enter min-h-[100dvh] bg-[#fafaf8]">

                {/* ─── HERO ─────────────────────────────────── */}
                <section className="relative flex flex-col items-center justify-center text-center pt-[60px]" style={{ minHeight: 'clamp(420px, 60vh, 620px)' }}>
                    {/* Background image */}
                    <div className="absolute inset-0 overflow-hidden">
                        <Image
                            src="/hero-abuja.jpg"
                            alt="Luxury apartment in Abuja"
                            fill
                            className="object-cover object-center"
                            priority
                            quality={80}
                            sizes="100vw"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/35 to-black/15" />
                    </div>

                    {/* Centered content */}
                    <div className="relative z-10 w-full max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 flex flex-col items-center">
                        <p className="text-green-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-4">
                            Abuja's Premier Short-Let Platform
                        </p>
                        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-[1.1] tracking-tight mb-4">
                            The Right Room,<br className="hidden sm:block" /> Every Time.
                        </h1>
                        <p className="text-white/65 text-sm sm:text-base mb-7 sm:mb-9 max-w-sm sm:max-w-md">
                            Hand-picked shortlets and serviced apartments across Abuja.
                        </p>
                        <div className="w-full max-w-xl">
                            <HomeSearch />
                        </div>
                    </div>

                    {/* Bottom fade into page */}
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#fafaf8] to-transparent" />
                </section>

                {/* ─── TRUST MARQUEE ──────────────────────────── */}
                <div className="bg-[#008737] overflow-hidden py-3">
                    <div className="marquee-track">
                        {trustRepeated.map((item, i) => (
                            <span key={i} className="flex items-center shrink-0">
                                <span className="text-white text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest px-6 sm:px-8 whitespace-nowrap">
                                    {item}
                                </span>
                                <span className="text-white/30">·</span>
                            </span>
                        ))}
                    </div>
                </div>

                {/* ─── DESKTOP: Editorial featured grid ────────── */}
                {hasProperties && (
                    <section className="hidden md:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-16">
                        <div className="flex items-end justify-between mb-8">
                            <div>
                                <p className="text-green-600 text-[10px] font-bold uppercase tracking-widest mb-1.5">Our Collection</p>
                                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Most Booked Properties</h2>
                            </div>
                            <Link href="/properties" className="text-sm text-gray-400 hover:text-gray-900 transition-colors">
                                View all →
                            </Link>
                        </div>

                        {/* Editorial: 1 large + stacked right */}
                        <div className="grid grid-cols-3 gap-4" style={{ gridTemplateRows: 'auto' }}>
                            {featured && (
                                <div className="col-span-2">
                                    <PropertyCard property={featured} featured className="h-full" />
                                </div>
                            )}
                            <div className="flex flex-col gap-4">
                                {rest.slice(0, 3).map((property: any) => (
                                    <PropertyCard key={property.id} property={property} />
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {/* ─── MOBILE: Categories + Most Booked ────────── */}
                <div className="md:hidden">
                    {/* Category tiles */}
                    <div className="px-4 pt-6 pb-2">
                        <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-3">Browse by Category</p>
                        <div className="grid grid-cols-3 gap-2">
                            {(['budget', 'standard', 'luxury'] as const).map((cat) => {
                                const img = categoryHero[cat];
                                const labels = { budget: 'Budget', standard: 'Standard', luxury: 'Luxury' };
                                return (
                                    <Link
                                        key={cat}
                                        href={`/properties?category=${cat}`}
                                        className="relative aspect-square rounded-xl overflow-hidden group"
                                    >
                                        {img ? (
                                            <Image src={img} alt={labels[cat]} fill sizes="33vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                                        ) : (
                                            <div className="w-full h-full bg-gray-200" />
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                                        <p className="absolute bottom-0 left-0 right-0 pb-2 text-white text-[11px] font-semibold text-center">
                                            {labels[cat]}
                                        </p>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>

                    {/* Most booked — horizontal scroll */}
                    {hasProperties && (
                        <div className="pt-6 pb-2">
                            <div className="flex items-center justify-between px-4 mb-3">
                                <h3 className="text-sm font-semibold text-gray-900">Most Booked</h3>
                                <Link href="/properties" className="text-xs text-gray-400">View all →</Link>
                            </div>
                            <div className="px-4 flex gap-3 overflow-x-auto scrollbar-hide pb-2">
                                {top4Properties.map((property: any) => (
                                    <div key={property.id} className="shrink-0 w-[185px]">
                                        <PropertyCard property={property} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ─── STATS STRIP ─────────────────────────────── */}
                <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10 md:py-14">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { value: '60+', label: 'Properties Listed' },
                            { value: '80%', label: 'Avg Occupancy' },
                            { value: '4.8★', label: 'Guest Rating' },
                            { value: '2022', label: 'Serving Abuja Since' },
                        ].map((stat) => (
                            <div key={stat.label} className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-5">
                                <p className="text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums">{stat.value}</p>
                                <p className="text-[10px] sm:text-xs text-gray-400 font-medium mt-1 uppercase tracking-wide">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ─── FOR PROPERTY OWNERS ─────────────────────── */}
                <section className="mx-4 sm:mx-6 lg:mx-10 mb-10 rounded-2xl sm:rounded-3xl overflow-hidden bg-[#0c1a0e] text-white relative">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-green-900/20 rounded-full blur-[80px] translate-x-1/3 -translate-y-1/3 pointer-events-none" />

                    <div className="relative z-10 px-6 sm:px-10 py-12 sm:py-16 flex flex-col md:flex-row items-start md:items-center justify-between gap-10">
                        <div className="max-w-md">
                            <span className="text-green-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-4 block">For Property Owners</span>
                            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-4 leading-[1.15]">
                                Let 9jaRooms<br />Manage Your Bookings.
                            </h2>
                            <p className="text-white/50 text-sm sm:text-base leading-relaxed mb-7 max-w-sm">
                                We handle photography, marketing, and guest management — so you earn more without the headache.
                            </p>
                            <Link
                                href="/partner"
                                className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-400 text-white px-6 py-3 rounded-full text-sm font-semibold transition-colors btn-press"
                            >
                                Learn More →
                            </Link>
                        </div>

                        <div className="flex flex-row md:flex-col gap-3 w-full md:w-auto shrink-0">
                            {[
                                { value: '80%+', label: 'Average occupancy\nfor managed properties' },
                                { value: '15%', label: 'Fee — no upfront\ncosts ever' },
                            ].map(s => (
                                <div key={s.value} className="flex-1 md:flex-none p-5 sm:p-6 border border-white/10 rounded-2xl bg-white/[0.04] md:min-w-[170px]">
                                    <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums">{s.value}</p>
                                    <p className="text-white/40 text-xs leading-relaxed whitespace-pre-line mt-1">{s.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

            </main>

            <Footer />

            {/* ─── MOBILE BOTTOM NAV ───────────────────────── */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-100" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                <div className="flex items-center justify-around py-2">
                    <Link href="/properties" className="flex flex-col items-center gap-0.5 px-6 py-1.5 text-gray-400 hover:text-green-600 transition-colors">
                        <Search size={22} strokeWidth={1.5} />
                        <span className="text-[10px] font-medium">Search</span>
                    </Link>
                    <Link href="/account" className="flex flex-col items-center gap-0.5 px-6 py-1.5 text-gray-400 hover:text-green-600 transition-colors">
                        <User size={22} strokeWidth={1.5} />
                        <span className="text-[10px] font-medium">Account</span>
                    </Link>
                </div>
            </nav>

            <div className="md:hidden h-16" />
        </>
    );
}
