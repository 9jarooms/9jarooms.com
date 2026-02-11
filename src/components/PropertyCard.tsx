import Link from 'next/link';
import { MapPin, Users, Star } from 'lucide-react';
import { Property } from '@/types/database';

const amenityIcons: Record<string, React.ReactNode> = {
    'WiFi': <span className="text-xs">📶</span>,
    'AC': <span className="text-xs">❄️</span>,
    'Kitchen': <span className="text-xs">🍳</span>,
    'TV': <span className="text-xs">📺</span>,
    // fallback icons using Lucide if preferred, but emojis are fine for now
};

export default function PropertyCard({ property, className = '' }: { property: Property, className?: string }) {
    return (
        <Link href={`/property/${property.id}`} className={`group block cursor-pointer flex flex-col gap-4 ${className}`}>
            {/* Image ratio changed to 4:3 for more elegance */}
            <div className="aspect-[4/3] bg-gray-100 rounded-[24px] overflow-hidden relative isolate">
                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-10 transition-opacity duration-300 z-10" />

                {/* Image */}
                {property?.images?.[0] ? (
                    <img
                        src={property.images[0]}
                        alt={property.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
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

                {/* Badge */}
                <div className="absolute top-4 left-4 z-20">
                    {property.is_active ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/90 backdrop-blur-md text-[11px] font-semibold tracking-wide uppercase text-green-800 shadow-sm border border-white/20">
                            Available
                        </span>
                    ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-900/90 backdrop-blur-md text-[11px] font-semibold tracking-wide uppercase text-white shadow-sm border border-white/20">
                            Booked
                        </span>
                    )}
                </div>
            </div>

            {/* Content - Removed borders, added cleaner typography */}
            <div>
                <div className="flex justify-between items-start mb-1">
                    <h3 className="font-serif text-lg font-medium text-gray-900 group-hover:text-green-800 transition-colors line-clamp-1">
                        {property.name}
                    </h3>
                    <div className="flex items-center gap-1">
                        <Star size={14} className="fill-current text-green-700 text-green-700" />
                        <span className="text-sm font-medium text-gray-900">4.9</span>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 text-gray-500 mb-3">
                    <MapPin size={14} />
                    <span className="text-sm font-light">{property.address || 'Abuja, Nigeria'}</span>
                </div>

                <div className="flex items-baseline gap-1">
                    <span className="font-semibold text-gray-900">₦{property.price_per_night?.toLocaleString()}</span>
                    <span className="text-gray-500 text-sm font-light">/ night</span>
                </div>
            </div>
        </Link>
    );
}
