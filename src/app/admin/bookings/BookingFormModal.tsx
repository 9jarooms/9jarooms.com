'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { CrmBooking, CrmProperty, CrmSource, ROOM_PRESETS, nights, naira } from './types';

export default function BookingFormModal({
    booking, properties, sources, onClose, onSaved,
}: {
    booking: CrmBooking | null;
    properties: CrmProperty[];
    sources: CrmSource[];
    onClose: () => void;
    onSaved: () => void;
}) {
    const isEdit = !!booking;
    const [guestName, setGuestName] = useState(booking?.guest_name || '');
    const [guestEmail, setGuestEmail] = useState(booking?.guest_email || '');
    const [guestPhone, setGuestPhone] = useState(booking?.guest_phone || '');
    const [propertyId, setPropertyId] = useState(booking?.property_id || '');
    const [rooms, setRooms] = useState(booking?.rooms_booked || 1);
    const [customRooms, setCustomRooms] = useState(![1, 2, 3].includes(booking?.rooms_booked || 1));
    const [checkIn, setCheckIn] = useState(booking?.check_in || '');
    const [checkOut, setCheckOut] = useState(booking?.check_out || '');
    const [amount, setAmount] = useState(booking ? String(booking.amount_paid) : '');
    const [sourceId, setSourceId] = useState(booking?.source_id || '');
    const [status, setStatus] = useState<'confirmed' | 'cancelled'>(booking?.status || 'confirmed');
    const [notes, setNotes] = useState(booking?.notes || '');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const nightCount = checkIn && checkOut ? nights(checkIn, checkOut) : 0;
    const activeProps = properties.filter((p) => p.is_active || p.id === propertyId);
    const activeSources = sources.filter((s) => s.is_active || s.id === sourceId);

    async function submit() {
        setError('');
        if (!guestName.trim()) return setError('Guest name is required');
        if (!checkIn || !checkOut) return setError('Check-in and check-out dates are required');
        if (checkOut <= checkIn) return setError('Check-out must be after check-in');

        setSaving(true);
        const payload = {
            guest_name: guestName, guest_email: guestEmail, guest_phone: guestPhone,
            property_id: propertyId || null, rooms_booked: rooms,
            check_in: checkIn, check_out: checkOut, amount_paid: Number(amount) || 0,
            source_id: sourceId || null, status, notes,
        };
        const res = await fetch(isEdit ? `/api/admin/crm/bookings/${booking!.id}` : '/api/admin/crm/bookings', {
            method: isEdit ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        setSaving(false);
        if (!res.ok) { setError((await res.json()).error || 'Failed to save'); return; }
        onSaved();
    }

    return (
        <Overlay onClose={onClose} title={isEdit ? 'Edit Booking' : 'Add Booking'}>
            <div className="space-y-4">
                <Field label="Guest name *">
                    <input value={guestName} onChange={(e) => setGuestName(e.target.value)} className={input} placeholder="Full name" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Email"><input value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} className={input} placeholder="guest@email.com" /></Field>
                    <Field label="Phone"><input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} className={input} placeholder="0801 234 5678" /></Field>
                </div>

                <Field label="Property">
                    <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className={input}>
                        <option value="">— No property —</option>
                        {activeProps.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.total_rooms} rooms)</option>)}
                    </select>
                </Field>

                <Field label="Rooms booked">
                    <div className="flex flex-wrap gap-2">
                        {ROOM_PRESETS.map((p) => (
                            <button key={p.rooms} type="button"
                                onClick={() => { setRooms(p.rooms); setCustomRooms(false); }}
                                className={`px-3 py-2 rounded-lg text-sm font-medium border ${!customRooms && rooms === p.rooms ? 'bg-green-600 text-white border-green-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                {p.label}
                            </button>
                        ))}
                        <button type="button" onClick={() => setCustomRooms(true)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium border ${customRooms ? 'bg-green-600 text-white border-green-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                            Custom
                        </button>
                        {customRooms && (
                            <input type="number" min={1} value={rooms} onChange={(e) => setRooms(Math.max(1, Number(e.target.value)))}
                                className="w-24 px-3 py-2 text-sm border border-gray-200 rounded-lg" placeholder="# rooms" />
                        )}
                    </div>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                    <Field label="Check-in *"><input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={input} /></Field>
                    <Field label="Check-out *"><input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={input} /></Field>
                </div>
                {nightCount > 0 && <p className="text-xs text-gray-400 -mt-2">{nightCount} night{nightCount > 1 ? 's' : ''}</p>}

                <div className="grid grid-cols-2 gap-3">
                    <Field label="Amount paid (₦)">
                        <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} className={input} placeholder="40000" />
                        {amount && <p className="text-xs text-gray-400 mt-1">{naira(Number(amount) || 0)}</p>}
                    </Field>
                    <Field label="Source">
                        <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className={input}>
                            <option value="">— Untagged —</option>
                            {activeSources.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                    </Field>
                </div>

                {isEdit && (
                    <Field label="Status">
                        <select value={status} onChange={(e) => setStatus(e.target.value as 'confirmed' | 'cancelled')} className={input}>
                            <option value="confirmed">Confirmed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </Field>
                )}

                <Field label="Notes">
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={input} placeholder="Anything worth remembering" />
                </Field>

                {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

                <div className="flex justify-end gap-2 pt-2">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
                    <button onClick={submit} disabled={saving} className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50">
                        {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add booking'}
                    </button>
                </div>
            </div>
        </Overlay>
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

export function Overlay({ children, title, onClose }: { children: React.ReactNode; title: string; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center p-4 bg-black/40 overflow-y-auto" onClick={onClose}>
            <div className="bg-white rounded-2xl w-full max-w-lg my-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
                    <h2 className="font-bold text-gray-900">{title}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
                </div>
                <div className="p-5">{children}</div>
            </div>
        </div>
    );
}
