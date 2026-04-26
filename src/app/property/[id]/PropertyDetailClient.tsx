'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
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
    Copy,
    CheckCircle,
    Phone,
    MessageCircle,
    Tag,
    CalendarDays,
    Sparkles,
} from 'lucide-react';
import BookingCalendar from '@/components/BookingCalendar';
import { trackConversion, CONVERSION_CONTACT } from '@/lib/gtag';
import PropertyGallery from '@/components/PropertyGallery';
import PropertyCard from '@/components/PropertyCard';
import type { Property, Room, Availability, DiscountRule } from '@/types/database';

const amenityIconMap: Record<string, React.ReactNode> = {
    'WiFi': <Wifi size={20} strokeWidth={1.5} />,
    'AC': <Wind size={20} strokeWidth={1.5} />,
    'Smart TV': <Tv size={20} strokeWidth={1.5} />,
    'TV': <Tv size={20} strokeWidth={1.5} />,
    'Parking': <Car size={20} strokeWidth={1.5} />,
    'Security': <Shield size={20} strokeWidth={1.5} />,
    'Gym': <Dumbbell size={20} strokeWidth={1.5} />,
    'Pool': <Waves size={20} strokeWidth={1.5} />,
    'Power Backup': <Zap size={20} strokeWidth={1.5} />,
};

// Find the best applicable discount rule given number of nights
function getBestDiscount(rules: DiscountRule[] | null, nights: number): DiscountRule | null {
    if (!rules || rules.length === 0 || nights <= 0) return null;
    // Sort descending by min_nights and find the first one that qualifies
    const sorted = [...rules].sort((a, b) => b.min_nights - a.min_nights);
    return sorted.find(r => nights >= r.min_nights) || null;
}

// Find the next discount rule the user could qualify for (nudge)
function getNextDiscount(rules: DiscountRule[] | null, nights: number): DiscountRule | null {
    if (!rules || rules.length === 0 || nights <= 0) return null;
    const sorted = [...rules].sort((a, b) => a.min_nights - b.min_nights);
    return sorted.find(r => nights < r.min_nights && r.min_nights - nights <= 3) || null;
}

function formatDiscountText(rule: DiscountRule): string {
    if (rule.discount_percent) return `${rule.discount_percent}% off`;
    if (rule.discount_amount) return `₦${new Intl.NumberFormat('en-NG').format(rule.discount_amount)} off`;
    return '';
}

interface Props {
    property: Property;
    rooms: Room[];
    availability: Availability[];
    contactPhone?: string;
    contactWhatsapp?: string;
    similarProperties?: any[];
}

export default function PropertyDetailClient({ property, rooms, availability, contactPhone, contactWhatsapp, similarProperties = [] }: Props) {
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
    const [bookingSuccess, setBookingSuccess] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const fetchUserForPrefill = async () => {
            try {
                const supabase = createClient();
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    const meta = session.user.user_metadata;
                    if (meta) {
                        if (meta.first_name && meta.last_name) {
                            setGuestName(`${meta.first_name} ${meta.last_name}`);
                        } else if (meta.name) {
                            setGuestName(meta.name);
                        }
                        if (meta.phone) {
                            setGuestPhone(meta.phone);
                        }
                    }
                    if (session.user.email) {
                        setGuestEmail(session.user.email);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch user for prefill:", err);
            }
        };
        fetchUserForPrefill();
    }, []);

    const pricePerNight = selectedRoom?.price_per_night || property.price_per_night;
    const nights = checkIn && checkOut
        ? Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
    const subtotal = pricePerNight * nights;

    // Discount calculations
    const discountRules = property.discount_rules || null;
    const appliedDiscount = getBestDiscount(discountRules, nights);
    const nextDiscount = getNextDiscount(discountRules, nights);

    const discountAmount = useMemo(() => {
        if (!appliedDiscount) return 0;
        if (appliedDiscount.discount_percent) return Math.round(subtotal * appliedDiscount.discount_percent / 100);
        if (appliedDiscount.discount_amount) return appliedDiscount.discount_amount;
        return 0;
    }, [appliedDiscount, subtotal]);

    const totalAmount = subtotal - discountAmount;

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
        if (!selectedRoom || !checkIn || !checkOut || !guestName || !guestEmail || !guestPhone) {
            setError('Please fill in all required fields');
            return;
        }
        if (property.minimum_stay && nights < property.minimum_stay) {
            setError(`Minimum stay is ${property.minimum_stay} nights`);
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
            if (!response.ok) throw new Error(data.error || 'Failed to initialize payment');
            if (data.paystackUrl) {
                window.location.href = data.paystackUrl;
            } else {
                throw new Error('No payment URL returned');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setIsBooking(false);
        }
    };

    const handleWhatsAppEnquiry = () => {
        if (!checkIn || !checkOut) return;
        const whatsappNumber = (contactWhatsapp || '2349067779344').replace(/\D/g, '');
        const propertyUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://9jarooms.com'}/property/${property.id}`;
        const message = [
            `Hi, I'd like to book *${property.name}*`,
            ``,
            `📅 Check-in: ${format(checkIn, 'EEE, MMM d yyyy')}`,
            `📅 Check-out: ${format(checkOut, 'EEE, MMM d yyyy')}`,
            `🌙 ${nights} night${nights !== 1 ? 's' : ''}`,
            `💰 Total: ₦${totalAmount.toLocaleString()}`,
            ``,
            `🔗 ${propertyUrl}`,
            ``,
            `Is it available?`,
        ].join('\n');

        // Meta Pixel — fire when user taps WhatsApp enquiry button
        // Paste your pixel snippet in /app/layout.tsx, then this event auto-tracks
        if (typeof window !== 'undefined' && (window as any).fbq) {
            (window as any).fbq('track', 'InitiateCheckout', {
                content_name: property.name,
                content_type: 'shortlet',
                value: totalAmount,
                currency: 'NGN',
                num_nights: nights,
            });
        }

        window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank');
    };

    const trackPixelContact = (method: 'call' | 'whatsapp') => {
        if (typeof window !== 'undefined' && (window as any).fbq) {
            (window as any).fbq('track', 'Contact', {
                content_name: property.name,
                contact_method: method,
            });
        }
    };

    // Has any discount rules to show
    const hasDiscounts = discountRules && discountRules.length > 0;

    const waNumber = contactWhatsapp?.replace(/\D/g, '') || '';
    const waMessage = encodeURIComponent(`Hi, I'd like to book ${property.name}. Please confirm availability and price.`);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 lg:pb-8">
            {/* Discovery Banner */}
            <a
                href="/properties"
                className="flex items-center justify-between gap-3 mb-6 px-4 py-3 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-colors group"
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    <MapPin size={16} className="text-green-600 shrink-0" />
                    <span className="text-sm font-medium text-green-800 truncate">
                        Exploring {property.city}? Browse all available properties
                    </span>
                </div>
                <ChevronRight size={16} className="text-green-600 shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </a>

            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
                <a href="/properties" className="hover:text-gray-900 transition-colors">Properties</a>
                <ChevronRight size={14} />
                <span className="text-gray-900 font-medium">{property.name}</span>
            </nav>

            {/* Book Directly Banner */}
            {(contactPhone || contactWhatsapp) && (
                <div className="mb-8 rounded-2xl bg-gradient-to-br from-green-600 to-green-700 p-5 sm:p-6 text-white shadow-md">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-widest text-green-200 mb-1">Book Directly</p>
                            <h2 className="text-lg font-bold leading-snug">Prefer to speak with someone first?</h2>
                            <p className="text-sm text-green-100 mt-1">Call or WhatsApp our team — we'll confirm availability and handle your booking for you.</p>
                        </div>
                        <div className="flex gap-3 shrink-0">
                            {contactPhone && (
                                <a
                                    href={`tel:${contactPhone}`}
                                    onClick={() => { trackConversion(CONVERSION_CONTACT); trackPixelContact('call'); }}
                                    className="flex items-center gap-2 px-4 py-3 bg-white/15 hover:bg-white/25 border border-white/20 rounded-xl text-sm font-semibold transition-all"
                                >
                                    <Phone size={16} />
                                    Call Now
                                </a>
                            )}
                            {contactWhatsapp && (
                                <a
                                    href={`https://wa.me/${waNumber}?text=${waMessage}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => { trackConversion(CONVERSION_CONTACT); trackPixelContact('whatsapp'); }}
                                    className="flex items-center gap-2 px-4 py-3 bg-white text-green-700 hover:bg-green-50 rounded-xl text-sm font-semibold transition-all shadow-sm"
                                >
                                    <MessageCircle size={16} />
                                    WhatsApp Us
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - Property Details */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Hero Image / Gallery */}
                    <div className="rounded-2xl overflow-hidden shadow-sm">
                        <PropertyGallery
                            key={selectedRoom?.id || 'main'}
                            thumbnail={!selectedRoom ? (property.thumbnail ?? undefined) : undefined}
                            images={selectedRoom?.images?.length ? selectedRoom.images : property.images}
                        />
                    </div>

                    {/* Title & Location */}
                    <div className="flex flex-col items-center text-center pb-4 border-b border-gray-100">
                        <h1 className="text-3xl md:text-4xl font-serif font-bold text-gray-900">{property.name}</h1>
                        <div className="flex items-center justify-center gap-2 mt-3 text-gray-500">
                            <MapPin size={16} />
                            <span>{property.area}, {property.city}</span>
                        </div>
                        <div className="mt-5">
                            <button
                                onClick={async () => {
                                    try {
                                        await navigator.clipboard.writeText(window.location.href);
                                        setCopied(true);
                                        setTimeout(() => setCopied(false), 2000);
                                    } catch (err) {
                                        console.error('Failed to copy', err);
                                    }
                                }}
                                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-full transition-colors border border-gray-200 shadow-sm"
                            >
                                {copied ? <CheckCircle size={16} strokeWidth={2} className="text-green-500" /> : <Copy size={16} strokeWidth={2} />}
                                <span className="font-medium text-sm">{copied ? 'Link Copied!' : 'Copy Link to Page'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Key Info */}
                    <div className="flex flex-wrap items-center gap-4 sm:gap-6 py-4 border-y border-gray-100">
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
                        {property.minimum_stay && property.minimum_stay > 1 && (
                            <div className="flex items-center gap-2 text-sm">
                                <CalendarDays size={18} className="text-green-500" />
                                <span>{property.minimum_stay} nights minimum</span>
                            </div>
                        )}
                    </div>

                    {/* Discount badges */}
                    {hasDiscounts && (
                        <div className="flex flex-wrap gap-2">
                            {discountRules!.sort((a, b) => a.min_nights - b.min_nights).map((rule, i) => (
                                <div key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-xs font-medium text-amber-800">
                                    <Tag size={12} />
                                    Stay {rule.min_nights}+ nights → {formatDiscountText(rule)}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Description */}
                    {property.description && (
                        <div className="text-center md:text-left">
                            <h2 className="text-xl font-serif font-semibold text-gray-900 mb-4">About this place</h2>
                            <p className="text-gray-600 leading-relaxed text-lg font-light">{property.description}</p>
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
                        <div className="text-center md:text-left">
                            <h2 className="text-xl font-serif font-semibold text-gray-900 mb-4">House Rules</h2>
                            <p className="text-gray-600 leading-relaxed font-light">{property.house_rules}</p>
                        </div>
                    )}
                </div>

                {/* Right Column - Booking Widget */}
                <div className="lg:col-span-1">
                    <div className="sticky top-24 space-y-6">
                        {/* Price Card */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                            <div className="flex items-baseline gap-1 mb-2">
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

                            {/* Minimum stay badge */}
                            {property.minimum_stay && property.minimum_stay > 1 && (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium mb-4">
                                    <CalendarDays size={12} />
                                    Minimum {property.minimum_stay} nights
                                </div>
                            )}

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
                                    minimumStay={property.minimum_stay || 1}
                                />
                            ) : (
                                <div className="text-center py-8 text-gray-400 text-sm">
                                    Select a room to view availability
                                </div>
                            )}

                            {/* Discount Nudge */}
                            {nextDiscount && nights > 0 && !appliedDiscount && (
                                <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl text-sm flex items-start gap-2">
                                    <Sparkles size={16} className="text-amber-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-amber-800">
                                            Stay {nextDiscount.min_nights} nights to get {formatDiscountText(nextDiscount)}!
                                        </p>
                                        <p className="text-xs text-amber-600 mt-0.5">
                                            Just {nextDiscount.min_nights - nights} more {nextDiscount.min_nights - nights === 1 ? 'night' : 'nights'} to unlock this deal
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Also nudge when they have a discount but there's a better one  */}
                            {appliedDiscount && nextDiscount && (
                                <div className="mt-3 p-2.5 bg-green-50 border border-green-100 rounded-xl text-xs flex items-start gap-2">
                                    <Sparkles size={14} className="text-green-500 shrink-0 mt-0.5" />
                                    <span className="text-green-700">
                                        Stay {nextDiscount.min_nights} nights + to get {formatDiscountText(nextDiscount)} — just {nextDiscount.min_nights - nights} more {nextDiscount.min_nights - nights === 1 ? 'night' : 'nights'}!
                                    </span>
                                </div>
                            )}

                            {/* Pricing Summary */}
                            {checkIn && checkOut && nights > 0 && (
                                <div className="mt-6 pt-4 border-t border-gray-100 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">₦{formatPrice(pricePerNight)} × {nights} nights</span>
                                        <span className="text-gray-900">₦{formatPrice(subtotal)}</span>
                                    </div>
                                    {appliedDiscount && discountAmount > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-green-600 flex items-center gap-1">
                                                <Tag size={12} />
                                                {formatDiscountText(appliedDiscount)} ({appliedDiscount.min_nights}+ nights)
                                            </span>
                                            <span className="text-green-600">-₦{formatPrice(discountAmount)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between font-semibold text-lg pt-2 border-t border-gray-100">
                                        <span>Total</span>
                                        <div className="text-right">
                                            {appliedDiscount && discountAmount > 0 && (
                                                <span className="text-sm line-through text-gray-400 mr-2">₦{formatPrice(subtotal)}</span>
                                            )}
                                            <span className="text-green-600">₦{formatPrice(totalAmount)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* WhatsApp Enquiry Button */}
                            {checkIn && checkOut ? (
                                <button
                                    onClick={handleWhatsAppEnquiry}
                                    className="w-full mt-6 bg-[#25D366] hover:bg-[#1ebe5d] text-white py-3.5 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm"
                                >
                                    <MessageCircle size={18} />
                                    Enquire on WhatsApp
                                </button>
                            ) : (
                                <button
                                    disabled
                                    className="w-full mt-6 bg-gray-100 text-gray-400 py-3.5 rounded-xl font-semibold cursor-not-allowed"
                                >
                                    Select dates to enquire
                                </button>
                            )}
                            {checkIn && checkOut && (
                                <p className="text-center text-xs text-gray-400 mt-2">Our team will confirm availability and send your payment link</p>
                            )}

                            {/* Direct Payment Option */}
                            {checkIn && checkOut && (
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <p className="text-xs text-gray-400 text-center mb-3">
                                        We apologise for the inconvenience — you can also pay directly below.
                                    </p>
                                    {!showBookingForm ? (
                                        <button
                                            onClick={() => setShowBookingForm(true)}
                                            className="w-full py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                                        >
                                            Pay Directly — ₦{formatPrice(totalAmount)}
                                        </button>
                                    ) : (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs font-medium text-gray-600 mb-1 block">Full Name *</label>
                                                <input
                                                    type="text"
                                                    value={guestName}
                                                    onChange={(e) => setGuestName(e.target.value)}
                                                    placeholder="John Doe"
                                                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-400"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-gray-600 mb-1 block">Email *</label>
                                                <input
                                                    type="email"
                                                    value={guestEmail}
                                                    onChange={(e) => setGuestEmail(e.target.value)}
                                                    placeholder="john@example.com"
                                                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-400"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-gray-600 mb-1 block">Phone *</label>
                                                <input
                                                    type="tel"
                                                    value={guestPhone}
                                                    onChange={(e) => setGuestPhone(e.target.value)}
                                                    placeholder="+234..."
                                                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-400"
                                                />
                                            </div>
                                            {error && (
                                                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600">{error}</div>
                                            )}
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setShowBookingForm(false)}
                                                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={handleBooking}
                                                    disabled={isBooking}
                                                    className="flex-1 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
                                                >
                                                    {isBooking ? 'Processing...' : `Pay ₦${formatPrice(totalAmount)}`}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>

            {/* Sticky mobile bottom bar */}
            {(contactPhone || contactWhatsapp) && (
                <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white border-t border-gray-100 px-4 py-3 flex gap-3 shadow-lg">
                    {contactPhone && (
                        <a
                            href={`tel:${contactPhone}`}
                            onClick={() => { trackConversion(CONVERSION_CONTACT); trackPixelContact('call'); }}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
                        >
                            <Phone size={16} className="text-green-600" />
                            Call Now
                        </a>
                    )}
                    {contactWhatsapp && (
                        <a
                            href={`https://wa.me/${waNumber}?text=${waMessage}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => { trackConversion(CONVERSION_CONTACT); trackPixelContact('whatsapp'); }}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-semibold transition-colors"
                        >
                            <MessageCircle size={16} />
                            WhatsApp Us
                        </a>
                    )}
                </div>
            )}

            {/* Similar Properties */}
            {similarProperties.length > 0 && (
                <div className="mt-16 pt-10 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-serif font-semibold text-gray-900">
                                More stays in {property.area}
                            </h2>
                            <p className="text-sm text-gray-400 mt-1">You might also like these</p>
                        </div>
                        <a
                            href="/properties"
                            className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-green-600 hover:text-green-700 transition-colors"
                        >
                            View all <ChevronRight size={16} />
                        </a>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                        {similarProperties.map((p) => (
                            <PropertyCard key={p.id} property={p} />
                        ))}
                    </div>

                    <a
                        href="/properties"
                        className="mt-8 flex items-center justify-center gap-2 w-full py-3.5 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-colors"
                    >
                        View all properties in {property.city}
                        <ChevronRight size={18} />
                    </a>
                </div>
            )}
        </div>
    );
}
