import { createServerClient } from '@/lib/supabase/server';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PropertyCard from '@/components/PropertyCard';
import HomeSearch from '@/components/HomeSearch';
import Image from 'next/image';
import Link from 'next/link';
import { Search } from 'lucide-react';

export default async function HomePage() {
  const supabase = createServerClient();

  const { data: properties } = await supabase
    .from('properties')
    .select('*')
    .eq('is_active', true)
    .eq('is_featured', true)
    .order('created_at', { ascending: false });

  return (
    <>
      <Header />

      <main className="page-enter min-h-screen">
        {/* Hero Section with Background Image */}
        <section className="relative min-h-[520px] md:min-h-[600px] flex flex-col justify-end pb-16 md:pb-20">
          {/* Background Image */}
          <div className="absolute inset-0 select-none overflow-hidden">
            <Image
              src="/hero-abuja.jpg"
              alt="Luxury apartment master bedroom with view of Aso Rock"
              fill
              className="object-cover"
              priority
              quality={75}
              sizes="100vw"
            />
            {/* Dark gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
          </div>

          {/* Hero Content */}
          <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 pb-8 md:pb-12 text-center flex flex-col items-center">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif text-white leading-tight mb-8 md:mb-10 max-w-2xl italic mx-auto">
              Find your perfect stay<br />
              in the heart of Abuja.
            </h1>

            {/* Search Bar overlaid on the hero */}
            <div className="max-w-4xl w-full mx-auto">
              <HomeSearch />
            </div>
          </div>
        </section>

        {/* Properties Grid - Roomlisting */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-24 md:pb-32 pt-12 md:pt-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 md:mb-14 gap-4 text-center md:text-left">
            <div className="mx-auto md:mx-0">
              <h2 className="text-2xl md:text-3xl font-serif font-semibold text-gray-900 mb-2">
                Our Collection
              </h2>
              <p className="text-gray-500 text-base">
                Discover our hand-picked selection of premium, fully-serviced apartments.
              </p>
            </div>
            <Link href="/properties" className="text-green-700 font-medium hover:text-green-800 transition-colors text-sm">
              View all →
            </Link>
          </div>

          {properties && properties.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
              {properties.slice(0, 4).map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>
          ) : (
            <div className="text-center py-24 md:py-32 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                <Search size={24} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">No properties available</h3>
              <p className="text-gray-500 font-light mt-2">Our collection is currently being updated.</p>
            </div>
          )}
        </section>

        {/* Owner Section (Teaser) */}
        <section className="py-20 md:py-24 bg-gray-900 text-white overflow-hidden relative">
          {/* Abstract curve */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-green-900/30 rounded-full blur-[100px] translate-x-1/2 -translate-y-1/2" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="max-w-2xl">
              <span className="text-green-400 font-medium tracking-widest uppercase text-sm mb-4 block">For Property Owners</span>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif mb-6 leading-tight">Let 9jaRooms Manage <br />Your Bookings.</h2>
              <p className="text-gray-400 text-lg font-light leading-relaxed mb-8">
                We handle photography, marketing, and guest management—so you earn more without the operational headache.
              </p>
              <Link
                href="/partner"
                className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-full font-medium transition-all"
              >
                Learn More
              </Link>
            </div>
            {/* Optional visual element or statistic */}
            <div className="hidden md:block">
              <div className="p-8 border border-white/10 rounded-2xl bg-white/5 backdrop-blur-sm max-w-sm">
                <div className="text-4xl font-serif text-white mb-2">80%+</div>
                <div className="text-gray-400 font-light">Average occupancy rate for our managed properties.</div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
