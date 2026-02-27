import Link from 'next/link';
import { Star } from 'lucide-react';
import { Property } from '@/types/database';

// Extended type for properties fetched with joined rooms data from the API
interface PropertyWithRoomPrices extends Property {
    rooms?: { id: string; price_per_night: number; max_guests: number }[];
}

export default function PropertyCard({ property, className = '' }: { property: PropertyWithRoomPrices, className?: string }) {
    // Priority: Thumbnail -> First Image -> Fallback
    const displayImage = property.thumbnail || property.images?.[0];

    // Generate stars display (4-5 stars)
    const rating = 4.5;
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;

    return (
        <Link href={`/property/${property.id}`} className={`group block cursor-pointer flex flex-col bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 border border-gray-100 ${className}`}>
            {/* Image */}
            <div className="aspect-[4/3] bg-gray-100 overflow-hidden relative">
                {displayImage ? (
                    <img
                        src={displayImage}
                        alt={property.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div className="absolute inset-0 bg-gray-50 flex items-center justify-center">
                        <div className="text-center">
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e5e7eb" strokeWidth="1.5">
                                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                                </svg>
                            </div>
                            <span className="text-xs font-medium text-gray-400">No image</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Card Content */}
            <div className="p-4 flex flex-col flex-1">
                <h3 className="text-sm font-semibold text-gray-900 group-hover:text-green-700 transition-colors line-clamp-1 mb-1">
                    {property.name}
                </h3>

                {/* Price */}
                <div className="flex items-baseline gap-1 mb-2">
                    {property.type === 'Shared Apartment' && property.rooms && property.rooms.length > 0 ? (
                        (() => {
                            const prices = property.rooms.map(r => r.price_per_night);
                            const min = Math.min(...prices);
                            const max = Math.max(...prices);
                            return (
                                <span className="text-green-700 font-bold text-sm">
                                    ₦{min.toLocaleString()} - ₦{max.toLocaleString()}
                                </span>
                            );
                        })()
                    ) : (
                        <span className="text-green-700 font-bold text-sm">₦{property.price_per_night?.toLocaleString()}</span>
                    )}
                    <span className="text-gray-500 text-xs">per night</span>
                </div>

                {/* Star Rating */}
                <div className="flex items-center gap-0.5 mb-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                            key={i}
                            size={14}
                            className={i < fullStars ? 'fill-amber-400 text-amber-400' : (i === fullStars && hasHalf ? 'fill-amber-400/50 text-amber-400' : 'fill-gray-200 text-gray-200')}
                        />
                    ))}
                </div>

                {/* View Details Button */}
                <div className="mt-auto">
                    <span className="inline-block w-full text-center bg-green-500 hover:bg-green-600 text-white text-xs font-semibold py-2.5 px-4 rounded-md transition-colors duration-200">
                        View Details
                    </span>
                </div>
            </div>
        </Link>
    );
}
