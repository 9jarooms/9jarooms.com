import { createServerClient } from '@/lib/supabase/server';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PropertyCard from '@/components/PropertyCard';
import Link from 'next/link';
import { Search, MapPin, Calendar, Shield, Star, CheckCircle2, Users } from 'lucide-react';

export default async function HomePage() {
  const supabase = createServerClient();

  const { data: properties } = await supabase
    .from('properties')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  return (
    <>
      <Header />

      <main className="page-enter min-h-screen">
        {/* Luxury Hero Section */}
        <section className="relative pt-32 pb-24 md:pt-48 md:pb-32 px-6 overflow-hidden">
          {/* Subtle architectural background pattern */}
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cube-coat.png')] opacity-[0.03] pointer-events-none" />

          {/* Abstract elegant shapes - replacing blobs with sophisticated gradients */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-green-50 to-transparent rounded-full blur-3xl opacity-60 translate-x-1/2 -translate-y-1/2 z-0" />

          <div className="relative max-w-5xl mx-auto text-center z-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-gray-200 bg-white/50 backdrop-blur-sm text-xs font-medium text-gray-600 mb-8 tracking-widest uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Good stays. Fair prices.
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-medium text-gray-900 leading-[1.1] tracking-tight mb-8">
              Not Just Listings—<br className="hidden md:block" />
              <span className="text-green-600 italic">Properly Managed Stays.</span>
            </h1>

            <p className="mt-8 text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed font-light">
              One brand. One standard. Every apartment.
            </p>

            {/* Floating Glass Search Bar */}
            <div className="mt-16 max-w-3xl mx-auto">
              <div className="flex flex-col md:flex-row items-center bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-3 gap-2 transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
                <div className="flex-1 flex items-center gap-4 px-6 w-full py-2">
                  <Search size={22} className="text-gray-400 min-w-[22px]" />
                  <input
                    type="text"
                    placeholder="Where would you like to stay?"
                    className="w-full py-2 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none bg-transparent"
                  />
                </div>
                <div className="h-8 w-[1px] bg-gray-200 hidden md:block" />
                <button className="w-full md:w-auto bg-green-900 hover:bg-green-800 text-white px-10 py-4 rounded-2xl text-base font-medium transition-all duration-300 shadow-lg shadow-green-900/10 hover:shadow-green-900/20 active:scale-[0.98]">
                  Search
                </button>
              </div>
              <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm text-gray-400 font-medium">
                <span className="hover:text-gray-600 cursor-pointer transition-colors">Maitama</span>
                <span>•</span>
                <span className="hover:text-gray-600 cursor-pointer transition-colors">Wuse II</span>
                <span>•</span>
                <span className="hover:text-gray-600 cursor-pointer transition-colors">Asokoro</span>
                <span>•</span>
                <span className="hover:text-gray-600 cursor-pointer transition-colors">Gwarinpa</span>
              </div>
            </div>
          </div>
        </section>

        {/* How 9jaRooms Works */}
        <section className="py-20 border-t border-gray-100/50 bg-gray-50/50">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <h2 className="text-4xl font-serif text-gray-900 mb-16">How 9jaRooms Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="flex flex-col items-center gap-4 group">
                <div className="p-6 rounded-full bg-white border border-gray-100 text-green-700 mb-4 shadow-sm group-hover:scale-110 transition-transform duration-500">
                  <Shield size={32} strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-medium text-gray-900">1. We inspect & onboard</h3>
                <p className="text-gray-500 font-light max-w-xs leading-relaxed">Every apartment is physically verified to ensure it meets our 50-point quality standard.</p>
              </div>
              <div className="flex flex-col items-center gap-4 group">
                <div className="p-6 rounded-full bg-white border border-gray-100 text-green-700 mb-4 shadow-sm group-hover:scale-110 transition-transform duration-500">
                  <Users size={32} strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-medium text-gray-900">2. We manage bookings</h3>
                <p className="text-gray-500 font-light max-w-xs leading-relaxed">Our concierge team handles everything from fresh linens to guest support.</p>
              </div>
              <div className="flex flex-col items-center gap-4 group">
                <div className="p-6 rounded-full bg-white border border-gray-100 text-green-700 mb-4 shadow-sm group-hover:scale-110 transition-transform duration-500">
                  <CheckCircle2 size={32} strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-medium text-gray-900">3. You enjoy a reliable stay</h3>
                <p className="text-gray-500 font-light max-w-xs leading-relaxed">No surprises. Just a clean, comfortable, and professionally managed home.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Properties Grid - Curated Collection */}
        <section className="max-w-7xl mx-auto px-6 pb-32 pt-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
            <div>
              <h2 className="text-4xl font-medium text-gray-900 mb-3">The Abuja Collection</h2>
              <p className="text-gray-500 font-light text-lg">
                Discover our hand-picked collection of premium apartments.
              </p>
            </div>
            <a href="/search" className="text-green-700 font-medium hover:text-green-800 transition-colors border-b border-green-200 hover:border-green-800 pb-0.5">
              View all collections
            </a>
          </div>

          {properties && properties.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
              {properties.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>
          ) : (
            <div className="text-center py-32 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                <Search size={24} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">No properties available</h3>
              <p className="text-gray-500 font-light mt-2">Our collection is currently being updated.</p>
            </div>
          )}
        </section>

        {/* Owner Section (Teaser) */}
        <section className="py-24 bg-gray-900 text-white overflow-hidden relative">
          {/* Abstract curve */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-green-900/30 rounded-full blur-[100px] translate-x-1/2 -translate-y-1/2" />

          <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="max-w-2xl">
              <span className="text-green-400 font-medium tracking-widest uppercase text-sm mb-4 block">For Property Owners</span>
              <h2 className="text-4xl md:text-5xl font-serif mb-6 leading-tight">Let 9jaRooms Manage <br />Your Bookings.</h2>
              <p className="text-gray-400 text-lg font-light leading-relaxed mb-8">
                We handle photography, marketing, and guest management—so you earn more without the operational headache.
              </p>
              <Link
                href="/partner"
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-8 py-4 rounded-full font-medium transition-all"
              >
                Learn More
              </Link>
            </div>
            {/* Optional visual element or statistic */}
            <div className="hidden md:block">
              <div className="p-8 border border-white/10 rounded-2xl bg-white/5 backdrop-blur-sm max-w-sm">
                <div className="text-4xl font-serif text-white mb-2">90%+</div>
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
