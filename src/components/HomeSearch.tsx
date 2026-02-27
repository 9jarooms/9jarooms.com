'use client';

import { useState, useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function HomeSearch() {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [locations, setLocations] = useState<string[]>([]);
    const [filteredLocations, setFilteredLocations] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const isSelectingRef = useRef(false);

    useEffect(() => {
        async function fetchLocations() {
            try {
                const res = await fetch('/api/locations');
                const data = await res.json();
                setLocations(data.data || []);
            } catch (error) {
                console.error('Failed to fetch locations', error);
            }
        }
        fetchLocations();
    }, []);

    useEffect(() => {
        if (query) {
            const filtered = locations.filter(loc =>
                loc.toLowerCase().includes(query.toLowerCase())
            );
            setFilteredLocations(filtered);
        } else {
            setFilteredLocations(locations);
        }
    }, [query, locations]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            router.push(`/properties?area=${encodeURIComponent(query.trim())}`);
        } else {
            router.push('/properties');
        }
    };

    const selectLocation = (loc: string) => {
        isSelectingRef.current = true;
        setQuery(loc);
        setShowSuggestions(false);
        router.push(`/properties?area=${encodeURIComponent(loc)}`);
    };

    return (
        <form
            onSubmit={handleSearch}
            className="w-full bg-white rounded-xl md:rounded-full shadow-lg border border-gray-200 overflow-visible relative z-50"
        >
            <div className="flex items-center">
                {/* Location Input */}
                <div className="flex-1 flex items-center gap-3 px-4 md:px-6 py-3 md:py-4 relative">
                    <MapPin size={20} className="text-gray-400 min-w-[20px]" />
                    <div className="w-full relative">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
                            onFocus={() => setShowSuggestions(true)}
                            onBlur={() => {
                                // Only close if we're not in the middle of selecting
                                setTimeout(() => {
                                    if (!isSelectingRef.current) {
                                        setShowSuggestions(false);
                                    }
                                    isSelectingRef.current = false;
                                }, 150);
                            }}
                            placeholder="Where are you going?"
                            className="w-full text-sm md:text-base text-gray-900 placeholder:text-gray-400 focus:outline-none bg-transparent"
                        />

                        {/* Autocomplete Dropdown */}
                        {showSuggestions && filteredLocations.length > 0 && (
                            <div className="absolute top-full left-0 w-full mt-4 bg-white rounded-xl shadow-xl border border-gray-100 py-2 max-h-[250px] overflow-y-auto z-[100]">
                                <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Suggested Locations</div>
                                {filteredLocations.map((loc) => (
                                    <button
                                        key={loc}
                                        type="button"
                                        className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm text-gray-700 font-medium flex items-center gap-3 transition-colors"
                                        onMouseDown={(e) => {
                                            e.preventDefault(); // Prevent blur from firing
                                            selectLocation(loc);
                                        }}
                                    >
                                        <div className="p-1.5 bg-gray-100 rounded-lg text-gray-500">
                                            <MapPin size={14} />
                                        </div>
                                        {loc}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Search Button */}
                <div className="px-3 py-3 md:py-2">
                    <button
                        type="submit"
                        className="w-full md:w-auto bg-green-500 hover:bg-green-600 text-white px-6 md:px-8 py-3 md:py-3 rounded-lg md:rounded-full text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        Search
                    </button>
                </div>
            </div>
        </form>
    );
}
