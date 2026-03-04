'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PropertyCard from '@/components/PropertyCard';
import SearchDatePicker from '@/components/SearchDatePicker';
import { Search, MapPin, BedDouble, SlidersHorizontal, X } from 'lucide-react';
import { Property } from '@/types/database';
import Header from '@/components/Header';

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
        if (bedrooms) params.set('bedrooms', bedrooms);
        if (minPrice) params.set('min_price', minPrice);
        if (maxPrice) params.set('max_price', maxPrice);
        if (guests) params.set('guests', guests);
        if (sort) params.set('sort', sort);

        router.push(`/properties?${params.toString()}`);
    }

    function clearFilters() {
        setArea('');
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
        <div className="min-h-screen bg-[#f7f7f7]">
            <Header />

            <main className="pt-20 pb-12 px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto">
                {/* Search & Filters */}
                <div className="lg:sticky lg:top-16 z-40 bg-[#f7f7f7] pt-3 pb-2 mb-4 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">

                    {/* Desktop: Horizontal search bar */}
                    <div className="hidden lg:flex items-center gap-3 p-2 border border-gray-200 rounded-full shadow-sm hover:shadow-lg transition-all duration-300 bg-white">
                        {/* Location */}
                        <div className="flex-1 pl-5 pr-3 py-1.5 border-r border-gray-200 relative">
                            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Where</label>
                            <input
                                type="text"
                                placeholder="Anywhere in Abuja"
                                value={area}
                                onChange={handleAreaChange}
                                onFocus={() => setShowSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                                className="w-full bg-transparent border-none text-sm text-gray-900 font-medium placeholder-gray-400 p-0 focus:ring-0"
                            />
                            {showSuggestions && filteredLocations.length > 0 && (
                                <div className="absolute top-full left-0 w-[300px] mt-3 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-[60] max-h-[250px] overflow-y-auto">
                                    <div className="px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Locations</div>
                                    {filteredLocations.map((loc) => (
                                        <button
                                            key={loc}
                                            className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700 font-medium flex items-center gap-3 transition-colors"
                                            onMouseDown={(e) => { e.preventDefault(); selectLocation(loc); }}
                                        >
                                            <MapPin size={14} className="text-green-500" />
                                            {loc}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {/* Date Picker */}
                        <div className="border-r border-gray-200 pr-3">
                            <SearchDatePicker
                                checkIn={checkIn}
                                checkOut={checkOut}
                                onChange={(start, end) => { setCheckIn(start); setCheckOut(end); }}
                            />
                        </div>
                        {/* Rooms */}
                        <div className="px-3 py-1.5">
                            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Rooms</label>
                            <select
                                value={bedrooms}
                                onChange={(e) => setBedrooms(e.target.value)}
                                className="bg-transparent border-none text-sm text-gray-900 font-medium focus:ring-0 p-0 cursor-pointer"
                            >
                                <option value="">Any</option>
                                <option value="studio">Studio</option>
                                {availableBedrooms.map((count) => (
                                    <option key={count} value={count.toString()}>
                                        {count} {count === 1 ? 'Bed' : 'Beds'}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {/* Search Button */}
                        <button
                            onClick={applyFilters}
                            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white p-3.5 rounded-full flex items-center justify-center transition-all shadow-md hover:shadow-lg hover:scale-105 shrink-0"
                        >
                            <Search size={18} />
                        </button>
                    </div>

                    {/* Mobile: Elevated search card */}
                    <div className="lg:hidden">
                        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-3">
                            {/* Search input row */}
                            <div className="flex items-center gap-2.5">
                                <div className="flex-1 flex items-center gap-2.5 bg-gray-50 rounded-xl px-3 py-2.5">
                                    <Search size={16} className="text-gray-400 shrink-0" />
                                    <input
                                        id="mobile-search-input"
                                        type="text"
                                        placeholder="Search area, city..."
                                        value={area}
                                        onChange={handleAreaChange}
                                        onFocus={() => setShowSuggestions(true)}
                                        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                                        className="w-full bg-transparent border-none text-sm text-gray-900 placeholder-gray-400 p-0 focus:ring-0"
                                    />
                                </div>
                                <button
                                    onClick={applyFilters}
                                    className="bg-gradient-to-r from-green-500 to-green-600 text-white p-2.5 rounded-xl shrink-0 shadow-sm hover:shadow-md transition-all"
                                >
                                    <Search size={16} />
                                </button>
                            </div>

                            {/* Mobile autocomplete dropdown */}
                            {showSuggestions && filteredLocations.length > 0 && (
                                <div className="mt-2 bg-white rounded-xl border border-gray-100 py-1 max-h-[180px] overflow-y-auto">
                                    {filteredLocations.map((loc) => (
                                        <button
                                            key={loc}
                                            className="w-full text-left px-3 py-2 hover:bg-green-50 text-sm text-gray-700 font-medium flex items-center gap-2.5 transition-colors"
                                            onMouseDown={(e) => { e.preventDefault(); selectLocation(loc); }}
                                        >
                                            <MapPin size={13} className="text-green-500" />
                                            {loc}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Filter chips inside card */}
                            <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto scrollbar-hide">
                                <div className="shrink-0">
                                    <SearchDatePicker
                                        checkIn={checkIn}
                                        checkOut={checkOut}
                                        onChange={(start, end) => { setCheckIn(start); setCheckOut(end); }}
                                    />
                                </div>
                                <select
                                    value={bedrooms}
                                    onChange={(e) => { setBedrooms(e.target.value); setTimeout(applyFilters, 100); }}
                                    className={`shrink-0 px-3 py-2 rounded-xl text-xs font-medium focus:ring-0 cursor-pointer appearance-none border transition-colors ${bedrooms ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-100 text-gray-600'
                                        }`}
                                >
                                    <option value="">Rooms</option>
                                    <option value="studio">Studio</option>
                                    {availableBedrooms.map((count) => (
                                        <option key={count} value={count.toString()}>{count} Bed{count !== 1 ? 's' : ''}</option>
                                    ))}
                                </select>
                                {/* Sort by price chip */}
                                <button
                                    onClick={() => {
                                        const newSort = sort === 'price_asc' ? 'price_desc' : 'price_asc';
                                        setSort(newSort);
                                        setTimeout(applyFilters, 100);
                                    }}
                                    className={`shrink-0 px-3 py-2 rounded-xl text-xs font-medium border transition-colors flex items-center gap-1 ${sort.startsWith('price_') ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-100 text-gray-600'
                                        }`}
                                >
                                    ₦ {sort === 'price_asc' ? 'Low → High' : sort === 'price_desc' ? 'High → Low' : 'Price'}
                                </button>
                                {/* Price range chip */}
                                <div className="relative group shrink-0">
                                    <button className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors flex items-center gap-1 ${(minPrice || maxPrice) ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-100 text-gray-600'
                                        }`}>
                                        ₦ Range
                                        {(minPrice || maxPrice) && <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>}
                                    </button>
                                    <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 p-3 z-50 hidden group-hover:block hover:block">
                                        <div className="flex items-center gap-2">
                                            <div className="relative flex-1">
                                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₦</span>
                                                <input type="number" placeholder="Min" value={minPrice}
                                                    onChange={(e) => setMinPrice(e.target.value)}
                                                    className="w-full pl-5 pr-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-green-400 no-spinner"
                                                />
                                            </div>
                                            <span className="text-gray-300 text-xs">–</span>
                                            <div className="relative flex-1">
                                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₦</span>
                                                <input type="number" placeholder="Max" value={maxPrice}
                                                    onChange={(e) => setMaxPrice(e.target.value)}
                                                    className="w-full pl-5 pr-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-green-400 no-spinner"
                                                />
                                            </div>
                                        </div>
                                        <button onClick={applyFilters}
                                            className="w-full mt-2 text-xs font-medium text-white bg-green-500 px-3 py-1.5 rounded-lg hover:bg-green-600"
                                        >Apply</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sort row + count — desktop only */}
                    <div className="hidden lg:flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                            {/* Price Filter Dropdown */}
                            <div className="relative group">
                                <button className="whitespace-nowrap px-3 py-1.5 border border-gray-200 rounded-full text-xs font-medium hover:border-gray-900 transition-colors flex items-center gap-1.5 bg-white">
                                    Price
                                    {(minPrice || maxPrice) && <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>}
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
                                                className="w-full pl-6 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-400 transition-colors no-spinner"
                                            />
                                        </div>
                                        <span className="text-gray-300">–</span>
                                        <div className="relative w-full">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">₦</span>
                                            <input
                                                type="number"
                                                placeholder="Max"
                                                value={maxPrice}
                                                onChange={(e) => setMaxPrice(e.target.value)}
                                                className="w-full pl-6 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-400 transition-colors no-spinner"
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-4 flex justify-end">
                                        <button
                                            onClick={applyFilters}
                                            className="text-sm font-medium text-white bg-green-500 px-4 py-2 rounded-lg hover:bg-green-600"
                                        >
                                            Apply
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <button onClick={clearFilters} className="whitespace-nowrap px-3 py-1.5 border border-gray-200 rounded-full text-xs font-medium hover:border-gray-900 transition-colors bg-white">
                                Clear
                            </button>
                            <select
                                value={sort}
                                onChange={(e) => { setSort(e.target.value); setTimeout(applyFilters, 100); }}
                                className="whitespace-nowrap px-3 py-1.5 border border-gray-200 rounded-full text-xs font-medium hover:border-gray-900 transition-colors bg-white cursor-pointer appearance-none"
                            >
                                <option value="newest">Newest</option>
                                <option value="price_asc">Price ↑</option>
                                <option value="price_desc">Price ↓</option>
                            </select>
                        </div>
                        <div className="text-xs text-gray-400 shrink-0 pl-3">
                            {properties.length} {properties.length === 1 ? 'stay' : 'stays'}
                        </div>
                    </div>

                    {/* Mobile sort row */}
                    <div className="lg:hidden flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2">
                            <select
                                value={sort}
                                onChange={(e) => { setSort(e.target.value); setTimeout(applyFilters, 100); }}
                                className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-600 focus:ring-0 cursor-pointer appearance-none"
                            >
                                <option value="newest">Newest first</option>
                                <option value="price_asc">Price: Low → High</option>
                                <option value="price_desc">Price: High → Low</option>
                            </select>
                            {(area || checkIn || bedrooms || type || minPrice || maxPrice) && (
                                <button onClick={clearFilters} className="text-xs text-green-600 font-medium underline">
                                    Clear all
                                </button>
                            )}
                        </div>
                        <span className="text-xs text-gray-400">
                            {properties.length} {properties.length === 1 ? 'stay' : 'stays'}
                        </span>
                    </div>
                </div>

                {/* Results Grid */}
                {loading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-6">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                            <div key={i} className="animate-pulse">
                                <div className="aspect-square bg-gray-200 rounded-xl mb-3"></div>
                                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                            </div>
                        ))}
                    </div>
                ) : properties.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-6">
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
                                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-6">
                                    {suggestions.map((property) => (
                                        <PropertyCard key={property.id} property={property} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>
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
