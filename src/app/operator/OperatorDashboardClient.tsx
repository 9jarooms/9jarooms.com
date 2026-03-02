'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Copy, Plus, CheckCircle, RefreshCw } from 'lucide-react';
import BookingCalendar from '@/components/BookingCalendar';
import type { Property, Room, Availability } from '@/types/database';

interface PropertyWithRooms extends Property {
    rooms: Room[];
}

interface Props {
    properties: PropertyWithRooms[];
    availability: Availability[];
}

export default function OperatorDashboardClient({ properties, availability }: Props) {
    const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
    const [selectedRoomId, setSelectedRoomId] = useState<string>('');
    const [checkIn, setCheckIn] = useState<Date | null>(null);
    const [checkOut, setCheckOut] = useState<Date | null>(null);
    const [guestName, setGuestName] = useState('');
    const [guestEmail, setGuestEmail] = useState('');
    const [guestPhone, setGuestPhone] = useState('');

    const [isBooking, setIsBooking] = useState(false);
    const [paystackLink, setPaystackLink] = useState('');
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    const selectedProperty = properties.find(p => p.id === selectedPropertyId);
    const selectedRoom = selectedProperty?.rooms.find(r => r.id === selectedRoomId);

    const roomAvailability = selectedRoom
        ? availability.filter(a => a.room_id === selectedRoom.id)
        : [];

    const handleDateSelect = (ci: Date, co: Date) => {
        setCheckIn(ci);
        setCheckOut(co);
        setError('');
    };

    const handleGenerateLink = async () => {
        if (!selectedProperty || !selectedRoom || !checkIn || !checkOut || !guestName || !guestEmail) {
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
                    checkIn: format(checkIn, 'yyyy-MM-dd'),
                    checkOut: format(checkOut, 'yyyy-MM-dd'),
                    isManualBooking: false, // We want to act as a normal guest so it generates Paystack
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

    const resetForm = () => {
        setSelectedPropertyId('');
        setSelectedRoomId('');
        setCheckIn(null);
        setCheckOut(null);
        setGuestName('');
        setGuestEmail('');
        setGuestPhone('');
        setPaystackLink('');
        setError('');
    };

    const pricePerNight = selectedRoom?.price_per_night || selectedProperty?.price_per_night || 0;
    const nights = checkIn && checkOut
        ? Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
    const totalAmount = pricePerNight * nights;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Selection & Form */}
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Property</h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {properties.map(p => {
                            const isSelected = selectedPropertyId === p.id;
                            return (
                                <div
                                    key={p.id}
                                    onClick={() => {
                                        setSelectedPropertyId(p.id);
                                        // Auto-select the property's primary room (1:1 mapping)
                                        setSelectedRoomId(p.rooms[0]?.id || '');
                                        setCheckIn(null);
                                        setCheckOut(null);
                                    }}
                                    className={`cursor-pointer p-4 rounded-xl border transition-all ${isSelected
                                            ? 'border-green-500 bg-green-50 shadow-sm ring-1 ring-green-500'
                                            : 'border-gray-200 bg-white hover:border-green-300 hover:bg-green-50/50'
                                        }`}
                                >
                                    <h3 className={`font-medium ${isSelected ? 'text-green-900' : 'text-gray-900'}`}>
                                        {p.name}
                                    </h3>
                                    <div className="flex justify-between items-end mt-2">
                                        <p className={`text-sm font-medium ${isSelected ? 'text-green-700' : 'text-gray-600'}`}>
                                            ₦{p.price_per_night.toLocaleString()}<span className="text-xs font-normal opacity-70">/night</span>
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                        {properties.length === 0 && (
                            <div className="col-span-full text-center py-8 text-gray-400 text-sm">
                                No properties available.
                            </div>
                        )}
                    </div>
                </div>

                {selectedRoom && (
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Details</h2>

                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">Full Name *</label>
                            <input
                                type="text"
                                value={guestName}
                                onChange={(e) => setGuestName(e.target.value)}
                                placeholder="Customer's Full Name"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">Email *</label>
                            <input
                                type="email"
                                value={guestEmail}
                                onChange={(e) => setGuestEmail(e.target.value)}
                                placeholder="customer@example.com"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">Phone Number</label>
                            <input
                                type="tel"
                                value={guestPhone}
                                onChange={(e) => setGuestPhone(e.target.value)}
                                placeholder="+234..."
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Right Column - Calendar & Summary */}
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    {selectedRoom ? (
                        <>
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Dates</h2>
                            <BookingCalendar
                                availability={roomAvailability}
                                onDateSelect={handleDateSelect}
                                selectedCheckIn={checkIn}
                                selectedCheckOut={checkOut}
                            />

                            {checkIn && checkOut && nights > 0 && (
                                <div className="mt-6 pt-4 border-t border-gray-100">
                                    <div className="flex justify-between font-semibold text-lg text-gray-900">
                                        <span>Total ({nights} nights)</span>
                                        <span>₦{totalAmount.toLocaleString()}</span>
                                    </div>

                                    {!paystackLink ? (
                                        <div className="mt-6 space-y-4">
                                            {error && (
                                                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl">
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
                                            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                                                <p className="text-sm text-green-800 font-medium mb-2">Room has been blocked for 30 minutes. Send this link to the customer:</p>
                                                <div className="flex bg-white border border-green-100 p-2 rounded-lg">
                                                    <input
                                                        readOnly
                                                        value={paystackLink}
                                                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-gray-600 px-2"
                                                    />
                                                    <button
                                                        onClick={handleCopy}
                                                        className="px-3 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded-md text-sm font-medium flex items-center gap-1 transition-colors"
                                                    >
                                                        {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                                                        {copied ? 'Copied' : 'Copy'}
                                                    </button>
                                                </div>
                                            </div>

                                            <button
                                                onClick={resetForm}
                                                className="w-full px-4 py-3 border focus:outline-none focus:ring bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl font-medium"
                                            >
                                                Start New Booking
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-12 text-gray-400">
                            Select a property and room to view the calendar.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
