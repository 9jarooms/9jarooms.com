'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay } from 'date-fns';
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
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [updating, setUpdating] = useState(false);
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
            setSelectedDate(null);
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
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                    <Settings size={16} />
                    Settings
                </button>
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 space-y-4">
                    <h3 className="font-semibold text-gray-900">Property Settings</h3>
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

                            return (
                                <button
                                    key={dateStr}
                                    onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                                    className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all border-2 ${selectedDate === dateStr ? 'border-green-400' : 'border-transparent'
                                        } ${STATUS_COLORS[status] || 'bg-green-50 text-green-800'}`}
                                >
                                    <span className="font-medium">{format(day, 'd')}</span>
                                    <span className="text-[10px] mt-0.5 opacity-70">{status}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Date action panel */}
                    {selectedDate && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                            <p className="text-sm font-medium text-gray-900 mb-3">
                                {selectedDate} — Current: <span className="capitalize">{statusMap[selectedDate] || 'available'}</span>
                            </p>
                            {statusMap[selectedDate] === 'booked' ? (
                                <p className="text-sm text-gray-500">This date is booked and cannot be changed.</p>
                            ) : (
                                <div className="flex gap-2">
                                    {STATUS_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => handleStatusUpdate(selectedDate, opt.value)}
                                            disabled={updating}
                                            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${opt.color} hover:opacity-80`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            )}
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
