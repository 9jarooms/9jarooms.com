'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, MapPin, Settings } from 'lucide-react';
import type { Property, Room, Availability, Booking } from '@/types/database';

interface Props {
    property: Property;
    rooms: Room[];
    availability: Availability[];
    bookings: Booking[];
}

const STATUS_OPTIONS = [
    { value: 'available', label: 'Available', color: 'bg-green-100 text-green-700' },
    { value: 'cleaning', label: 'Cleaning', color: 'bg-blue-100 text-blue-700' },
    { value: 'maintenance', label: 'Maintenance', color: 'bg-amber-100 text-amber-700' },
];

const STATUS_COLORS: Record<string, string> = {
    available: 'bg-green-100 text-green-800',
    booked: 'bg-red-100 text-red-800',
    held: 'bg-purple-100 text-purple-800',
    cleaning: 'bg-blue-100 text-blue-800',
    maintenance: 'bg-amber-100 text-amber-800',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function PropertyManageClient({ property, rooms, availability, bookings }: Props) {
    const router = useRouter();
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(rooms[0] || null);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // Selection State
    const [selection, setSelection] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });

    const [updating, setUpdating] = useState(false);
    const [showManualBooking, setShowManualBooking] = useState(false);

    // Simplified Form
    const [bookingType, setBookingType] = useState<'guest' | 'maintenance'>('guest');
    const [bookingForm, setBookingForm] = useState({
        guestName: '',
        notes: ''
    });

    // Restore missing state
    const [showSettings, setShowSettings] = useState(false);
    const [instructions, setInstructions] = useState(property.check_in_instructions || '');
    const [houseRules, setHouseRules] = useState(property.house_rules || '');

    const roomAvailability = selectedRoom
        ? availability.filter((a) => a.room_id === selectedRoom.id)
        : [];

    const statusMap: Record<string, string> = {};
    roomAvailability.forEach((a) => {
        statusMap[a.date] = a.status;
    });

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startPadding = getDay(monthStart);

    // Date Selection Logic
    const handleDateClick = (dateStr: string) => {
        // If clicking same start date, unselect
        if (selection.start === dateStr && !selection.end) {
            setSelection({ start: null, end: null });
            return;
        }

        // 1. Start selection
        if (!selection.start || (selection.start && selection.end)) {
            setSelection({ start: dateStr, end: null });
            return;
        }

        // 2. End selection (must be after start)
        if (selection.start && !selection.end) {
            if (dateStr < selection.start) {
                // If clicked date is before start, make it the new start
                setSelection({ start: dateStr, end: null });
            } else {
                setSelection({ start: selection.start, end: dateStr });
            }
        }
    };

    const isDateSelected = (dateStr: string) => {
        if (selection.start === dateStr) return true;
        if (selection.end === dateStr) return true;
        if (selection.start && selection.end && dateStr > selection.start && dateStr < selection.end) return true;
        return false;
    };

    const isDateInRange = (dateStr: string) => {
        if (selection.start && selection.end && dateStr > selection.start && dateStr < selection.end) return true;
        return false;
    };

    const handleStatusUpdate = async (date: string, status: string) => {
        if (!selectedRoom) return;
        setUpdating(true);

        try {
            const response = await fetch('/api/availability/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomId: selectedRoom.id,
                    date,
                    status,
                }),
            });

            if (response.ok) {
                router.refresh();
            }
        } catch (error) {
            console.error('Failed to update status:', error);
        } finally {
            setUpdating(false);
            // Don't reset selection here, user might want to continue
        }
    };

    const handleSaveSettings = async () => {
        setUpdating(true);
        try {
            await fetch(`/api/properties/${property.id}/settings`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    check_in_instructions: instructions,
                    house_rules: houseRules,
                }),
            });
            router.refresh();
        } catch (error) {
            console.error('Failed to save settings:', error);
        } finally {
            setUpdating(false);
            setShowSettings(false);
        }
    };

    const openManualBooking = () => {
        setBookingForm({ guestName: '', notes: '' });
        setBookingType('guest');
        setShowManualBooking(true);
    };

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setUpdating(true);

        if (!selection.start) {
            alert("Please select a date first.");
            setUpdating(false);
            return;
        }

        if (bookingType === 'guest' && !selection.end) {
            alert("Please select an end date for guest bookings.");
            setUpdating(false);
            return;
        }

        // For single day maintenance, checkOut is next day
        const checkInVal = selection.start;
        const checkOutVal = selection.end || format(addDays(new Date(selection.start), 1), 'yyyy-MM-dd');

        if (bookingType === 'maintenance' && !bookingForm.guestName.trim()) {
            alert("Please provide a reason for the maintenance block.");
            setUpdating(false);
            return;
        }

        const finalGuestName = bookingType === 'maintenance'
            ? bookingForm.guestName
            : bookingForm.guestName;

        try {
            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomId: selectedRoom?.id,
                    propertyId: property.id,
                    guestName: finalGuestName,
                    // guestEmail handled by API for manual bookings (users auth email)
                    checkIn: checkInVal,
                    checkOut: checkOutVal,
                    isManualBooking: true,
                    bookingType,
                    bookingSource: bookingType === 'maintenance' ? 'maintenance' : 'caretaker',
                    notes: bookingForm.notes
                }),
            });

            const data = await response.json();

            if (response.ok) {
                setShowManualBooking(false);
                setBookingForm({ guestName: '', notes: '' });
                setSelection({ start: null, end: null });
                router.refresh();
                alert(bookingType === 'maintenance' ? 'Maintenance block created!' : 'Dates blocked successfully!');
            } else {
                alert(data.error || 'Failed to block dates');
            }
        } catch (error) {
            console.error('Booking error:', error);
            alert('An error occurred');
        } finally {
            setUpdating(false);
        }
    };

    return (
        <>
            {/* Header */}
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{property.name}</h1>
                    <div className="flex items-center gap-1 mt-1 text-gray-500 text-sm">
                        <MapPin size={14} />
                        {property.address}, {property.area}
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                        <Settings size={16} />
                        Settings
                    </button>
                </div>
            </div>

            {/* Manual Booking Modal */}
            {showManualBooking && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg mx-4 p-6 shadow-xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Block Dates</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    {selection.start} <span className="text-gray-400">to</span> {selection.end}
                                </p>
                            </div>
                            <div className="bg-gray-100 p-1 rounded-lg flex gap-1">
                                <button
                                    type="button"
                                    onClick={() => setBookingType('guest')}
                                    className={`px-2 py-1.5 rounded-md text-[10px] font-medium transition-all ${bookingType === 'guest' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Booking
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setBookingType('maintenance')}
                                    className={`px-2 py-1.5 rounded-md text-[10px] font-medium transition-all ${bookingType === 'maintenance' ? 'bg-white shadow text-amber-700' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Maintenance
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleManualSubmit} className="space-y-5">
                            {bookingType === 'guest' ? (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Caretaker / Agent Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={bookingForm.guestName}
                                        onChange={(e) => setBookingForm({ ...bookingForm, guestName: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-green-500 text-base"
                                        placeholder="e.g. Mr. Okeke"
                                        autoFocus
                                    />
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                                    <input
                                        type="text"
                                        required
                                        value={bookingForm.guestName}
                                        onChange={(e) => setBookingForm({ ...bookingForm, guestName: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-amber-500 text-base"
                                        placeholder="e.g. Plumbing Repair"
                                        autoFocus
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Internal)</label>
                                <textarea
                                    value={bookingForm.notes}
                                    onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-green-500 text-sm"
                                    placeholder="Add any internal notes..."
                                    rows={2}
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowManualBooking(false)}
                                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={updating}
                                    className={`flex-1 px-4 py-3 rounded-xl text-white font-medium disabled:opacity-50 shadow-sm transition-colors ${bookingType === 'maintenance' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-gray-900 hover:bg-gray-800'}`}
                                >
                                    {updating ? 'Blocking...' : (bookingType === 'maintenance' ? 'Block' : 'Confirm Block')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Settings Panel */}
            {showSettings && (
                <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 space-y-4">
                    <h3 className="font-semibold text-gray-900">Property Settings</h3>
                    {/* ... copied settings content ... */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Check-in Instructions</label>
                        <textarea
                            value={instructions}
                            onChange={(e) => setInstructions(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-400"
                            placeholder="Door codes, directions, meeting point..."
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">House Rules</label>
                        <textarea
                            value={houseRules}
                            onChange={(e) => setHouseRules(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-400"
                            placeholder="No smoking, quiet hours, max guests..."
                        />
                    </div>
                    <button
                        onClick={handleSaveSettings}
                        disabled={updating}
                        className="bg-green-500 hover:bg-green-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                    >
                        {updating ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Calendar */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6">
                    {/* Room tabs */}
                    {rooms.length > 1 && (
                        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                            {rooms.map((room) => (
                                <button
                                    key={room.id}
                                    onClick={() => setSelectedRoom(room)}
                                    className={`px-4 py-2 rounded-xl text-sm whitespace-nowrap transition-colors ${selectedRoom?.id === room.id
                                        ? 'bg-green-50 text-green-700 font-medium'
                                        : 'text-gray-500 hover:bg-gray-50'
                                        }`}
                                >
                                    {room.name}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Month nav */}
                    <div className="flex items-center justify-between mb-4">
                        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-gray-100">
                            <ChevronLeft size={18} />
                        </button>
                        <h3 className="font-semibold">{format(currentMonth, 'MMMM yyyy')}</h3>
                        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-gray-100">
                            <ChevronRight size={18} />
                        </button>
                    </div>

                    {/* Day headers */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {DAYS.map((d) => (
                            <div key={d} className="text-center text-xs font-medium text-gray-400 py-2">{d}</div>
                        ))}
                    </div>

                    {/* Calendar grid */}
                    <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: startPadding }).map((_, i) => (
                            <div key={`pad-${i}`} className="aspect-square" />
                        ))}
                        {days.map((day) => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const status = statusMap[dateStr] || 'available';
                            const isSelected = isDateSelected(dateStr);
                            const inRange = isDateInRange(dateStr);

                            return (
                                <button
                                    key={dateStr}
                                    onClick={() => handleDateClick(dateStr)}
                                    className={`aspect-square rounded-md flex flex-col items-center justify-center transition-all border 
                                        ${isSelected ? 'border-green-600 bg-green-50' : 'border-transparent'} 
                                        ${inRange ? 'bg-green-50 border-t border-b border-green-100' : ''}
                                        ${STATUS_COLORS[status] || 'bg-gray-50 text-gray-800'}
                                    `}
                                >
                                    <span className="text-xs sm:text-sm font-medium">{format(day, 'd')}</span>
                                    {/* Hide status text on very small screens to prevent cramping */}
                                    <span className="hidden sm:block text-[9px] mt-0.5 opacity-70 truncate w-full text-center px-1">
                                        {status === 'maintenance' ? 'Maint' : status}
                                    </span>
                                    {/* Dot indicator for mobile */}
                                    <span className={`sm:hidden w-1.5 h-1.5 rounded-full mt-0.5 ${status === 'maintenance' ? 'bg-amber-500' :
                                        status === 'booked' ? 'bg-red-500' :
                                            status === 'cleaning' ? 'bg-blue-500' :
                                                'bg-transparent'
                                        }`} />
                                </button>
                            );
                        })}
                    </div>

                    {/* Selection Action Panel */}
                    {selection.start && (
                        <div className="mt-4 p-3 bg-gray-50 rounded-xl animate-in slide-in-from-top-2 duration-200">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-medium text-gray-900">
                                        Selected: <span className="font-bold">{selection.start}</span>
                                        {selection.end && <span> to <span className="font-bold">{selection.end}</span></span>}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {!selection.end ? 'Select an end date to create a range' : 'Range selected'}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    {/* Action Buttons */}
                                    {selection.end ? (
                                        <button
                                            onClick={openManualBooking}
                                            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition-colors shadow-sm"
                                        >
                                            Block Dates
                                        </button>
                                    ) : (
                                        // Simple status toggle for single date + Block option
                                        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                                            {STATUS_OPTIONS.filter(o => o.value !== 'maintenance').map((opt) => (
                                                <button
                                                    key={opt.value}
                                                    onClick={() => handleStatusUpdate(selection.start!, opt.value)}
                                                    disabled={updating}
                                                    className={`flex-1 sm:flex-none px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors whitespace-nowrap ${opt.color} hover:opacity-80`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                            <button
                                                onClick={() => {
                                                    setBookingType('maintenance');
                                                    openManualBooking();
                                                }}
                                                className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-gray-900 text-white text-[10px] font-medium hover:bg-gray-800 transition-colors whitespace-nowrap shadow-sm"
                                            >
                                                Block Dates
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Booking sidebar */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                    <h3 className="font-semibold text-gray-900 mb-4">Active Bookings</h3>
                    {bookings.length > 0 ? (
                        <div className="space-y-3">
                            {bookings.map((booking) => (
                                <div key={booking.id} className="p-3 bg-gray-50 rounded-xl">
                                    <p className="text-sm font-medium text-gray-900">{booking.guest_name}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        {booking.check_in} → {booking.check_out}
                                    </p>
                                    <div className="flex items-center justify-between mt-2">
                                        <span className={`badge badge-${booking.status}`}>{booking.status}</span>
                                        {booking.guest_phone && (
                                            <a href={`tel:${booking.guest_phone}`} className="text-xs text-green-600 hover:underline">
                                                {booking.guest_phone}
                                            </a>
                                        )}
                                    </div>
                                    {booking.notes && <p className="text-[10px] text-gray-400 mt-1 italic">{booking.notes}</p>}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400 text-center py-8">No active bookings</p>
                    )}
                </div>
            </div>
        </>
    );
}
