'use client';

import { useState, useMemo } from 'react';
import { format, addDays, subDays } from 'date-fns';
import {
    Copy, Plus, CheckCircle, RefreshCw, Search, CalendarDays,
    MapPin, Building2, Phone, Mail, User, ArrowRight, MessageCircle,
    Clock, AlertCircle, ChevronRight
} from 'lucide-react';
import BookingCalendar from '@/components/BookingCalendar';
import type { Property, Room, Availability } from '@/types/database';

interface PropertyWithRooms extends Property {
    rooms: Room[];
}

interface Props {
    properties: PropertyWithRooms[];
    availability: Availability[];
}

type Step = 'dates' | 'property' | 'details';

export default function OperatorDashboardClient({ properties, availability }: Props) {
    // Step tracker
    const [currentStep, setCurrentStep] = useState<Step>('dates');

    // Date selection (global - selected before property)
    const [globalCheckIn, setGlobalCheckIn] = useState<Date | null>(null);
    const [globalCheckOut, setGlobalCheckOut] = useState<Date | null>(null);

    // Search
    const [searchQuery, setSearchQuery] = useState('');

    // Property/Room selection
    const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
    const [selectedRoomId, setSelectedRoomId] = useState<string>('');

    // Guest details
    const [guestName, setGuestName] = useState('');
    const [guestEmail, setGuestEmail] = useState('');
    const [guestPhone, setGuestPhone] = useState('');

    // UI state
    const [isBooking, setIsBooking] = useState(false);
    const [paystackLink, setPaystackLink] = useState('');
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const [showSuggestDates, setShowSuggestDates] = useState(false);

    const selectedProperty = properties.find(p => p.id === selectedPropertyId);
    const selectedRoom = selectedProperty?.rooms.find(r => r.id === selectedRoomId);

    // ===== AVAILABILITY HELPERS =====

    // Check if a property has rooms available for a given date range
    const isPropertyAvailableForDates = (property: PropertyWithRooms, checkIn: Date, checkOut: Date): boolean => {
        return property.rooms.some(room => {
            const roomAvail = availability.filter(a => a.room_id === room.id);
            const currentDate = new Date(checkIn);
            while (currentDate < checkOut) {
                const dateStr = format(currentDate, 'yyyy-MM-dd');
                const dayAvail = roomAvail.find(a => a.date === dateStr);
                if (dayAvail && (dayAvail.status === 'booked' || dayAvail.status === 'held')) {
                    return false;
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }
            return true;
        });
    };

    // Filter properties based on search query and date availability
    const filteredProperties = useMemo(() => {
        let filtered = properties;

        // Filter by search query (name or area)
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(q) ||
                (p.area && p.area.toLowerCase().includes(q)) ||
                p.city.toLowerCase().includes(q)
            );
        }

        // Filter by date availability if dates are selected
        if (globalCheckIn && globalCheckOut) {
            filtered = filtered.filter(property =>
                isPropertyAvailableForDates(property, globalCheckIn, globalCheckOut)
            );
        }

        return filtered;
    }, [properties, searchQuery, globalCheckIn, globalCheckOut, availability]);

    // ===== SUGGEST ALTERNATIVE DATES =====
    // When the customer's dates don't work, find nearby date ranges that DO work
    const suggestedDateRanges = useMemo(() => {
        if (!globalCheckIn || !globalCheckOut) return [];

        const nights = Math.ceil((globalCheckOut.getTime() - globalCheckIn.getTime()) / (1000 * 60 * 60 * 24));
        const suggestions: { checkIn: Date; checkOut: Date; label: string; availableCount: number }[] = [];

        // Try shifting dates forward and backward by 1-7 days
        const offsets = [-3, -2, -1, 1, 2, 3, 4, 5, 7];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const offset of offsets) {
            const newCheckIn = addDays(globalCheckIn, offset);
            const newCheckOut = addDays(newCheckIn, nights);

            // Skip dates in the past
            if (newCheckIn < today) continue;

            // Skip the already-selected range
            if (newCheckIn.getTime() === globalCheckIn.getTime()) continue;

            // Count available properties for this range
            const availableCount = properties.filter(p =>
                isPropertyAvailableForDates(p, newCheckIn, newCheckOut)
            ).length;

            if (availableCount > 0) {
                const direction = offset > 0 ? 'later' : 'earlier';
                const dayLabel = Math.abs(offset) === 1 ? 'day' : 'days';
                suggestions.push({
                    checkIn: newCheckIn,
                    checkOut: newCheckOut,
                    label: `${Math.abs(offset)} ${dayLabel} ${direction}`,
                    availableCount,
                });
            }
        }

        // Deduplicate and sort by proximity (closest offsets first — they already are)
        return suggestions.slice(0, 6);
    }, [globalCheckIn, globalCheckOut, properties, availability]);

    // Room-specific availability for the selected room (for the calendar display)
    const roomAvailability = selectedRoom
        ? availability.filter(a => a.room_id === selectedRoom.id)
        : [];

    // ===== QUICK STATS =====
    const totalProperties = properties.length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ===== EVENT HANDLERS =====

    const handleGlobalDateSelect = (ci: Date, co: Date) => {
        setGlobalCheckIn(ci);
        // Only advance if BOTH dates are selected (co is truthy and not null)
        if (co) {
            setGlobalCheckOut(co);
            setError('');
            setCurrentStep('property');
            setShowSuggestDates(false);
        } else {
            setGlobalCheckOut(null);
        }
    };

    const handleSuggestedDateSelect = (checkIn: Date, checkOut: Date) => {
        setGlobalCheckIn(checkIn);
        setGlobalCheckOut(checkOut);
        setShowSuggestDates(false);
        setError('');
        // Stay on property step — just refresh the list
    };

    const handlePropertySelect = (property: PropertyWithRooms) => {
        setSelectedPropertyId(property.id);
        setSelectedRoomId(property.rooms[0]?.id || '');
        setCurrentStep('details');
    };

    const handleGenerateLink = async () => {
        if (!selectedProperty || !selectedRoom || !globalCheckIn || !globalCheckOut || !guestName || !guestEmail) {
            setError('Please fill in all required fields (Property, Room, Dates, Name, Email).');
            return;
        }

        setIsBooking(true);
        setError('');
        setPaystackLink('');

        try {
            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomId: selectedRoom.id,
                    propertyId: selectedProperty.id,
                    guestName,
                    guestEmail,
                    guestPhone,
                    checkIn: format(globalCheckIn, 'yyyy-MM-dd'),
                    checkOut: format(globalCheckOut, 'yyyy-MM-dd'),
                    isManualBooking: false,
                    bookingSource: 'operator',
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate link');
            }

            if (data.paystackUrl) {
                setPaystackLink(data.paystackUrl);
            } else {
                throw new Error('Link generation succeeded, but no Paystack URL was returned.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setIsBooking(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(paystackLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleWhatsAppShare = () => {
        if (!paystackLink || !guestPhone) return;
        const phone = guestPhone.replace(/\D/g, '');
        const message = `Hi ${guestName}! 🏠\n\nHere's your booking payment link for *${selectedProperty?.name}*:\n\n📅 ${globalCheckIn && format(globalCheckIn, 'MMM d')} → ${globalCheckOut && format(globalCheckOut, 'MMM d, yyyy')}\n💰 ₦${totalAmount.toLocaleString()}\n\n🔗 ${paystackLink}\n\nPlease complete payment within 30 minutes to secure your booking. Thank you!\n\n— 9jaRooms`;
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    };

    const resetForm = () => {
        setCurrentStep('dates');
        setSelectedPropertyId('');
        setSelectedRoomId('');
        setGlobalCheckIn(null);
        setGlobalCheckOut(null);
        setGuestName('');
        setGuestEmail('');
        setGuestPhone('');
        setPaystackLink('');
        setError('');
        setSearchQuery('');
        setShowSuggestDates(false);
    };

    const pricePerNight = selectedRoom?.price_per_night || selectedProperty?.price_per_night || 0;
    const nights = globalCheckIn && globalCheckOut
        ? Math.ceil((globalCheckOut.getTime() - globalCheckIn.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
    const totalAmount = pricePerNight * nights;

    return (
        <div className="space-y-6">
            {/* Quick Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center">
                        <Building2 size={18} className="text-green-600" />
                    </div>
                    <div>
                        <p className="text-lg font-bold text-gray-900">{totalProperties}</p>
                        <p className="text-xs text-gray-500">Properties</p>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                        <CalendarDays size={18} className="text-blue-600" />
                    </div>
                    <div>
                        <p className="text-lg font-bold text-gray-900">
                            {filteredProperties.length}
                        </p>
                        <p className="text-xs text-gray-500">
                            {globalCheckIn && globalCheckOut ? 'Available' : 'Active'}
                        </p>
                    </div>
                </div>
                <div className="hidden sm:flex bg-white rounded-xl border border-gray-100 px-4 py-3 items-center gap-3">
                    <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center">
                        <Clock size={18} className="text-amber-600" />
                    </div>
                    <div>
                        <p className="text-lg font-bold text-gray-900">30m</p>
                        <p className="text-xs text-gray-500">Hold time</p>
                    </div>
                </div>
            </div>

            {/* Step Indicators */}
            <div className="flex items-center gap-2 sm:gap-3 text-sm">
                {[
                    { step: 'dates' as Step, label: 'Select Dates', icon: CalendarDays },
                    { step: 'property' as Step, label: 'Choose Property', icon: Building2 },
                    { step: 'details' as Step, label: 'Guest Details', icon: User },
                ].map((s, i) => {
                    const Icon = s.icon;
                    const isActive = currentStep === s.step;
                    const isDone = (s.step === 'dates' && (currentStep === 'property' || currentStep === 'details'))
                        || (s.step === 'property' && currentStep === 'details');
                    return (
                        <div key={s.step} className="flex items-center gap-2 sm:gap-3">
                            {i > 0 && <div className={`hidden sm:block w-8 h-px ${isDone || isActive ? 'bg-green-400' : 'bg-gray-200'}`} />}
                            <button
                                onClick={() => {
                                    if (isDone || isActive) setCurrentStep(s.step);
                                }}
                                disabled={!isDone && !isActive}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${isActive
                                    ? 'bg-green-500 text-white shadow-sm'
                                    : isDone
                                        ? 'bg-green-50 text-green-700 hover:bg-green-100 cursor-pointer'
                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    }`}
                            >
                                <Icon size={14} />
                                <span className="hidden sm:inline">{s.label}</span>
                                <span className="sm:hidden">{i + 1}</span>
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* ===== STEP 1: DATE SELECTION ===== */}
            {currentStep === 'dates' && (
                <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">When does the customer need a room?</h2>
                    <p className="text-sm text-gray-500 mb-4">Select check-in and check-out dates to see available properties.</p>
                    <BookingCalendar
                        availability={[]}
                        onDateSelect={handleGlobalDateSelect}
                        selectedCheckIn={globalCheckIn}
                        selectedCheckOut={globalCheckOut}
                    />
                </div>
            )}

            {/* ===== STEP 2: PROPERTY SELECTION ===== */}
            {currentStep === 'property' && (
                <div className="space-y-4">
                    {/* Date Summary */}
                    <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 flex flex-wrap items-center gap-2 sm:gap-4 text-sm">
                        <CalendarDays size={16} className="text-green-600 shrink-0" />
                        <span className="font-medium text-green-800">
                            {globalCheckIn && format(globalCheckIn, 'MMM d, yyyy')} → {globalCheckOut && format(globalCheckOut, 'MMM d, yyyy')}
                        </span>
                        <span className="text-green-600">({nights} night{nights !== 1 ? 's' : ''})</span>
                        <button onClick={() => setCurrentStep('dates')} className="ml-auto text-green-600 hover:text-green-800 font-medium text-xs underline">
                            Change dates
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by property name, area, or city..."
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 bg-white"
                            autoFocus
                        />
                    </div>

                    {/* Available Properties */}
                    <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">Available Properties</h2>
                                <p className="text-sm text-gray-500">
                                    {filteredProperties.length} propert{filteredProperties.length !== 1 ? 'ies' : 'y'} available
                                </p>
                            </div>
                            {/* Suggest Other Dates button */}
                            {filteredProperties.length < properties.length && (
                                <button
                                    onClick={() => setShowSuggestDates(!showSuggestDates)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-colors"
                                >
                                    <CalendarDays size={13} />
                                    <span className="hidden sm:inline">Suggest other dates</span>
                                    <span className="sm:hidden">Other dates</span>
                                </button>
                            )}
                        </div>

                        {/* Suggested Date Ranges */}
                        {showSuggestDates && suggestedDateRanges.length > 0 && (
                            <div className="mb-4 p-4 bg-amber-50/50 border border-amber-100 rounded-xl">
                                <p className="text-sm font-medium text-amber-800 mb-3 flex items-center gap-1.5">
                                    <AlertCircle size={14} />
                                    More properties available on nearby dates:
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {suggestedDateRanges.map((range, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleSuggestedDateSelect(range.checkIn, range.checkOut)}
                                            className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-100 hover:border-green-400 hover:bg-green-50/50 transition-all text-left group"
                                        >
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">
                                                    {format(range.checkIn, 'MMM d')} → {format(range.checkOut, 'MMM d')}
                                                </p>
                                                <p className="text-xs text-gray-500">{range.label}</p>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                                                    {range.availableCount} available
                                                </span>
                                                <ChevronRight size={14} className="text-gray-300 group-hover:text-green-500" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {showSuggestDates && suggestedDateRanges.length === 0 && (
                            <div className="mb-4 p-4 bg-gray-50 rounded-xl text-sm text-gray-500 text-center">
                                No alternative dates found with more availability in the nearby range.
                            </div>
                        )}

                        {/* Property List */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[450px] overflow-y-auto pr-1 custom-scrollbar">
                            {filteredProperties.map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => handlePropertySelect(p)}
                                    className="cursor-pointer p-4 rounded-xl border border-gray-200 bg-white hover:border-green-400 hover:bg-green-50/50 hover:shadow-sm transition-all group"
                                >
                                    <div className="flex items-start gap-3">
                                        {p.thumbnail ? (
                                            <img src={p.thumbnail} alt={p.name} className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover shrink-0" />
                                        ) : (
                                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                                <Building2 size={24} className="text-gray-400" />
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <h3 className="font-medium text-gray-900 group-hover:text-green-800 transition-colors truncate">{p.name}</h3>
                                            <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                                                <MapPin size={11} className="shrink-0" />
                                                <span className="truncate">{p.area ? `${p.area}, ` : ''}{p.city}</span>
                                            </div>
                                            <div className="flex items-center justify-between mt-2">
                                                <p className="text-sm font-semibold text-green-700">
                                                    ₦{p.price_per_night.toLocaleString()}<span className="text-xs font-normal text-gray-400">/night</span>
                                                </p>
                                                {nights > 0 && (
                                                    <p className="text-xs text-gray-500">
                                                        Total: ₦{(p.price_per_night * nights).toLocaleString()}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {filteredProperties.length === 0 && (
                                <div className="col-span-full text-center py-8">
                                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Building2 size={24} className="text-gray-400" />
                                    </div>
                                    <p className="text-gray-500 text-sm font-medium">No properties available for these dates</p>
                                    <p className="text-gray-400 text-xs mt-1">Try suggesting other dates or clearing your search</p>
                                    <div className="flex items-center justify-center gap-3 mt-4">
                                        {searchQuery && (
                                            <button onClick={() => setSearchQuery('')} className="text-sm text-green-600 underline">Clear search</button>
                                        )}
                                        <button
                                            onClick={() => setShowSuggestDates(true)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-colors"
                                        >
                                            <CalendarDays size={13} />
                                            Suggest other dates
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ===== STEP 3: GUEST DETAILS & GENERATE LINK ===== */}
            {currentStep === 'details' && selectedProperty && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left: Summary + Guest Form */}
                    <div className="space-y-4">
                        {/* Booking Summary Card */}
                        <div className="bg-green-50 border border-green-100 rounded-xl p-4 space-y-2">
                            <div className="flex items-center gap-2 text-sm text-green-800">
                                <CalendarDays size={14} className="shrink-0" />
                                <span className="font-medium">
                                    {globalCheckIn && format(globalCheckIn, 'MMM d')} → {globalCheckOut && format(globalCheckOut, 'MMM d, yyyy')}
                                </span>
                                <span className="text-green-600 text-xs">({nights} night{nights !== 1 ? 's' : ''})</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-green-800">
                                <Building2 size={14} className="shrink-0" />
                                <span className="font-medium">{selectedProperty.name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-green-800">
                                <MapPin size={14} className="shrink-0" />
                                <span>{selectedProperty.area ? `${selectedProperty.area}, ` : ''}{selectedProperty.city}</span>
                            </div>
                            <div className="pt-2 border-t border-green-200 flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <span className="text-xs text-green-600">₦{pricePerNight.toLocaleString()}/night × {nights}</span>
                                    <p className="text-sm font-bold text-green-900">Total: ₦{totalAmount.toLocaleString()}</p>
                                </div>
                                <button onClick={() => setCurrentStep('property')} className="text-xs text-green-600 hover:text-green-800 underline">
                                    Change property
                                </button>
                            </div>
                        </div>

                        {/* Guest Form */}
                        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                            <h2 className="text-lg font-semibold text-gray-900">Customer Details</h2>
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block flex items-center gap-1.5">
                                    <User size={13} className="text-gray-400" /> Full Name *
                                </label>
                                <input
                                    type="text"
                                    value={guestName}
                                    onChange={(e) => setGuestName(e.target.value)}
                                    placeholder="Customer's Full Name"
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block flex items-center gap-1.5">
                                    <Mail size={13} className="text-gray-400" /> Email *
                                </label>
                                <input
                                    type="email"
                                    value={guestEmail}
                                    onChange={(e) => setGuestEmail(e.target.value)}
                                    placeholder="customer@example.com"
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block flex items-center gap-1.5">
                                    <Phone size={13} className="text-gray-400" /> Phone Number
                                </label>
                                <input
                                    type="tel"
                                    value={guestPhone}
                                    onChange={(e) => setGuestPhone(e.target.value)}
                                    placeholder="+234..."
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400"
                                />
                                <p className="text-xs text-gray-400 mt-1">Required for WhatsApp delivery of payment link</p>
                            </div>
                        </div>
                    </div>

                    {/* Right: Calendar confirmation + Generate */}
                    <div className="space-y-4">
                        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Confirm Dates</h2>
                            <BookingCalendar
                                availability={roomAvailability}
                                onDateSelect={(ci, co) => {
                                    setGlobalCheckIn(ci);
                                    if (co) {
                                        setGlobalCheckOut(co);
                                    } else {
                                        setGlobalCheckOut(null);
                                    }
                                    setError('');
                                }}
                                selectedCheckIn={globalCheckIn}
                                selectedCheckOut={globalCheckOut}
                            />

                            {nights > 0 && (
                                <div className="mt-6 pt-4 border-t border-gray-100">
                                    <div className="flex justify-between font-semibold text-lg text-gray-900">
                                        <span>Total ({nights} night{nights !== 1 ? 's' : ''})</span>
                                        <span>₦{totalAmount.toLocaleString()}</span>
                                    </div>

                                    {!paystackLink ? (
                                        <div className="mt-6 space-y-4">
                                            {error && (
                                                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl flex items-start gap-2">
                                                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                                                    {error}
                                                </div>
                                            )}
                                            <button
                                                onClick={handleGenerateLink}
                                                disabled={isBooking}
                                                className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white py-3.5 rounded-xl font-semibold transition-colors"
                                            >
                                                {isBooking ? <RefreshCw className="animate-spin" size={20} /> : <Plus size={20} />}
                                                {isBooking ? 'Generating Link...' : 'Generate Payment Link'}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="mt-6 space-y-4">
                                            {/* Success: Payment Link */}
                                            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <CheckCircle size={16} className="text-green-600" />
                                                    <p className="text-sm text-green-800 font-medium">Room blocked for 30 minutes</p>
                                                </div>
                                                <p className="text-xs text-green-700 mb-3">Send this payment link to the customer:</p>
                                                <div className="flex bg-white border border-green-100 p-2 rounded-lg gap-1">
                                                    <input
                                                        readOnly
                                                        value={paystackLink}
                                                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-gray-600 px-2 min-w-0"
                                                    />
                                                    <button
                                                        onClick={handleCopy}
                                                        className="px-3 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded-md text-sm font-medium flex items-center gap-1 transition-colors shrink-0"
                                                    >
                                                        {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                                                        {copied ? 'Copied!' : 'Copy'}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Quick Actions */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {guestPhone && (
                                                    <button
                                                        onClick={handleWhatsAppShare}
                                                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#25D366] hover:bg-[#20BD5A] text-white rounded-xl text-sm font-medium transition-colors"
                                                    >
                                                        <MessageCircle size={16} />
                                                        Send via WhatsApp
                                                    </button>
                                                )}
                                                <button
                                                    onClick={resetForm}
                                                    className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-sm font-medium transition-colors"
                                                >
                                                    <Plus size={16} />
                                                    New Booking
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
