import Link from 'next/link';
import Image from 'next/image';
import { MapPin } from 'lucide-react';
import { Property } from '@/types/database';

interface PropertyWithRoomPrices extends Property {
    rooms?: { id: string; price_per_night: number; max_guests: number }[];
}

interface PropertyCardProps {
    property: PropertyWithRoomPrices;
    className?: string;
    featured?: boolean;
}

export default function PropertyCard({ property, className = '', featured = false }: PropertyCardProps) {
    const displayImage = property.thumbnail || property.images?.[0];

    const priceDisplay = (() => {
        if (property.type === 'Shared Apartment' && property.rooms && property.rooms.length > 0) {
            const prices = property.rooms.map(r => r.price_per_night);
            const min = Math.min(...prices);
            const max = Math.max(...prices);
            return `₦${min.toLocaleString()} – ₦${max.toLocaleString()}`;
        }
        return `₦${property.price_per_night?.toLocaleString()}`;
    })();

    const categoryLabel: Record<string, string> = {
        budget: 'Budget',
        standard: 'Standard',
        luxury: 'Luxury',
    };

    if (featured) {
        return (
            <Link
                href={`/property/${property.id}`}
                className={`group relative block overflow-hidden rounded-2xl bg-gray-100 btn-press ${className}`}
            >
                <div className="relative w-full h-full min-h-[340px] sm:min-h-[420px]">
                    {displayImage ? (
                        <Image
                            src={displayImage}
                            alt={property.name}
                            fill
                            sizes="(max-width: 768px) 100vw, 55vw"
                            className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                            style={{ transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)' }}
                        />
                    ) : (
                        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            </svg>
                        </div>
                    )}

                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

                    {/* Category badge */}
                    {property.category && (
                        <div className="absolute top-4 left-4">
                            <span className="inline-block bg-white/15 backdrop-blur-sm text-white text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full border border-white/20">
                                {categoryLabel[property.category] || property.category}
                            </span>
                        </div>
                    )}

                    {/* Content overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
                        <h3 className="text-lg sm:text-xl font-semibold text-white leading-snug mb-1">
                            {property.name}
                        </h3>
                        {property.area && (
                            <p className="text-white/60 text-sm flex items-center gap-1 mb-3">
                                <MapPin size={11} />
                                {property.area}, {property.city}
                            </p>
                        )}
                        <div className="flex items-center justify-between">
                            <p className="text-white font-semibold tabular-nums">
                                {priceDisplay}
                                <span className="text-white/50 font-normal text-xs ml-1">/ night</span>
                            </p>
                            <span className="text-xs text-white/70 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/15 group-hover:bg-white/20 transition-colors duration-200">
                                View →
                            </span>
                        </div>
                    </div>
                </div>
            </Link>
        );
    }

    return (
        <Link
            href={`/property/${property.id}`}
            className={`group block cursor-pointer btn-press ${className}`}
        >
            {/* Image */}
            <div className="aspect-[4/3] bg-gray-100 rounded-xl overflow-hidden relative">
                {displayImage ? (
                    <Image
                        src={displayImage}
                        alt={property.name}
                        fill
                        sizes="(max-width: 768px) 50vw, 25vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        style={{ transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)' }}
                    />
                ) : (
                    <div className="absolute inset-0 bg-gray-50 flex items-center justify-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        </svg>
                    </div>
                )}

                {/* Category tag */}
                {property.category && (
                    <div className="absolute top-2.5 left-2.5">
                        <span className="inline-block bg-white/80 backdrop-blur-sm text-gray-800 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                            {categoryLabel[property.category] || property.category}
                        </span>
                    </div>
                )}

                {/* Hover reveal */}
                <div className="absolute bottom-3 left-3 right-3 opacity-0 translate-y-1.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-240" style={{ transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)' }}>
                    <div className="bg-white/90 backdrop-blur-sm text-gray-900 text-xs font-semibold text-center py-2 rounded-lg">
                        View Details →
                    </div>
                </div>
            </div>

            {/* Card Content */}
            <div className="pt-3 pb-1">
                <h3 className="text-sm font-semibold text-gray-900 line-clamp-1 leading-snug">
                    {property.name}
                </h3>

                {property.area && (
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        <MapPin size={10} />
                        {property.area}, {property.city}
                    </p>
                )}

                <p className="mt-2 text-sm font-semibold text-gray-900 tabular-nums">
                    {priceDisplay}
                    <span className="font-normal text-gray-400 text-xs ml-1">/ night</span>
                </p>
            </div>
        </Link>
    );
}
