'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PropertyCard from '@/components/PropertyCard';
import SearchDatePicker from '@/components/SearchDatePicker';
import { Search, MapPin, BedDouble } from 'lucide-react';
import { Property } from '@/types/database';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

function PropertiesContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const [properties, setProperties] = useState<Property[]>([]);
    const [suggestions, setSuggestions] = useState<Property[]>([]);
    const [reason, setReason] = useState('');
    const [alternativeDates, setAlternativeDates] = useState<{ check_in: string; check_out: string }[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter States
    const [area, setArea] = useState(searchParams.get('area') || '');
    const [checkIn, setCheckIn] = useState(searchParams.get('check_in') || '');
    const [checkOut, setCheckOut] = useState(searchParams.get('check_out') || '');
    const [type, setType] = useState(searchParams.get('type') || '');
    const [bedrooms, setBedrooms] = useState(searchParams.get('bedrooms') || '');
    const [minPrice, setMinPrice] = useState(searchParams.get('min_price') || '');
    const [maxPrice, setMaxPrice] = useState(searchParams.get('max_price') || '');
    const [guests, setGuests] = useState(searchParams.get('guests') || '');
    const [sort, setSort] = useState(searchParams.get('sort') || 'newest');

    // Available bedroom counts from API
    const [availableBedrooms, setAvailableBedrooms] = useState<number[]>([]);

    // Autocomplete States
    const [locations, setLocations] = useState<string[]>([]);
    const [filteredLocations, setFilteredLocations] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
        fetchProperties();
        fetchLocations();
    }, [searchParams]);

    async function fetchLocations() {
        try {
            const res = await fetch('/api/locations');
            const data = await res.json();
            setLocations(data.data || []);
        } catch (error) {
            console.error('Failed to fetch locations', error);
        }
    }

    useEffect(() => {
        if (area) {
            const filtered = locations.filter(loc =>
                loc.toLowerCase().includes(area.toLowerCase())
            );
            setFilteredLocations(filtered);
        } else {
            setFilteredLocations(locations);
        }
    }, [area, locations]);

    async function fetchProperties() {
        setLoading(true);
        const params = new URLSearchParams(searchParams.toString());

        try {
            const res = await fetch(`/api/properties?${params.toString()}`);

            if (!res.ok) {
                const errorText = await res.text();
                console.error(`API Error (${res.status}):`, errorText);
                return;
            }

            const data = await res.json();
            setProperties(data.data || []);
            setSuggestions(data.suggestions || []);
            setReason(data.reason || '');
            setAlternativeDates(data.alternativeDates || []);
            if (data.availableBedrooms) {
                setAvailableBedrooms(data.availableBedrooms);
            }
        } catch (error) {
            console.error('Failed to fetch properties', error);
        } finally {
            setLoading(false);
        }
    }

    function handleAreaChange(e: React.ChangeEvent<HTMLInputElement>) {
        const value = e.target.value;
        setArea(value);
        setShowSuggestions(true);
    }

    function selectLocation(location: string) {
        setArea(location);
        setShowSuggestions(false);
    }

    function applyFilters() {
        const params = new URLSearchParams();
        if (area) params.set('area', area);
        if (checkIn) params.set('check_in', checkIn);
        if (checkOut) params.set('check_out', checkOut);
        if (type) params.set('type', type);
        if (bedrooms) params.set('bedrooms', bedrooms);
        if (minPrice) params.set('min_price', minPrice);
        if (maxPrice) params.set('max_price', maxPrice);
        if (guests) params.set('guests', guests);
        if (sort) params.set('sort', sort);

        router.push(`/properties?${params.toString()}`);
    }

    function clearFilters() {
        setArea('');
        setType('');
        setBedrooms('');
        setMinPrice('');
        setMaxPrice('');
        setGuests('');
        setSort('newest');
        setCheckIn('');
        setCheckOut('');
        router.push('/properties');
    }

    function searchWithDates(ci: string, co: string) {
        const params = new URLSearchParams();
        if (area) params.set('area', area);
        params.set('check_in', ci);
        params.set('check_out', co);
        if (guests) params.set('guests', guests);
        if (type) params.set('type', type);
        if (bedrooms) params.set('bedrooms', bedrooms);
        router.push(`/properties?${params.toString()}`);
    }

    function formatDateShort(dateStr: string) {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
    }

    // Build empty state message based on reason
    const getEmptyStateContent = () => {
        if (reason === 'no_area_match') {
            return {
                title: `We don't have listings in "${area}" yet`,
                subtitle: 'But we have great options in other areas you might love:',
                suggestionsTitle: '✨ Available stays you might like',
            };
        }
        if (reason === 'no_date_availability') {
            const dateRange = checkIn && checkOut
                ? `${formatDateShort(checkIn)} – ${formatDateShort(checkOut)}`
                : 'your selected dates';
            return {
                title: area
                    ? `No stays available in ${area} for ${dateRange}`
                    : `No stays available for ${dateRange}`,
                subtitle: alternativeDates.length > 0
                    ? 'Try these nearby dates instead:'
                    : 'Try different dates or explore these alternatives:',
                suggestionsTitle: '✨ Available at your dates',
            };
        }
        if (reason === 'no_bedroom_match') {
            return {
                title: `No ${bedrooms}-bedroom stays found${area ? ` in ${area}` : ''}`,
                subtitle: 'Here are other options that might work for you:',
                suggestionsTitle: '✨ Other available stays',
            };
        }
        return {
            title: 'No stays match your criteria',
            subtitle: 'Try adjusting your filters or explore these available homes:',
            suggestionsTitle: '✨ Other available stays',
        };
    };

    const emptyState = getEmptyStateContent();

    return (
        <div className="min-h-screen bg-white">
            <Header />

            <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto">
                {/* Search & Filters Bar */}
                <div className="sticky top-16 md:top-20 z-40 bg-white pt-4 pb-4 mb-6 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-0 lg:gap-4 p-0 lg:p-4 border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative bg-white overflow-visible">

                        {/* Location */}
                        <div className="flex-1 w-full lg:w-auto px-4 py-3 lg:py-0 border-b lg:border-b-0 lg:border-r border-gray-200 relative">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5 ml-1">Where</label>
                            <input
                                type="text"
                                placeholder="Anywhere in Abuja"
                                value={area}
                                onChange={handleAreaChange}
                                onFocus={() => setShowSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                                className="w-full bg-transparent border-none text-base text-gray-900 font-medium placeholder-gray-400 p-0 focus:ring-0 truncate ml-1"
                            />
                            {/* Autocomplete Dropdown */}
                            {showSuggestions && filteredLocations.length > 0 && (
                                <div className="absolute top-full left-0 w-full lg:w-[300px] mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-[60] max-h-[250px] overflow-y-auto">
                                    <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Suggested Locations</div>
                                    {filteredLocations.map((loc) => (
                                        <button
                                            key={loc}
                                            className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm text-gray-700 font-medium flex items-center gap-3 transition-colors"
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                selectLocation(loc);
                                            }}
                                        >
                                            <div className="p-2 bg-gray-100 rounded-lg text-gray-500">
                                                <Search size={14} />
                                            </div>
                                            {loc}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Date Picker */}
                        <div className="w-full lg:w-auto border-b lg:border-b-0 lg:border-r border-gray-200 px-2 py-2 lg:py-0">
                            <SearchDatePicker
                                checkIn={checkIn}
                                checkOut={checkOut}
                                onChange={(start, end) => { setCheckIn(start); setCheckOut(end); }}
                            />
                        </div>

                        {/* Bedrooms */}
                        <div className="flex-1 w-full lg:w-auto px-4 py-3 lg:py-0 border-b lg:border-b-0 lg:border-r border-gray-200">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-gray-100 rounded-lg text-gray-500">
                                    <BedDouble size={16} />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">Bedrooms</label>
                                    <select
                                        value={bedrooms}
                                        onChange={(e) => setBedrooms(e.target.value)}
                                        className="w-full bg-transparent border-none text-sm text-gray-900 font-medium focus:ring-0 p-0 cursor-pointer -ml-1"
                                    >
                                        <option value="">Any</option>
                                        {availableBedrooms.map((count) => (
                                            <option key={count} value={count.toString()}>
                                                {count} {count === 1 ? 'Bedroom' : 'Bedrooms'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Type */}
                        <div className="flex-1 w-full lg:w-auto px-4 py-3 lg:py-0 border-b lg:border-b-0 lg:border-r border-gray-200">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-gray-100 rounded-lg text-gray-500">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                                        <polyline points="9 22 9 12 15 12 15 22"></polyline>
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">Type</label>
                                    <select
                                        value={type}
                                        onChange={(e) => setType(e.target.value)}
                                        className="w-full bg-transparent border-none text-sm text-gray-900 font-medium focus:ring-0 p-0 cursor-pointer -ml-1"
                                    >
                                        <option value="">All homes</option>
                                        <option value="Entire Apartment">Entire Apartment</option>
                                        <option value="Shared Apartment">Shared Apartment</option>
                                        <option value="Studio">Studio</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Search Button */}
                        <div className="p-2 lg:p-0 flex justify-end lg:justify-center w-full lg:w-auto">
                            <button
                                onClick={applyFilters}
                                className="bg-green-500 hover:bg-green-600 text-white w-full lg:w-auto p-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-md"
                            >
                                <Search size={20} className="text-white" />
                                <span className="lg:hidden font-semibold">Search</span>
                            </button>
                        </div>
                    </div>

                    {/* Filter Tags / SortRow */}
                    <div className="flex items-center justify-between mt-6 relative">
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            {/* Price Filter Dropdown */}
                            <div className="relative group">
                                <button className="whitespace-nowrap px-4 py-2 border border-gray-200 rounded-full text-sm font-medium hover:border-black transition-colors flex items-center gap-2">
                                    Price
                                    {(minPrice || maxPrice) && <span className="w-2 h-2 bg-green-500 rounded-full"></span>}
                                </button>
                                <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-50 hidden group-hover:block hover:block">
                                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Price range (nightly)</h3>
                                    <div className="flex items-center gap-3">
                                        <div className="relative w-full">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">₦</span>
                                            <input
                                                type="number"
                                                placeholder="Min"
                                                value={minPrice}
                                                onChange={(e) => setMinPrice(e.target.value)}
                                                className="w-full pl-6 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-black transition-colors no-spinner"
                                            />
                                        </div>
                                        <span className="text-gray-300">-</span>
                                        <div className="relative w-full">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">₦</span>
                                            <input
                                                type="number"
                                                placeholder="Max"
                                                value={maxPrice}
                                                onChange={(e) => setMaxPrice(e.target.value)}
                                                className="w-full pl-6 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-black transition-colors no-spinner"
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-4 flex justify-end">
                                        <button
                                            onClick={applyFilters}
                                            className="text-sm font-medium text-white bg-black px-4 py-2 rounded-lg hover:bg-gray-800"
                                        >
                                            Apply
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <button onClick={clearFilters} className="whitespace-nowrap px-4 py-2 border border-gray-200 rounded-full text-sm font-medium hover:border-black transition-colors">
                                Clear filters
                            </button>
                            <select
                                value={sort}
                                onChange={(e) => { setSort(e.target.value); setTimeout(applyFilters, 100); }}
                                className="whitespace-nowrap px-4 py-2 border border-gray-200 rounded-full text-sm font-medium hover:border-black transition-colors bg-white cursor-pointer appearance-none"
                            >
                                <option value="newest">Newest</option>
                                <option value="price_asc">Price: Low to High</option>
                                <option value="price_desc">Price: High to Low</option>
                            </select>
                        </div>
                        <div className="text-sm text-gray-500 hidden sm:block">
                            {properties.length} {properties.length === 1 ? 'stay' : 'stays'} found
                        </div>
                    </div>
                </div>

                {/* Results Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-10">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                            <div key={i} className="animate-pulse">
                                <div className="aspect-square bg-gray-200 rounded-xl mb-3"></div>
                                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                            </div>
                        ))}
                    </div>
                ) : properties.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-10">
                        {properties.map((property) => (
                            <PropertyCard key={property.id} property={property} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 pb-10">
                        <div className="max-w-2xl mx-auto">
                            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <MapPin size={28} className="text-green-400" />
                            </div>
                            <h3 className="text-2xl font-semibold text-gray-900 mb-2">{emptyState.title}</h3>
                            <p className="text-gray-500 mb-6">{emptyState.subtitle}</p>

                            {/* Alternative Dates (same area, different dates) */}
                            {alternativeDates.length > 0 && (
                                <div className="mb-8">
                                    <p className="text-sm font-medium text-gray-700 mb-3">Try these dates instead:</p>
                                    <div className="flex flex-wrap justify-center gap-3">
                                        {alternativeDates.map((alt, i) => (
                                            <button
                                                key={i}
                                                onClick={() => searchWithDates(alt.check_in, alt.check_out)}
                                                className="px-5 py-2.5 bg-green-50 text-green-700 border border-green-200 rounded-full text-sm font-medium hover:bg-green-100 hover:border-green-300 transition-colors"
                                            >
                                                {formatDateShort(alt.check_in)} – {formatDateShort(alt.check_out)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                {area && (
                                    <button
                                        onClick={() => { setArea(''); setTimeout(applyFilters, 100); }}
                                        className="px-6 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors font-semibold"
                                    >
                                        View all available homes
                                    </button>
                                )}
                                <button
                                    onClick={clearFilters}
                                    className="px-6 py-3 bg-gray-100 text-gray-900 rounded-xl hover:bg-gray-200 transition-colors font-medium border border-gray-200"
                                >
                                    Clear all filters
                                </button>
                            </div>
                        </div>

                        {suggestions.length > 0 && (
                            <div className="mt-16 text-left">
                                <h4 className="text-xl font-bold text-gray-900 mb-6">{emptyState.suggestionsTitle}</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-10">
                                    {suggestions.map((property) => (
                                        <PropertyCard key={property.id} property={property} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>
            <Footer />
        </div>
    );
}

export default function PropertiesPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div></div>}>
            <PropertiesContent />
        </Suspense>
    );
}
