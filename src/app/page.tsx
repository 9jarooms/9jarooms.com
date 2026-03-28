import { createServerClient } from '@/lib/supabase/server';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PropertyCard from '@/components/PropertyCard';
import HomeSearch from '@/components/HomeSearch';
import Image from 'next/image';
import Link from 'next/link';
import { Search, Heart, User } from 'lucide-react';

const CATEGORIES = [
  { key: 'budget', label: 'Budget', color: 'from-emerald-800 to-emerald-600' },
  { key: 'standard', label: 'Standard', color: 'from-gray-800 to-gray-600' },
  { key: 'luxury', label: 'Luxury', color: 'from-amber-800 to-amber-600' },
] as const;

export default async function HomePage() {
  const supabase = await createServerClient();

  // Fetch all active and non-deleted properties with their booking counts to find the most booked
  const [propertiesRes, settingsRes] = await Promise.all([
    supabase.from('properties').select('*, bookings(count)').eq('is_active', true).neq('is_deleted', true),
    supabase.from('site_settings').select('value').eq('key', 'category_thumbnails').maybeSingle(),
  ]);

  // Sort by booking count descending, then take top 4
  const allProperties = propertiesRes.data || [];
  const top4Properties = allProperties
    .sort((a: any, b: any) => {
      const aCount = a.bookings?.[0]?.count || 0;
      const bCount = b.bookings?.[0]?.count || 0;
      return bCount - aCount;
    })
    .slice(0, 4);

  // Group by category just to extract thumbnails for the mobile category tiles
  const categoryData = {
    budget: allProperties.filter((p) => p.category === 'budget'),
    standard: allProperties.filter((p) => p.category === 'standard'),
    luxury: allProperties.filter((p) => p.category === 'luxury'),
  };

  // Category thumbnails — admin-set images take priority, then fall back to first property image
  const savedThumbs = (settingsRes.data?.value as Record<string, string> | null) || {};
  const categoryHero: Record<string, string> = {
    budget: savedThumbs.budget || categoryData.budget[0]?.thumbnail || categoryData.budget[0]?.images?.[0] || '',
    standard: savedThumbs.standard || categoryData.standard[0]?.thumbnail || categoryData.standard[0]?.images?.[0] || '',
    luxury: savedThumbs.luxury || categoryData.luxury[0]?.thumbnail || categoryData.luxury[0]?.images?.[0] || '',
  };

  const hasAnyProperties = top4Properties.length > 0;

  return (
    <>
      <Header />

      {/* Extra top padding for 2-row header (desktop ~104px, mobile ~56px) */}
      <main className="page-enter min-h-screen bg-white" style={{ paddingTop: 0 }}>

        {/* ─── HERO ──────────────────────────────────────── */}
        <section className="relative min-h-[500px] md:min-h-[580px] flex flex-col justify-end pb-12 md:pb-16 pt-14 md:pt-[104px]">
          <div className="absolute inset-0 select-none overflow-hidden">
            <Image
              src="/hero-abuja.jpg"
              alt="Luxury apartment in Abuja"
              fill
              className="object-cover"
              priority
              quality={75}
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
          </div>

          <div className="relative z-10 max-w-4xl mx-auto w-full px-4 sm:px-6 text-center flex flex-col items-center">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-sans tracking-tight font-extrabold text-white leading-[1.1] mb-4">
              The Right Room,<br />Every Time.
            </h1>
            <p className="text-white/75 text-sm md:text-base mb-8 md:mb-10">
              Discover hand-picked short-let apartments across Abuja.
            </p>
            <div className="w-full max-w-2xl">
              <HomeSearch />
            </div>
          </div>
        </section>

        {/* ─── DESKTOP: Most Booked Properties ──────────── */}
        {hasAnyProperties ? (
          <div className="hidden md:block max-w-7xl mx-auto px-4 sm:px-6 py-16 space-y-20">
            <section>
              {/* Section header — clean, minimal */}
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold tracking-tight text-gray-900">
                  Most Booked Properties
                </h2>
                <Link
                  href="/properties"
                  className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                >
                  View all →
                </Link>
              </div>

              {/* 4-column grid-lock */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {top4Properties.map((property: any) => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className="hidden md:flex max-w-7xl mx-auto px-4 sm:px-6 py-24 flex-col items-center text-center">
            <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mb-5 border border-gray-100">
              <Search size={22} className="text-gray-400" />
            </div>
            <h3 className="text-base font-medium text-gray-900">No properties yet</h3>
            <p className="text-gray-400 text-sm mt-1">Our collection is being updated. Check back soon.</p>
          </div>
        )}

        {/* ─── MOBILE: Category Tiles + Most Booked ──── */}
        <div className="md:hidden">
          {/* Category tiles (image cards) */}
          <div className="px-4 pt-6 pb-4">
            <p className="text-xs font-semibold text-gray-400 tracking-widest uppercase mb-4">Categories</p>
            <div className="grid grid-cols-3 gap-3">
              {CATEGORIES.map((cat) => {
                const img = categoryHero[cat.key];
                return (
                  <Link
                    key={cat.key}
                    href={`/properties?category=${cat.key}`}
                    className="relative aspect-square rounded-xl overflow-hidden group"
                  >
                    {img ? (
                      <Image src={img} alt={cat.label} fill sizes="33vw" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${cat.color}`} />
                    )}
                    {/* Dark overlay */}
                    <div className="absolute inset-0 bg-black/35" />
                    {/* Label */}
                    <div className="absolute bottom-0 left-0 right-0 p-2">
                      <p className="text-white text-xs font-semibold text-center">{cat.label}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Mobile properties: Most Booked Properties */}
          {hasAnyProperties && (
            <div className="py-6 space-y-8">
              <div>
                <div className="flex items-center justify-between px-4 mb-3">
                  <h3 className="text-base font-semibold text-gray-900">Most Booked</h3>
                  <Link href="/properties" className="text-xs text-gray-400">View all →</Link>
                </div>
                <div className="-mx-0 px-4 flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                  {top4Properties.map((property: any) => (
                    <div key={property.id} className="shrink-0 w-[200px]">
                      <PropertyCard property={property} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── FOR PROPERTY OWNERS ───────────────────────── */}
        <section className="py-16 md:py-24 bg-gray-900 text-white overflow-hidden relative mt-4 md:mt-0">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-green-900/30 rounded-full blur-[80px] translate-x-1/2 -translate-y-1/2" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-10">
            <div className="max-w-xl">
              <span className="text-green-400 font-medium tracking-widest uppercase text-xs mb-3 block">For Property Owners</span>
              <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4 leading-[1.1]">
                Let 9jaRooms Manage<br />Your Bookings.
              </h2>
              <p className="text-gray-400 text-sm md:text-base font-light leading-relaxed mb-6">
                We handle photography, marketing, and guest management—so you earn more without the headache.
              </p>
              <Link href="/partner" className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-7 py-3 rounded-full text-sm font-medium transition-all">
                Learn More
              </Link>
            </div>
            <div className="hidden md:block shrink-0">
              <div className="p-7 border border-white/10 rounded-2xl bg-white/5 backdrop-blur-sm">
                <div className="text-5xl font-extrabold text-white mb-2 tracking-tight">80%+</div>
                <div className="text-gray-400 text-sm font-medium">Average occupancy rate<br />for our managed properties.</div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      {/* ─── MOBILE FIXED BOTTOM NAV ──────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center justify-around py-2">
          <Link href="/properties" className="flex flex-col items-center gap-0.5 px-4 py-1.5 text-gray-400 hover:text-green-600 transition-colors">
            <Search size={22} strokeWidth={1.5} />
            <span className="text-[10px] font-medium">Search</span>
          </Link>
          <Link href="/properties?category=budget" className="flex flex-col items-center gap-0.5 px-4 py-1.5 text-gray-400 hover:text-green-600 transition-colors">
            <Heart size={22} strokeWidth={1.5} />
            <span className="text-[10px] font-medium">Saved</span>
          </Link>
          <Link href="/account" className="flex flex-col items-center gap-0.5 px-4 py-1.5 text-gray-400 hover:text-green-600 transition-colors">
            <User size={22} strokeWidth={1.5} />
            <span className="text-[10px] font-medium">Account</span>
          </Link>
        </div>
      </nav>

      {/* Mobile bottom padding so content doesn't sit behind fixed nav */}
      <div className="md:hidden h-16" />
    </>
  );
}
