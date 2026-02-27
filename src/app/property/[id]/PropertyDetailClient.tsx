'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
    MapPin,
    Users,
    Clock,
    Wifi,
    Wind,
    Tv,
    Car,
    Shield,
    Dumbbell,
    Waves,
    Zap,
    Check,
    ChevronRight,
} from 'lucide-react';
import BookingCalendar from '@/components/BookingCalendar';
import PropertyGallery from '@/components/PropertyGallery';
import type { Property, Room, Availability } from '@/types/database';

const amenityIconMap: Record<string, React.ReactNode> = {
    'WiFi': <Wifi size={18} />,
    'AC': <Wind size={18} />,
    'Smart TV': <Tv size={18} />,
    'TV': <Tv size={18} />,
    'Parking': <Car size={18} />,
    'Security': <Shield size={18} />,
    'Gym': <Dumbbell size={18} />,
    'Pool': <Waves size={18} />,
    'Power Backup': <Zap size={18} />,
};

interface Props {
    property: Property;
    rooms: Room[];
    availability: Availability[];
}

export default function PropertyDetailClient({ property, rooms, availability }: Props) {
    const router = useRouter();
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(rooms.length === 1 ? rooms[0] : null);
    const [checkIn, setCheckIn] = useState<Date | null>(null);
    const [checkOut, setCheckOut] = useState<Date | null>(null);
    const [guestName, setGuestName] = useState('');
    const [guestEmail, setGuestEmail] = useState('');
    const [guestPhone, setGuestPhone] = useState('');
    const [isBooking, setIsBooking] = useState(false);
    const [showBookingForm, setShowBookingForm] = useState(false);
    const [error, setError] = useState('');

    const pricePerNight = selectedRoom?.price_per_night || property.price_per_night;
    const nights = checkIn && checkOut
        ? Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
    const totalAmount = pricePerNight * nights;

    const formatPrice = (price: number) =>
        new Intl.NumberFormat('en-NG').format(price);

    const roomAvailability = selectedRoom
        ? availability.filter((a) => a.room_id === selectedRoom.id)
        : [];

    const handleDateSelect = (ci: Date, co: Date) => {
        setCheckIn(ci);
        setCheckOut(co);
        setError('');
    };

    const handleBooking = async () => {
        if (!selectedRoom || !checkIn || !checkOut || !guestName || !guestEmail) {
            setError('Please fill in all required fields');
            return;
        }

        setIsBooking(true);
        setError('');

        try {
            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomId: selectedRoom.id,
                    propertyId: property.id,
                    guestName,
                    guestEmail,
                    guestPhone,
                    checkIn: format(checkIn, 'yyyy-MM-dd'),
                    checkOut: format(checkOut, 'yyyy-MM-dd'),
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create booking');
            }

            // Redirect to payment page
            if (data.bookingId) {
                router.push(`/booking/pay/${data.bookingId}`);
            } else {
                router.push(`/booking/pending?email=${encodeURIComponent(guestEmail)}`);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setIsBooking(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
                <a href="/" className="hover:text-gray-900 transition-colors">Properties</a>
                <ChevronRight size={14} />
                <span className="text-gray-900 font-medium">{property.name}</span>
            </nav>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - Property Details */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Hero Image / Gallery */}
                    <div className="rounded-2xl overflow-hidden shadow-sm">
                        {/* Determine which media to show: selectedRoom media takes precedence if available */}
                        <PropertyGallery
                            key={selectedRoom?.id || 'main'}
                            thumbnail={!selectedRoom ? (property.thumbnail ?? undefined) : undefined}
                            images={selectedRoom?.images?.length ? selectedRoom.images : property.images}
                        />
                    </div>

                    {/* Title & Location */}
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{property.name}</h1>
                        <div className="flex items-center gap-2 mt-2 text-gray-500">
                            <MapPin size={16} />
                            <span>{property.address}, {property.area}, {property.city}</span>
                        </div>
                    </div>

                    {/* Key Info */}
                    <div className="flex items-center gap-6 py-4 border-y border-gray-100">
                        <div className="flex items-center gap-2 text-sm">
                            <Users size={18} className="text-green-500" />
                            <span>{property.max_guests} guests max</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <Clock size={18} className="text-green-500" />
                            <span>Check-in: {property.check_in_time}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <Clock size={18} className="text-green-500" />
                            <span>Check-out: {property.check_out_time}</span>
                        </div>
                    </div>

                    {/* Description */}
                    {property.description && (
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 mb-3">About this place</h2>
                            <p className="text-gray-600 leading-relaxed">{property.description}</p>
                        </div>
                    )}

                    {/* Amenities */}
                    {property.amenities && property.amenities.length > 0 && (
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 mb-3">Amenities</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {property.amenities.map((amenity) => (
                                    <div
                                        key={amenity}
                                        className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 text-sm"
                                    >
                                        <span className="text-green-500">
                                            {amenityIconMap[amenity] || <Check size={18} />}
                                        </span>
                                        {amenity}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* House Rules */}
                    {property.house_rules && (
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 mb-3">House Rules</h2>
                            <p className="text-gray-600 leading-relaxed">{property.house_rules}</p>
                        </div>
                    )}
                </div>

                {/* Right Column - Booking Widget */}
                <div className="lg:col-span-1">
                    <div className="sticky top-24 space-y-6">
                        {/* Price Card */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                            <div className="flex items-baseline gap-1 mb-6">
                                {property.type === 'Shared Apartment' && !selectedRoom && rooms.length > 0 ? (
                                    (() => {
                                        const prices = rooms.map(r => r.price_per_night ?? 0);
                                        const min = Math.min(...prices);
                                        const max = Math.max(...prices);
                                        return (
                                            <span className="text-2xl font-bold text-gray-900">
                                                ₦{formatPrice(min)} - ₦{formatPrice(max)}
                                            </span>
                                        );
                                    })()
                                ) : (
                                    <span className="text-2xl font-bold text-gray-900">₦{formatPrice(pricePerNight)}</span>
                                )}
                                <span className="text-gray-400">/ night</span>
                            </div>

                            {/* Room Selection (if multiple rooms) */}
                            {rooms.length > 1 && (
                                <div className="mb-6">
                                    <label className="text-sm font-medium text-gray-700 mb-2 block">Select Room</label>
                                    <div className="space-y-2">
                                        {rooms.map((room) => (
                                            <button
                                                key={room.id}
                                                onClick={() => {
                                                    setSelectedRoom(room);
                                                    setCheckIn(null);
                                                    setCheckOut(null);
                                                }}
                                                className={`w-full text-left p-3 rounded-xl border transition-all ${selectedRoom?.id === room.id
                                                    ? 'border-green-400 bg-green-50'
                                                    : 'border-gray-100 hover:border-gray-200'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-medium text-sm">{room.name}</p>
                                                        {room.description && (
                                                            <p className="text-xs text-gray-500 mt-0.5">{room.description}</p>
                                                        )}
                                                    </div>
                                                    <span className="text-sm font-semibold">
                                                        ₦{formatPrice(room.price_per_night || property.price_per_night)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                                                    <Users size={12} />
                                                    {room.max_guests} guests
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Calendar */}
                            {selectedRoom ? (
                                <BookingCalendar
                                    availability={roomAvailability}
                                    onDateSelect={handleDateSelect}
                                    selectedCheckIn={checkIn}
                                    selectedCheckOut={checkOut}
                                />
                            ) : (
                                <div className="text-center py-8 text-gray-400 text-sm">
                                    Select a room to view availability
                                </div>
                            )}

                            {/* Pricing Summary */}
                            {checkIn && checkOut && nights > 0 && (
                                <div className="mt-6 pt-4 border-t border-gray-100 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">₦{formatPrice(pricePerNight)} × {nights} nights</span>
                                        <span className="text-gray-900">₦{formatPrice(totalAmount)}</span>
                                    </div>
                                    <div className="flex justify-between font-semibold text-lg pt-2 border-t border-gray-100">
                                        <span>Total</span>
                                        <span className="text-green-600">₦{formatPrice(totalAmount)}</span>
                                    </div>
                                </div>
                            )}

                            {/* Book Button */}
                            {checkIn && checkOut && !showBookingForm && (
                                <button
                                    onClick={() => setShowBookingForm(true)}
                                    className="w-full mt-6 bg-green-500 hover:bg-green-600 text-white py-3.5 rounded-xl font-semibold transition-colors"
                                >
                                    Book Now
                                </button>
                            )}

                            {/* Booking Form */}
                            {showBookingForm && (
                                <div className="mt-6 space-y-4">
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-1 block">Full Name *</label>
                                        <input
                                            type="text"
                                            value={guestName}
                                            onChange={(e) => setGuestName(e.target.value)}
                                            placeholder="John Doe"
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-1 block">Email *</label>
                                        <input
                                            type="email"
                                            value={guestEmail}
                                            onChange={(e) => setGuestEmail(e.target.value)}
                                            placeholder="john@example.com"
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-1 block">Phone</label>
                                        <input
                                            type="tel"
                                            value={guestPhone}
                                            onChange={(e) => setGuestPhone(e.target.value)}
                                            placeholder="+234..."
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400"
                                        />
                                    </div>

                                    {/* 30-min warning */}
                                    <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
                                        ⏰ After booking, you'll have <strong>30 minutes</strong> to complete payment. After that, you'll need to rebook.
                                    </div>

                                    {error && (
                                        <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                                            {error}
                                        </div>
                                    )}

                                    <button
                                        onClick={handleBooking}
                                        disabled={isBooking}
                                        className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white py-3.5 rounded-xl font-semibold transition-colors"
                                    >
                                        {isBooking ? 'Processing...' : `Pay ₦${formatPrice(totalAmount)}`}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
