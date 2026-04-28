'use client';

import { useState, useMemo, useEffect } from 'react';
import { format, addDays, subDays, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from 'date-fns';
import { Copy, Plus, CheckCircle, RefreshCw, Search, CalendarDays,
    MapPin, Building2, Phone, Mail, User, ArrowRight, MessageCircle,
    Clock, AlertCircle, ChevronRight, CalendarX2, ChevronLeft,
    Pencil, X, ImageOff, Wifi, Wind, Tv, Car, Shield, Dumbbell, Waves, Zap, UtensilsCrossed, Loader2, Check
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import BookingCalendar from '@/components/BookingCalendar';
import MediaUploader from '@/components/MediaUploader';
import type { Property, Room, Availability } from '@/types/database';

interface PropertyWithRooms extends Property {
    rooms: Room[];
}

interface PropertySummary {
    id: string;
    name: string;
    description: string | null;
    area: string | null;
    city: string;
    price_per_night: number;
    max_guests: number;
    amenities: string[];
    images: string[];
    thumbnail: string | null;
    is_active: boolean;
    check_in_instructions: string | null;
    house_rules: string | null;
}

interface Props {
    properties: PropertyWithRooms[];
    allProperties: PropertySummary[];
    availability: Availability[];
    pendingRequests: any[];
}

type Step = 'dates' | 'property' | 'details';
type Tab = 'new' | 'pending' | 'availability' | 'properties';

const ALL_AMENITIES = ['WiFi', 'AC', 'Smart TV', 'TV', 'Kitchen', 'Parking', 'Security', 'Gym', 'Pool', 'Power Backup', 'Laundry', 'Workspace'];

const amenityIcon: Record<string, React.ReactNode> = {
    'WiFi': <Wifi size={13} />, 'AC': <Wind size={13} />, 'Smart TV': <Tv size={13} />, 'TV': <Tv size={13} />,
    'Kitchen': <UtensilsCrossed size={13} />, 'Parking': <Car size={13} />, 'Security': <Shield size={13} />,
    'Gym': <Dumbbell size={13} />, 'Pool': <Waves size={13} />, 'Power Backup': <Zap size={13} />,
};

export default function OperatorDashboardClient({ properties, allProperties, availability, pendingRequests: initialPending }: Props) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<Tab>('new');

    // Availability management state
    const [availPropertyId, setAvailPropertyId] = useState<string>('');
    const [availMonth, setAvailMonth] = useState(new Date());
    const [availSelection, setAvailSelection] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });
    const [availUpdating, setAvailUpdating] = useState(false);
    const [availSuccess, setAvailSuccess] = useState('');
    const [availRoomId, setAvailRoomId] = useState<string>('');
    const [showAvailBlockModal, setShowAvailBlockModal] = useState(false);
    const [availBookingType, setAvailBookingType] = useState<'guest' | 'maintenance'>('guest');
    const [availBlockForm, setAvailBlockForm] = useState({ guestName: '', notes: '' });
    const [availBlockSubmitting, setAvailBlockSubmitting] = useState(false);

    // Properties tab edit state
    const [editingPropId, setEditingPropId] = useState<string | null>(null);
    const [editSaving, setEditSaving] = useState(false);
    const [editSuccess, setEditSuccess] = useState(false);
    const [editError, setEditError] = useState('');
    const [editForm, setEditForm] = useState({
        name: '', description: '', area: '', city: '',
        price_per_night: '', max_guests: '',
        amenities: [] as string[], images: [] as string[], thumbnail: '',
        check_in_instructions: '', house_rules: '',
    });

    function openPropEdit(p: PropertySummary) {
        setEditingPropId(p.id);
        setEditForm({
            name: p.name || '', description: p.description || '',
            area: p.area || '', city: p.city || '',
            price_per_night: p.price_per_night?.toString() || '',
            max_guests: p.max_guests?.toString() || '',
            amenities: p.amenities || [], images: p.images || [],
            thumbnail: p.thumbnail || '',
            check_in_instructions: p.check_in_instructions || '',
            house_rules: p.house_rules || '',
        });
        setEditError(''); setEditSuccess(false);
    }

    async function handlePropSave() {
        if (!editingPropId) return;
        setEditSaving(true); setEditError('');
        try {
            const res = await fetch(`/api/properties/${editingPropId}/settings`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editForm.name, description: editForm.description || null,
                    area: editForm.area, city: editForm.city,
                    price_per_night: Number(editForm.price_per_night),
                    max_guests: Number(editForm.max_guests),
                    amenities: editForm.amenities, images: editForm.images,
                    thumbnail: editForm.thumbnail || editForm.images[0] || null,
                    check_in_instructions: editForm.check_in_instructions || null,
                    house_rules: editForm.house_rules || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save');
            setEditSuccess(true);
            router.refresh();
            setTimeout(() => { setEditingPropId(null); setEditSuccess(false); }, 800);
        } catch (e: any) {
            setEditError(e.message);
        } finally {
            setEditSaving(false);
        }
    }
    const [pendingRequests, setPendingRequests] = useState(initialPending);
    const [confirmingId, setConfirmingId] = useState<string | null>(null);

    // Sync pending requests when server data refreshes (e.g. after router.refresh() from a manual booking)
    useEffect(() => {
        setPendingRequests(initialPending);
    }, [initialPending]);

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

    // Manual Success State
    const [manualSuccess, setManualSuccess] = useState(false);

    const selectedProperty = properties.find(p => p.id === selectedPropertyId);
    const selectedRoom = selectedProperty?.rooms.find(r => r.id === selectedRoomId);

    // Compute Global Availability (dates where ALL properties are unavailable)
    const globalAvailability = useMemo(() => {
        if (!properties.length) return [];

        const allDatesSet = new Set<string>();
        availability.forEach(a => allDatesSet.add(a.date));

        const globalDisabledDates: Availability[] = [];

        Array.from(allDatesSet).forEach(dateStr => {
            // Check if there is AT LEAST ONE property with at least one room available on this date
            const isAnyPropertyAvailable = properties.some(property => {
                return property.rooms.some(room => {
                    const roomAvail = availability.find(a => a.room_id === room.id && a.date === dateStr);
                    return !roomAvail || (roomAvail.status !== 'booked' && roomAvail.status !== 'held' && roomAvail.status !== 'maintenance');
                });
            });

            if (!isAnyPropertyAvailable) {
                // If NO properties are available, mark the date as globally booked
                globalDisabledDates.push({
                    id: `global-${dateStr}`,
                    room_id: 'global',
                    date: dateStr,
                    status: 'booked'
                } as Availability);
            }
        });

        return globalDisabledDates;
    }, [availability, properties]);

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
        setManualSuccess(false);

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
                router.refresh();
            } else if (data.message) {
                setManualSuccess(true);
                router.refresh();
            } else {
                throw new Error(data.warning || data.message || 'Link generation succeeded, but no Paystack URL was returned.');
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
                if (!guestPhone) return;
                const phone = guestPhone.replace(/\D/g, '');
                
                let message: string;
                if (paystackLink) {
                    message = `Hi ${guestName}! 🏠\n\nHere's your booking payment link for *${selectedProperty?.name}*:\n\n📅 ${globalCheckIn && format(globalCheckIn, 'MMM d')} → ${globalCheckOut && format(globalCheckOut, 'MMM d, yyyy')}\n💰 ₦${totalAmount.toLocaleString()}\n\n🔗 ${paystackLink}\n\nPlease complete payment within 30 minutes to secure your booking. Thank you!\n\n— 9jaRooms`;
                } else {
                     message = `Hi ${guestName}! 🏠\n\nYour stay request for *${selectedProperty?.name}* has been received:\n\n📅 ${globalCheckIn && format(globalCheckIn, 'MMM d')} → ${globalCheckOut && format(globalCheckOut, 'MMM d, yyyy')}\n💰 ₦${totalAmount.toLocaleString()}\n\nWe will follow up with you shortly regarding payment details to confirm your booking. Thank you!\n\n— 9jaRooms`;
                }
                
                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
            };

    const handleManualConfirm = async (bookingId: string) => {
        if (!confirm('Are you sure you want to manually confirm this payment? This will block the dates and send confirmation emails to the customer.')) return;
        
        setConfirmingId(bookingId);
        try {
            const res = await fetch('/api/admin/bookings/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to confirm booking');
            
            // Remove from list
            setPendingRequests(prev => prev.filter(b => b.id !== bookingId));
            alert('Payment successfully confirmed!');
        } catch (err: any) {
            alert(err.message || 'Something went wrong');
        } finally {
            setConfirmingId(null);
        }
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

    const handleAvailBlockSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!availBlockForm.guestName.trim()) return;
        const availProp = properties.find(p => p.id === availPropertyId);
        const availRm = availRoomId
            ? availProp?.rooms?.find(r => r.id === availRoomId) ?? availProp?.rooms?.[0]
            : availProp?.rooms?.[0];
        if (!availRm || !availProp || !availSelection.start) return;
        setAvailBlockSubmitting(true);
        const checkIn = availSelection.start;
        const checkOut = availSelection.end || format(addDays(new Date(availSelection.start + 'T00:00:00'), 1), 'yyyy-MM-dd');
        try {
            const res = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomId: availRm.id,
                    propertyId: availProp.id,
                    guestName: availBlockForm.guestName,
                    checkIn,
                    checkOut,
                    isManualBooking: true,
                    bookingType: availBookingType,
                    bookingSource: availBookingType === 'maintenance' ? 'maintenance' : 'operator',
                    notes: availBlockForm.notes,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to block dates');
            setShowAvailBlockModal(false);
            setAvailBlockForm({ guestName: '', notes: '' });
            setAvailSelection({ start: null, end: null });
            setAvailSuccess('Dates blocked successfully!');
            router.refresh();
        } catch (err: any) {
            alert(err.message || 'Something went wrong');
        } finally {
            setAvailBlockSubmitting(false);
        }
    };

    const pricePerNight = selectedRoom?.price_per_night || selectedProperty?.price_per_night || 0;
    const nights = globalCheckIn && globalCheckOut
        ? Math.ceil((globalCheckOut.getTime() - globalCheckIn.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
    const totalAmount = pricePerNight * nights;

    return (
        <div className="space-y-6">
            {/* Tabs */}
            <div className="flex items-center gap-4 overflow-x-auto whitespace-nowrap border-b border-gray-200 no-scrollbar pb-1">
                <button 
                    onClick={() => setActiveTab('new')}
                    className={`pb-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'new' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Create New Booking
                </button>
                <button 
                    onClick={() => setActiveTab('pending')}
                    className={`pb-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'pending' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Pending Stay Requests
                    {pendingRequests.length > 0 && (
                        <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-bold">
                            {pendingRequests.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('availability')}
                    className={`pb-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'availability' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <CalendarX2 size={14} />
                    Manage Availability
                </button>
                <button
                    onClick={() => setActiveTab('properties')}
                    className={`pb-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'properties' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <Building2 size={14} />
                    Properties
                </button>
            </div>

            {activeTab === 'pending' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col w-full max-w-full">
                    <div className="p-4 sm:p-6 border-b border-gray-100">
                        <h2 className="text-lg font-semibold text-gray-900">Pending Stay Requests</h2>
                        <p className="text-sm text-gray-500 mt-1">Pending bookings requested via the website or WhatsApp.</p>
                    </div>
                    <div className="overflow-x-auto w-full">
                        <table className="w-full min-w-[800px] text-sm text-left">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="font-medium text-gray-500 px-4 sm:px-6 py-3 whitespace-nowrap">Guest Details</th>
                                    <th className="font-medium text-gray-500 px-4 sm:px-6 py-3 whitespace-nowrap">Property & Room</th>
                                    <th className="font-medium text-gray-500 px-4 sm:px-6 py-3 whitespace-nowrap">Stay Dates</th>
                                    <th className="font-medium text-gray-500 px-4 sm:px-6 py-3 whitespace-nowrap">Price</th>
                                    <th className="text-right font-medium text-gray-500 px-4 sm:px-6 py-3 whitespace-nowrap">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {pendingRequests.map(req => (
                                    <tr key={req.id} className="hover:bg-gray-50/50">
                                        <td className="px-6 py-4">
                                            <p className="font-medium text-gray-900">{req.guest_name}</p>
                                            <p className="text-gray-500 text-xs">{req.guest_phone}</p>
                                            <p className="text-gray-500 text-xs">Source: <span className="capitalize">{req.booking_source}</span></p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-medium text-gray-900">{req.property?.name}</p>
                                            <p className="text-gray-500 text-xs">{req.room?.name}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-medium text-gray-900">{req.check_in}</p>
                                            <p className="text-gray-500 text-xs">→ {req.check_out} ({req.nights} nights)</p>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-gray-900">
                                            ₦{req.total_amount?.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleManualConfirm(req.id)}
                                                disabled={confirmingId === req.id}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                            >
                                                {confirmingId === req.id ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                                                Confirm Payment
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {pendingRequests.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                            <CalendarDays size={32} className="mx-auto text-gray-300 mb-3" />
                                            <p className="font-medium">No pending requests</p>
                                            <p className="text-xs text-gray-400 mt-1">All stay requests have been processed.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'new' && (
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
                        availability={globalAvailability}
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

                                    {(!paystackLink && !manualSuccess) ? (
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
                                                {isBooking ? 'Processing...' : 'Submit Manual Booking'}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="mt-6 space-y-4">
                                            {/* Success: Payment Link or Manual Block */}
                                            {paystackLink ? (
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
                                            ) : manualSuccess ? (
                                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <CheckCircle size={16} className="text-amber-600" />
                                                        <p className="text-sm text-amber-800 font-medium">Manual Booking Submitted!</p>
                                                    </div>
                                                    <p className="text-xs text-amber-700">The dates are now held. This booking is in your "Pending Stay Requests" tab awaiting manual payment confirmation.</p>
                                                </div>
                                            ) : null}

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
            )}
            {activeTab === 'availability' && (() => {
                const availProperty = properties.find(p => p.id === availPropertyId);
                const availRoom = availRoomId
                    ? availProperty?.rooms?.find(r => r.id === availRoomId) ?? availProperty?.rooms?.[0]
                    : availProperty?.rooms?.[0];
                const propAvailability = availability.filter(a => availRoom && a.room_id === availRoom.id);
                const statusMap: Record<string, string> = {};
                propAvailability.forEach(a => { statusMap[a.date] = a.status; });

                const monthStart = startOfMonth(availMonth);
                const monthEnd = endOfMonth(availMonth);
                const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
                const startPadding = getDay(monthStart);
                const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

                const STATUS_COLORS: Record<string, string> = {
                    available: 'bg-gray-50 text-gray-700',
                    booked: 'bg-red-100 text-red-800',
                    held: 'bg-purple-100 text-purple-800',
                    cleaning: 'bg-blue-100 text-blue-800',
                    maintenance: 'bg-amber-100 text-amber-800',
                };

                const handleAvailDateClick = (dateStr: string) => {
                    if (!availSelection.start || (availSelection.start && availSelection.end)) {
                        setAvailSelection({ start: dateStr, end: null });
                    } else if (dateStr < availSelection.start) {
                        setAvailSelection({ start: dateStr, end: null });
                    } else {
                        setAvailSelection({ start: availSelection.start, end: dateStr });
                    }
                };

                const handleAvailUpdate = async (status: string) => {
                    if (!availRoom || !availSelection.start) return;
                    setAvailUpdating(true);
                    setAvailSuccess('');
                    try {
                        const start = new Date(availSelection.start);
                        const end = availSelection.end ? new Date(availSelection.end) : start;
                        const dates: string[] = [];
                        let cur = new Date(start);
                        while (cur <= end) {
                            dates.push(format(cur, 'yyyy-MM-dd'));
                            cur = addDays(cur, 1);
                        }
                        await Promise.all(dates.map(date =>
                            fetch('/api/availability/update', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ roomId: availRoom.id, date, status }),
                            })
                        ));
                        setAvailSelection({ start: null, end: null });
                        setAvailSuccess(`${dates.length} date${dates.length > 1 ? 's' : ''} marked as ${status}`);
                        router.refresh();
                    } finally {
                        setAvailUpdating(false);
                    }
                };

                return (
                    <div className="space-y-4">
                        {/* Property selector */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Select Property</label>
                            <select
                                value={availPropertyId}
                                onChange={e => { setAvailPropertyId(e.target.value); setAvailSelection({ start: null, end: null }); setAvailSuccess(''); setAvailRoomId(''); }}
                                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                            >
                                <option value="">Choose a property...</option>
                                {properties.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} — {p.area || p.city}</option>
                                ))}
                            </select>
                        </div>

                        {availProperty && availProperty.rooms.length > 1 && (
                            <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Select Room</label>
                                <select
                                    value={availRoomId || availProperty.rooms[0]?.id || ''}
                                    onChange={e => { setAvailRoomId(e.target.value); setAvailSelection({ start: null, end: null }); }}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                                >
                                    {availProperty.rooms.map(r => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {availProperty && availRoom && (
                            <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6">
                                {/* Month nav */}
                                <div className="flex items-center justify-between mb-4">
                                    <button onClick={() => setAvailMonth(subMonths(availMonth, 1))} className="p-2 rounded-lg hover:bg-gray-100"><ChevronLeft size={18} /></button>
                                    <h3 className="font-semibold text-gray-900">{format(availMonth, 'MMMM yyyy')}</h3>
                                    <button onClick={() => setAvailMonth(addMonths(availMonth, 1))} className="p-2 rounded-lg hover:bg-gray-100"><ChevronRight size={18} /></button>
                                </div>

                                {/* Day headers */}
                                <div className="grid grid-cols-7 gap-1 mb-2">
                                    {DAYS.map(d => <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>)}
                                </div>

                                {/* Calendar grid */}
                                <div className="grid grid-cols-7 gap-1">
                                    {Array.from({ length: startPadding }).map((_, i) => <div key={`pad-${i}`} className="aspect-square" />)}
                                    {days.map(day => {
                                        const dateStr = format(day, 'yyyy-MM-dd');
                                        const status = statusMap[dateStr] || 'available';
                                        const isStart = availSelection.start === dateStr;
                                        const isEnd = availSelection.end === dateStr;
                                        const inRange = availSelection.start && availSelection.end && dateStr > availSelection.start && dateStr < availSelection.end;
                                        return (
                                            <button
                                                key={dateStr}
                                                onClick={() => handleAvailDateClick(dateStr)}
                                                className={`aspect-square rounded-md flex flex-col items-center justify-center transition-all text-xs border
                                                    ${isStart || isEnd ? 'border-green-600 ring-1 ring-green-400' : 'border-transparent'}
                                                    ${inRange ? 'bg-green-50' : (STATUS_COLORS[status] || 'bg-gray-50 text-gray-700')}
                                                `}
                                            >
                                                <span className="font-medium">{format(day, 'd')}</span>
                                                <span className="hidden sm:block text-[9px] opacity-60 truncate w-full text-center px-0.5">
                                                    {status === 'maintenance' ? 'Maint' : status === 'available' ? '' : status}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Action panel */}
                                {availSelection.start && (
                                    <div className="mt-4 p-3 bg-gray-50 rounded-xl animate-in slide-in-from-top-2 duration-200">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">
                                                    Selected: <span className="font-bold">{availSelection.start}</span>
                                                    {availSelection.end && <span> to <span className="font-bold">{availSelection.end}</span></span>}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                    {!availSelection.end ? 'Select an end date or apply to single day' : 'Range selected'}
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {availSelection.end ? (
                                                    <>
                                                        <button
                                                            onClick={() => { setAvailBookingType('guest'); setAvailBlockForm({ guestName: '', notes: '' }); setShowAvailBlockModal(true); }}
                                                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors"
                                                        >
                                                            Block Dates
                                                        </button>
                                                        <button
                                                            onClick={() => handleAvailUpdate('available')}
                                                            disabled={availUpdating}
                                                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
                                                        >
                                                            Mark Available
                                                        </button>
                                                    </>
                                                ) : (
                                                    <div className="flex flex-wrap gap-2">
                                                        <button
                                                            onClick={() => handleAvailUpdate('available')}
                                                            disabled={availUpdating}
                                                            className="px-2 py-1.5 rounded-lg text-[10px] font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
                                                        >
                                                            Available
                                                        </button>
                                                        <button
                                                            onClick={() => handleAvailUpdate('cleaning')}
                                                            disabled={availUpdating}
                                                            className="px-2 py-1.5 rounded-lg text-[10px] font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors disabled:opacity-50"
                                                        >
                                                            Cleaning
                                                        </button>
                                                        <button
                                                            onClick={() => { setAvailBookingType('guest'); setAvailBlockForm({ guestName: '', notes: '' }); setShowAvailBlockModal(true); }}
                                                            className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors"
                                                        >
                                                            Block Dates
                                                        </button>
                                                    </div>
                                                )}
                                                <button
                                                    onClick={() => setAvailSelection({ start: null, end: null })}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-200 transition-colors"
                                                >
                                                    Clear
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {availSuccess && (
                                    <div className="mt-3 px-3 py-2 bg-green-50 border border-green-100 rounded-lg text-sm text-green-700 flex items-center gap-2">
                                        <CheckCircle size={14} />
                                        {availSuccess}
                                    </div>
                                )}

                                {/* Legend */}
                                <div className="flex flex-wrap gap-3 mt-4 text-xs text-gray-500">
                                    {[['bg-gray-100', 'Available'], ['bg-red-100', 'Booked'], ['bg-amber-100', 'Maintenance'], ['bg-blue-100', 'Cleaning']].map(([color, label]) => (
                                        <span key={label} className="flex items-center gap-1.5">
                                            <span className={`w-3 h-3 rounded ${color}`} />
                                            {label}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Block Dates Modal */}
                        {showAvailBlockModal && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                                <div className="bg-white rounded-2xl w-full max-w-lg mx-4 p-6 shadow-xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh] overflow-y-auto">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900">Block Dates</h3>
                                            <p className="text-sm text-gray-500 mt-1">
                                                {availSelection.start} <span className="text-gray-400">to</span> {availSelection.end || availSelection.start}
                                            </p>
                                        </div>
                                        <div className="bg-gray-100 p-1 rounded-lg flex gap-1">
                                            <button
                                                type="button"
                                                onClick={() => setAvailBookingType('guest')}
                                                className={`px-2 py-1.5 rounded-md text-[10px] font-medium transition-all ${availBookingType === 'guest' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                                            >
                                                Booking
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setAvailBookingType('maintenance')}
                                                className={`px-2 py-1.5 rounded-md text-[10px] font-medium transition-all ${availBookingType === 'maintenance' ? 'bg-white shadow text-amber-700' : 'text-gray-500 hover:text-gray-700'}`}
                                            >
                                                Maintenance
                                            </button>
                                        </div>
                                    </div>
                                    <form onSubmit={handleAvailBlockSubmit} className="space-y-5">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                {availBookingType === 'maintenance' ? 'Reason' : 'Guest / Agent Name'}
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={availBlockForm.guestName}
                                                onChange={e => setAvailBlockForm(f => ({ ...f, guestName: e.target.value }))}
                                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-green-500 text-base"
                                                placeholder={availBookingType === 'maintenance' ? 'e.g. Plumbing Repair' : 'e.g. Mr. Okeke'}
                                                autoFocus
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Internal)</label>
                                            <textarea
                                                value={availBlockForm.notes}
                                                onChange={e => setAvailBlockForm(f => ({ ...f, notes: e.target.value }))}
                                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-green-500 text-sm"
                                                placeholder="Add any internal notes..."
                                                rows={2}
                                            />
                                        </div>
                                        <div className="flex gap-3 pt-2">
                                            <button
                                                type="button"
                                                onClick={() => setShowAvailBlockModal(false)}
                                                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={availBlockSubmitting}
                                                className={`flex-1 px-4 py-3 rounded-xl text-white font-medium disabled:opacity-50 shadow-sm transition-colors ${availBookingType === 'maintenance' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-gray-900 hover:bg-gray-800'}`}
                                            >
                                                {availBlockSubmitting ? 'Blocking...' : 'Confirm Block'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })()}

            {activeTab === 'properties' && (
                <div className="space-y-4">
                    {allProperties.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
                            <Building2 size={32} className="text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500 text-sm">No properties found</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {allProperties.map(p => (
                                <div key={p.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-sm transition-shadow">
                                    <div className="relative h-44 bg-gray-100">
                                        {p.thumbnail ? (
                                            <Image src={p.thumbnail} alt={p.name} fill className="object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <ImageOff size={32} className="text-gray-300" />
                                            </div>
                                        )}
                                        <div className="absolute top-3 right-3">
                                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${p.is_active ? 'bg-green-500 text-white' : 'bg-gray-800/70 text-gray-200'}`}>
                                                {p.is_active ? 'Active' : 'Draft'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        <h3 className="font-semibold text-gray-900 truncate">{p.name}</h3>
                                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                                            <MapPin size={11} />
                                            <span className="truncate">{p.area ? `${p.area}, ` : ''}{p.city}</span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-2 text-sm">
                                            <span className="font-medium text-green-700">₦{p.price_per_night.toLocaleString()}<span className="text-xs text-gray-400 font-normal">/night</span></span>
                                            <span className="text-gray-400 text-xs">{p.max_guests} guests</span>
                                        </div>
                                        {p.amenities && p.amenities.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                {p.amenities.slice(0, 4).map(a => (
                                                    <span key={a} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-600">
                                                        {amenityIcon[a] || null}
                                                        {a}
                                                    </span>
                                                ))}
                                                {p.amenities.length > 4 && (
                                                    <span className="text-xs text-gray-400">+{p.amenities.length - 4}</span>
                                                )}
                                            </div>
                                        )}
                                        <button
                                            onClick={() => openPropEdit(p)}
                                            className="mt-3 w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors border border-gray-100"
                                        >
                                            <Pencil size={13} />
                                            Edit Property
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Edit Bottom Sheet */}
                    {editingPropId && (
                        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center bg-black/50">
                            <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col">
                                <div className="flex justify-center pt-3 pb-1 sm:hidden">
                                    <div className="w-10 h-1 rounded-full bg-gray-200" />
                                </div>
                                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                                    <h2 className="font-semibold text-gray-900">Edit Property</h2>
                                    <button onClick={() => setEditingPropId(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                                        <X size={18} className="text-gray-500" />
                                    </button>
                                </div>
                                <div className="overflow-y-auto px-5 py-4 space-y-4 flex-1">
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-2 block">Photos</label>
                                        <MediaUploader
                                            existingUrls={editForm.images}
                                            onUpload={imgs => setEditForm(f => ({ ...f, images: imgs, thumbnail: imgs[0] || '' }))}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="col-span-2">
                                            <label className="text-xs font-medium text-gray-600 mb-1 block">Property Name</label>
                                            <input type="text" value={editForm.name}
                                                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                                                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-600 mb-1 block">Area</label>
                                            <input type="text" value={editForm.area}
                                                onChange={e => setEditForm(f => ({ ...f, area: e.target.value }))}
                                                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-600 mb-1 block">City</label>
                                            <input type="text" value={editForm.city}
                                                onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))}
                                                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-600 mb-1 block">Price / night (₦)</label>
                                            <input type="number" value={editForm.price_per_night}
                                                onChange={e => setEditForm(f => ({ ...f, price_per_night: e.target.value }))}
                                                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-600 mb-1 block">Max Guests</label>
                                            <input type="number" value={editForm.max_guests}
                                                onChange={e => setEditForm(f => ({ ...f, max_guests: e.target.value }))}
                                                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
                                        <textarea value={editForm.description}
                                            onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                                            rows={3}
                                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 resize-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-600 mb-2 block">Amenities</label>
                                        <div className="flex flex-wrap gap-2">
                                            {ALL_AMENITIES.map(a => {
                                                const on = editForm.amenities.includes(a);
                                                return (
                                                    <button key={a} type="button"
                                                        onClick={() => setEditForm(f => ({
                                                            ...f,
                                                            amenities: on ? f.amenities.filter(x => x !== a) : [...f.amenities, a],
                                                        }))}
                                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${on ? 'bg-green-100 border-green-300 text-green-800' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
                                                    >
                                                        {amenityIcon[a] || null}
                                                        {a}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-600 mb-1 block">Check-in Instructions</label>
                                        <textarea value={editForm.check_in_instructions}
                                            onChange={e => setEditForm(f => ({ ...f, check_in_instructions: e.target.value }))}
                                            rows={3}
                                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 resize-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-600 mb-1 block">House Rules</label>
                                        <textarea value={editForm.house_rules}
                                            onChange={e => setEditForm(f => ({ ...f, house_rules: e.target.value }))}
                                            rows={3}
                                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 resize-none" />
                                    </div>
                                    {editError && (
                                        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{editError}</p>
                                    )}
                                </div>
                                <div className="px-5 pb-6 pt-3 border-t border-gray-100">
                                    <button
                                        onClick={handlePropSave}
                                        disabled={editSaving}
                                        className="w-full py-3 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                                    >
                                        {editSaving ? <Loader2 size={16} className="animate-spin" /> : editSuccess ? <Check size={16} /> : null}
                                        {editSaving ? 'Saving...' : editSuccess ? 'Saved!' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
