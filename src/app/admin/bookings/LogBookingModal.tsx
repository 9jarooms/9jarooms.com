'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { addDays, format } from 'date-fns';
import { computeOptions, type ApartmentLite, type RoomLite, type BookingOption } from '@/lib/booking/options';
import { ConsoleSource, naira } from './types';

export type ConsoleProperty = {
    id: string;
    name: string;
    is_apartment: boolean | null;
    whole_apartment_price: number | null;
    two_bed_price: number | null;
};

type AvailabilityMap = { rooms: RoomLite[]; unavailable: string[] };

export default function LogBookingModal({
    properties, sources, onClose,
}: {
    properties: ConsoleProperty[];
    sources: ConsoleSource[];
    onClose: () => void;
}) {
    const router = useRouter();

    const [propertyId, setPropertyId] = useState('');
    const [checkIn, setCheckIn] = useState('');
    const [checkOut, setCheckOut] = useState('');
    const [selectedKey, setSelectedKey] = useState('');
    const [guestName, setGuestName] = useState('');
    const [guestPhone, setGuestPhone] = useState('');
    const [guestEmail, setGuestEmail] = useState('');
    const [source, setSource] = useState('');
    const [notes, setNotes] = useState('');

    const [avail, setAvail] = useState<AvailabilityMap | null>(null);
    const [availLoading, setAvailLoading] = useState(false);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const datesValid = !!checkIn && !!checkOut && checkOut > checkIn;
    const ready = !!propertyId && datesValid;

    // Fetch the availability map whenever property + a valid date range are set.
    useEffect(() => {
        setAvail(null);
        setSelectedKey('');
        if (!propertyId || !checkIn || !checkOut || checkOut <= checkIn) return;

        let stale = false;
        setAvailLoading(true);
        fetch(`/api/availability?propertyId=${propertyId}&from=${checkIn}&to=${checkOut}`)
            .then((res) => res.json())
            .then((data) => {
                if (stale) return;
                if (data.error) {
                    setError(data.error);
                } else {
                    setAvail({ rooms: data.rooms || [], unavailable: data.unavailable || [] });
                }
            })
            .catch(() => { if (!stale) setError('Failed to load availability'); })
            .finally(() => { if (!stale) setAvailLoading(false); });

        return () => { stale = true; };
    }, [propertyId, checkIn, checkOut]);

    const property = properties.find((p) => p.id === propertyId) || null;

    // Night-by-night date list [checkIn, checkOut).
    const stayDates = (() => {
        if (!datesValid) return [];
        const out: string[] = [];
        let current = new Date(checkIn);
        const end = new Date(checkOut);
        while (current < end) {
            out.push(format(current, 'yyyy-MM-dd'));
            current = addDays(current, 1);
        }
        return out;
    })();

    // Run the same option engine the public property page + booking API use.
    const options: BookingOption[] = (() => {
        if (!property || !avail || stayDates.length === 0) return [];
        const apt: ApartmentLite = {
            id: property.id,
            is_apartment: !!property.is_apartment,
            property_price: 0,
            whole_apartment_price: property.whole_apartment_price,
            two_bed_price: property.two_bed_price,
            rooms: avail.rooms,
        };
        return computeOptions(apt, new Set(avail.unavailable), checkIn, checkOut, stayDates);
    })();

    const selected = options.find((o) => o.key === selectedKey) || null;
    const activeSources = sources.filter((s) => s.is_active);

    async function submit() {
        setError('');
        if (!propertyId) return setError('Select a property');
        if (!datesValid) return setError('Pick valid check-in and check-out dates');
        if (!selected || !selected.available) return setError('Select an available booking option');
        if (!guestName.trim()) return setError('Guest name is required');

        setSaving(true);
        try {
            const res = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    propertyId,
                    roomId: selected.roomIds[0],
                    mode: selected.type,
                    guestName: guestName.trim(),
                    guestEmail: guestEmail.trim() || null,
                    guestPhone: guestPhone.trim() || null,
                    checkIn,
                    checkOut,
                    isManualBooking: true,
                    bookingSource: source || 'whatsapp',
                    notes: notes.trim() || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Failed to log booking');
                return;
            }
            router.refresh();
            onClose();
        } catch {
            setError('Failed to log booking');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center p-4 bg-black/40 overflow-y-auto" onClick={onClose}>
            <div className="bg-white rounded-2xl w-full max-w-lg my-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
                    <h2 className="font-bold text-gray-900">Log Booking</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
                </div>
                <div className="p-5 space-y-4">
                    <Field label="Property *">
                        <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className={input}>
                            <option value="">— Select property —</option>
                            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Check-in *"><input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={input} /></Field>
                        <Field label="Check-out *"><input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={input} /></Field>
                    </div>
                    {checkIn && checkOut && !datesValid && (
                        <p className="text-xs text-red-600 -mt-2">Check-out must be after check-in.</p>
                    )}
                    {datesValid && <p className="text-xs text-gray-400 -mt-2">{stayDates.length} night{stayDates.length > 1 ? 's' : ''}</p>}

                    {ready && (
                        <Field label="Booking option *">
                            {availLoading ? (
                                <p className="text-sm text-gray-400 py-1">Checking availability…</p>
                            ) : options.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {options.map((o) => (
                                        <button key={o.key} type="button" disabled={!o.available}
                                            onClick={() => setSelectedKey(o.key)}
                                            title={o.available ? undefined : 'Not available for these dates'}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium border text-left disabled:opacity-40 disabled:cursor-not-allowed ${selectedKey === o.key ? 'bg-green-600 text-white border-green-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50 disabled:hover:bg-white'}`}>
                                            <span className="block">{o.label}</span>
                                            <span className={`block text-xs ${selectedKey === o.key ? 'text-green-100' : 'text-gray-400'}`}>
                                                {naira(o.price)} · {naira(o.pricePerNight)}/night
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400 py-1">No bookable rooms found for this property.</p>
                            )}
                        </Field>
                    )}

                    <Field label="Guest name *">
                        <input value={guestName} onChange={(e) => setGuestName(e.target.value)} className={input} placeholder="Full name" />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Phone"><input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} className={input} placeholder="0801 234 5678" /></Field>
                        <Field label="Email"><input value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} className={input} placeholder="guest@email.com" /></Field>
                    </div>

                    <Field label="Source">
                        <select value={source} onChange={(e) => setSource(e.target.value)} className={input}>
                            <option value="">WhatsApp (default)</option>
                            {activeSources.map((s) => <option key={s.id} value={s.label}>{s.label}</option>)}
                        </select>
                    </Field>

                    <Field label="Notes">
                        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={input} placeholder="Anything worth remembering" />
                    </Field>

                    <p className="text-xs text-gray-500 bg-emerald-50 rounded-lg px-3 py-2">
                        Logged as <span className="font-semibold">confirmed</span> — use Mark paid once payment lands.
                    </p>

                    {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
                        <button onClick={submit} disabled={saving} className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50">
                            {saving ? 'Logging…' : 'Log booking'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

const input = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-100';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="block text-xs font-medium text-gray-500 mb-1">{label}</span>
            {children}
        </label>
    );
}
