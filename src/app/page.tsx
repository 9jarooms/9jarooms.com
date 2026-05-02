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

                {/* ─── HERO ──────────────────────────── */}
                <section className="relative min-h-[100dvh] flex flex-col justify-end pt-[60px]">
                    {/* Full-bleed background */}
                    <div className="absolute inset-0 select-none overflow-hidden">
                        <Image
                            src="/hero-abuja.jpg"
                            alt="Luxury apartment in Abuja"
                            fill
                            className="object-cover"
                            priority
                            quality={80}
                            sizes="100vw"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/20" />
                        {/* Right vignette — keeps text readable on left */}
                        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent" />
                    </div>

                    {/* Content — left-aligned */}
                    <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-10 pb-14 sm:pb-20">
                        <div className="max-w-2xl">
                            <p className="text-green-400 text-xs font-semibold uppercase tracking-widest mb-5">
                                Abuja's Premier Short-Let Platform
                            </p>
                            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-white leading-[1.05] tracking-tight mb-5">
                                The Right Room,<br />Every Time.
                            </h1>
                            <p className="text-white/65 text-base sm:text-lg mb-8 max-w-lg leading-relaxed">
                                Hand-picked shortlets and serviced apartments across Abuja. Instant booking, transparent pricing, no surprises.
                            </p>
                            <div className="max-w-xl">
                                <HomeSearch />
                            </div>
                        </div>
                    </div>

                    {/* Stats strip — anchored to bottom of hero */}
                    <div className="relative z-10 border-t border-white/10 bg-black/40 backdrop-blur-sm">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-3 flex items-center gap-8 overflow-x-auto scrollbar-hide text-white/60 text-xs font-medium">
                            <span className="whitespace-nowrap">60+ Properties</span>
                            <span className="w-px h-3 bg-white/20 shrink-0" />
                            <span className="whitespace-nowrap">80% Avg Occupancy</span>
                            <span className="w-px h-3 bg-white/20 shrink-0" />
                            <span className="whitespace-nowrap">Instant Confirmation</span>
                            <span className="w-px h-3 bg-white/20 shrink-0" />
                            <span className="whitespace-nowrap">Maitama · Wuse II · Asokoro · Gwarinpa</span>
                        </div>
                    </div>
                </section>

                {/* ─── TRUST MARQUEE ─────────────────── */}
                <div className="bg-[#008737] overflow-hidden py-3.5">
                    <div className="marquee-track">
                        {trustRepeated.map((item, i) => (
                            <span key={i} className="flex items-center shrink-0">
                                <span className="text-white text-[11px] font-semibold uppercase tracking-widest px-8 whitespace-nowrap">
                                    {item}
                                </span>
                                <span className="text-white/30 text-sm">·</span>
                            </span>
                        ))}
                    </div>
                </div>

                {/* ─── FEATURED — Desktop editorial grid ── */}
                {hasProperties && (
                    <section className="hidden md:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-20">
                        <div className="flex items-end justify-between mb-10">
                            <div>
                                <p className="text-green-600 text-xs font-semibold uppercase tracking-widest mb-2">Our Collection</p>
                                <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">Most Booked Properties</h2>
                            </div>
                            <Link href="/properties" className="text-sm text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1">
                                View all rooms →
                            </Link>
                        </div>

                        {/* Editorial grid: 1 large + 3 stacked */}
                        <div className="grid grid-cols-3 gap-4">
                            {/* Featured large card */}
                            {featured && (
                                <div className="col-span-2 row-span-2">
                                    <PropertyCard property={featured} featured className="h-full" />
                                </div>
                            )}
                            {/* Stacked small cards */}
                            <div className="flex flex-col gap-4">
                                {rest.slice(0, 2).map((property: any) => (
                                    <PropertyCard key={property.id} property={property} className="flex-1" />
                                ))}
                                {rest[2] && (
                                    <PropertyCard property={rest[2]} className="flex-1" />
                                )}
                            </div>
                        </div>
                    </section>
                )}

                {/* ─── MOBILE: Category tiles + scroll ── */}
                <div className="md:hidden pt-8 pb-4">
                    {/* Category tiles */}
                    <div className="px-4 mb-6">
                        <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-3">Browse by Category</p>
                        <div className="grid grid-cols-3 gap-2.5">
                            {(['budget', 'standard', 'luxury'] as const).map((cat) => {
                                const img = categoryHero[cat];
                                const labels = { budget: 'Budget', standard: 'Standard', luxury: 'Luxury' };
                                return (
                                    <Link
                                        key={cat}
                                        href={`/properties?category=${cat}`}
                                        className="relative aspect-[3/4] rounded-2xl overflow-hidden group"
                                    >
                                        {img ? (
                                            <Image src={img} alt={labels[cat]} fill sizes="33vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                                        ) : (
                                            <div className="w-full h-full bg-gray-200" />
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                                        <div className="absolute bottom-0 left-0 right-0 p-3">
                                            <p className="text-white text-xs font-semibold">{labels[cat]}</p>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>

                    {/* Most booked horizontal scroll */}
                    {hasProperties && (
                        <div>
                            <div className="flex items-center justify-between px-4 mb-3">
                                <h3 className="text-base font-semibold text-gray-900">Most Booked</h3>
                                <Link href="/properties" className="text-xs text-gray-400">View all →</Link>
                            </div>
                            <div className="px-4 flex gap-3 overflow-x-auto scrollbar-hide pb-2">
                                {top4Properties.map((property: any) => (
                                    <div key={property.id} className="shrink-0 w-[200px]">
                                        <PropertyCard property={property} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ─── STATS STRIP ─────────────────────── */}
                <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-12 md:py-16">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { value: '60+', label: 'Properties Listed' },
                            { value: '80%', label: 'Average Occupancy' },
                            { value: '4.8★', label: 'Guest Rating' },
                            { value: '2022', label: 'Serving Abuja Since' },
                        ].map((stat) => (
                            <div key={stat.label} className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
                                <p className="text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums">{stat.value}</p>
                                <p className="text-xs text-gray-400 font-medium mt-1 uppercase tracking-wide">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ─── FOR PROPERTY OWNERS ───────────────── */}
                <section className="py-20 md:py-28 bg-[#0c1a0e] text-white overflow-hidden relative mx-4 sm:mx-6 lg:mx-10 rounded-3xl mb-10">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-green-900/20 rounded-full blur-[100px] translate-x-1/3 -translate-y-1/3 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-green-800/10 rounded-full blur-[80px] -translate-x-1/4 translate-y-1/4 pointer-events-none" />

                    <div className="relative z-10 max-w-5xl mx-auto px-6 sm:px-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-12">
                        <div className="max-w-lg">
                            <span className="text-green-400 font-semibold tracking-widest uppercase text-xs mb-4 block">For Property Owners</span>
                            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-5 leading-[1.1]">
                                Let 9jaRooms<br />Manage Your Bookings.
                            </h2>
                            <p className="text-white/50 text-sm sm:text-base leading-relaxed mb-8 max-w-md">
                                We handle photography, marketing, and guest management — so you earn more without the headache. Over 60 properties already trust us.
                            </p>
                            <Link
                                href="/partner"
                                className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-400 text-white px-7 py-3.5 rounded-full text-sm font-semibold transition-colors duration-150 btn-press"
                            >
                                Learn More →
                            </Link>
                        </div>

                        <div className="flex flex-col sm:flex-row md:flex-col gap-4 shrink-0">
                            {[
                                { value: '80%+', label: 'Average occupancy\nfor managed properties' },
                                { value: '15%', label: 'Management fee —\nno upfront costs' },
                            ].map(s => (
                                <div key={s.label} className="p-6 border border-white/10 rounded-2xl bg-white/[0.04] backdrop-blur-sm min-w-[180px]">
                                    <p className="text-3xl font-bold text-white mb-1.5 tabular-nums">{s.value}</p>
                                    <p className="text-white/40 text-xs leading-relaxed whitespace-pre-line">{s.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

            </main>

            <Footer />

            {/* ─── MOBILE FIXED BOTTOM NAV ────────────── */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-100" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                <div className="flex items-center justify-around py-2">
                    <Link href="/properties" className="flex flex-col items-center gap-0.5 px-4 py-1.5 text-gray-400 hover:text-green-600 transition-colors">
                        <Search size={22} strokeWidth={1.5} />
                        <span className="text-[10px] font-medium">Search</span>
                    </Link>
                    <Link href="/account" className="flex flex-col items-center gap-0.5 px-4 py-1.5 text-gray-400 hover:text-green-600 transition-colors">
                        <User size={22} strokeWidth={1.5} />
                        <span className="text-[10px] font-medium">Account</span>
                    </Link>
                </div>
            </nav>

            <div className="md:hidden h-16" />
        </>
    );
}
