import Link from 'next/link';
import { Star, MapPin } from 'lucide-react';
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
        <Link href={`/property/${property.id}`} className={`group block cursor-pointer ${className}`}>
            {/* Image */}
            <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden relative">
                {displayImage ? (
                    <img
                        src={displayImage}
                        alt={property.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div className="absolute inset-0 bg-gray-50 flex items-center justify-center">
                        <div className="text-center">
                            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e5e7eb" strokeWidth="1.5">
                                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                                </svg>
                            </div>
                            <span className="text-[10px] font-medium text-gray-400">No image</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Card Content — tight spacing like Airbnb */}
            <div className="pt-2 pb-1">
                <div className="flex items-start justify-between gap-1">
                    <h3 className="text-sm font-medium text-gray-900 line-clamp-1">
                        {property.name}
                    </h3>
                    {/* Rating inline */}
                    <div className="flex items-center gap-0.5 shrink-0">
                        <Star size={12} className="fill-amber-400 text-amber-400" />
                        <span className="text-xs text-gray-700 font-medium">{rating}</span>
                    </div>
                </div>

                {/* Location */}
                {property.area && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{property.area}, {property.city}</p>
                )}

                {/* Price */}
                <div className="mt-1">
                    {property.type === 'Shared Apartment' && property.rooms && property.rooms.length > 0 ? (
                        (() => {
                            const prices = property.rooms.map(r => r.price_per_night);
                            const min = Math.min(...prices);
                            const max = Math.max(...prices);
                            return (
                                <span className="text-sm font-semibold text-gray-900">
                                    ₦{min.toLocaleString()} – ₦{max.toLocaleString()} <span className="font-normal text-gray-500">night</span>
                                </span>
                            );
                        })()
                    ) : (
                        <span className="text-sm font-semibold text-gray-900">₦{property.price_per_night?.toLocaleString()} <span className="font-normal text-gray-500">night</span></span>
                    )}
                </div>
            </div>
        </Link>
    );
}
