'use client';

import { useState } from 'react';
import { X, Plus, EyeOff, Eye } from 'lucide-react';

// Edit a property's details and its room types (rename, reprice,
// add a type with pooled units, hide/show a type).
export default function EditPropertyModal({ property, onClose, onSaved }: {
    property: any;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [form, setForm] = useState({
        name: property.name || '',
        area: property.area || '',
        city: property.city || 'Abuja',
        address: property.address || '',
        description: property.description || '',
        pricePerNight: String(property.price_per_night ?? ''),
        maxGuests: String(property.max_guests ?? 2),
    });
    const [types, setTypes] = useState<any[]>(
        (property.roomTypes || []).map((t: any) => ({
            id: t.id, name: t.name, price: String(t.price_per_night), isActive: t.is_active !== false, unitCount: t.unitCount,
        }))
    );
    const [newType, setNewType] = useState({ name: '', price: '', units: '' });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const save = async () => {
        setBusy(true); setError(null);
        try {
            const res = await fetch('/api/crm/properties', {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    propertyId: property.id,
                    name: form.name,
                    area: form.area,
                    city: form.city,
                    address: form.address || null,
                    description: form.description || null,
                    pricePerNight: Number(form.pricePerNight) || undefined,
                    maxGuests: Number(form.maxGuests) || undefined,
                }),
            });
            if (!res.ok) throw new Error((await res.json()).error);

            for (const t of types) {
                const original = (property.roomTypes || []).find((x: any) => x.id === t.id);
                const changed = original && (
                    original.name !== t.name ||
                    String(original.price_per_night) !== t.price ||
                    (original.is_active !== false) !== t.isActive
                );
                if (changed) {
                    const r = await fetch('/api/crm/room-types', {
                        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            roomTypeId: t.id,
                            name: t.name,
                            pricePerNight: Number(t.price) || undefined,
                            isActive: t.isActive,
                        }),
                    });
                    if (!r.ok) throw new Error((await r.json()).error);
                }
            }

            if (newType.name && Number(newType.price) > 0 && Number(newType.units) > 0) {
                const r = await fetch('/api/crm/room-types', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        propertyId: property.id,
                        name: newType.name,
                        pricePerNight: Number(newType.price),
                        units: Number(newType.units),
                    }),
                });
                if (!r.ok) throw new Error((await r.json()).error);
            }

            onSaved();
        } catch (e: any) {
            setError(e.message || 'Failed to save');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto py-10" onClick={onClose}>
            <div className="bg-white rounded-2xl w-[600px] max-w-[94vw] shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 pt-5 pb-3.5 border-b border-stone-200">
                    <h2 className="font-bold text-stone-900">Edit — {property.name}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100"><X size={18} /></button>
                </div>

                {error && <p className="mx-6 mt-3 text-xs text-[#c75146] bg-red-50 rounded-lg px-3 py-2">{error}</p>}

                <div className="px-6 py-4 grid grid-cols-2 gap-3 text-sm max-h-[65vh] overflow-y-auto">
                    <label className="block col-span-2">
                        <span className="text-xs text-stone-500">Name</span>
                        <input className="mt-1 w-full border border-stone-300 rounded-md px-2.5 py-1.5" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                    </label>
                    <label className="block">
                        <span className="text-xs text-stone-500">Area</span>
                        <input className="mt-1 w-full border border-stone-300 rounded-md px-2.5 py-1.5" value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} />
                    </label>
                    <label className="block">
                        <span className="text-xs text-stone-500">City</span>
                        <input className="mt-1 w-full border border-stone-300 rounded-md px-2.5 py-1.5" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
                    </label>
                    <label className="block">
                        <span className="text-xs text-stone-500">Base price / night (₦)</span>
                        <input type="number" className="mt-1 w-full border border-stone-300 rounded-md px-2.5 py-1.5" value={form.pricePerNight} onChange={e => setForm({ ...form, pricePerNight: e.target.value })} />
                    </label>
                    <label className="block">
                        <span className="text-xs text-stone-500">Max guests</span>
                        <input type="number" className="mt-1 w-full border border-stone-300 rounded-md px-2.5 py-1.5" value={form.maxGuests} onChange={e => setForm({ ...form, maxGuests: e.target.value })} />
                    </label>
                    <label className="block col-span-2">
                        <span className="text-xs text-stone-500">Address (kept private, sent to guests after booking)</span>
                        <input className="mt-1 w-full border border-stone-300 rounded-md px-2.5 py-1.5" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                    </label>
                    <label className="block col-span-2">
                        <span className="text-xs text-stone-500">Description</span>
                        <textarea rows={3} className="mt-1 w-full border border-stone-300 rounded-md px-2.5 py-1.5" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                    </label>

                    {types.length > 0 && (
                        <div className="col-span-2 mt-1">
                            <span className="text-xs font-semibold text-stone-600">Room types</span>
                            <p className="text-[11px] text-stone-400 mb-2">Rename, change nightly price, or hide a room from the site. Photos live under the Photos button.</p>
                            {types.map((t, i) => (
                                <div key={t.id} className={`flex gap-2 mb-2 items-center ${t.isActive ? '' : 'opacity-50'}`}>
                                    <input className="flex-1 border border-stone-300 rounded-md px-2.5 py-1.5"
                                        value={t.name} onChange={e => setTypes(types.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                                    <input type="number" className="w-28 border border-stone-300 rounded-md px-2.5 py-1.5"
                                        value={t.price} onChange={e => setTypes(types.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} />
                                    <span className="text-[11px] text-stone-400 w-14">{t.unitCount} unit{t.unitCount === 1 ? '' : 's'}</span>
                                    <button
                                        title={t.isActive ? 'Hide from site' : 'Show on site'}
                                        onClick={() => setTypes(types.map((x, j) => j === i ? { ...x, isActive: !x.isActive } : x))}
                                        className="p-1.5 rounded-md border border-stone-200 text-stone-500 hover:bg-stone-50">
                                        {t.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="col-span-2 mt-1 p-3 rounded-xl border border-dashed border-stone-300">
                        <span className="text-xs font-semibold text-stone-600 flex items-center gap-1"><Plus size={13} /> Add a room type</span>
                        <div className="flex gap-2 mt-2">
                            <input placeholder="Name" className="flex-1 border border-stone-300 rounded-md px-2.5 py-1.5"
                                value={newType.name} onChange={e => setNewType({ ...newType, name: e.target.value })} />
                            <input placeholder="₦/night" type="number" className="w-24 border border-stone-300 rounded-md px-2.5 py-1.5"
                                value={newType.price} onChange={e => setNewType({ ...newType, price: e.target.value })} />
                            <input placeholder="Units" type="number" className="w-18 border border-stone-300 rounded-md px-2.5 py-1.5"
                                value={newType.units} onChange={e => setNewType({ ...newType, units: e.target.value })} />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 px-6 py-4 border-t border-stone-200">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg border border-stone-300 text-sm font-semibold">Cancel</button>
                    <button disabled={busy || form.name.trim().length < 3} onClick={save}
                        className="px-5 py-2 rounded-lg bg-[#008737] text-white text-sm font-bold disabled:opacity-50 hover:bg-[#02572a] transition-colors">
                        {busy ? 'Saving…' : 'Save changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}
