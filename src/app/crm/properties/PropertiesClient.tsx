'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, X, Trash2, Pencil } from 'lucide-react';
import MediaUploader from '@/components/MediaUploader';
import EditPropertyModal from './EditPropertyModal';

function naira(n: number) {
    return '₦' + Number(n || 0).toLocaleString('en-NG');
}

export default function PropertiesClient() {
    const [rows, setRows] = useState<any[]>([]);
    const [creating, setCreating] = useState(false);
    const [editFor, setEditFor] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        const res = await fetch('/api/crm/properties');
        if (res.ok) setRows((await res.json()).properties);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const toggleActive = async (p: any) => {
        await fetch('/api/crm/properties', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ propertyId: p.id, isActive: !p.is_active }),
        });
        load();
    };

    const removeProperty = async (p: any) => {
        if (!confirm(`Delete "${p.name}"? It disappears from the site and the CRM. Past bookings are kept.`)) return;
        setError(null);
        const res = await fetch(`/api/crm/properties?propertyId=${p.id}`, { method: 'DELETE' });
        if (!res.ok) {
            setError((await res.json()).error);
            return;
        }
        load();
    };

    return (
        <div className="p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
                <h1 className="text-[22px] sm:text-[26px] font-extrabold tracking-tight text-stone-900">Properties</h1>
                <button onClick={() => setCreating(true)}
                    className="ml-auto flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#008737] text-white text-sm font-semibold shrink-0">
                    <Plus size={15} /> <span className="hidden sm:inline">New property</span><span className="sm:hidden">New</span>
                </button>
            </div>

            {error && (
                <p className="mb-3 text-xs font-semibold text-[#c75146] bg-red-50 rounded-lg px-3.5 py-2.5">{error}</p>
            )}

            <div className="grid gap-3">
                {rows.map(p => (
                    <div key={p.id} className="bg-white rounded-2xl border border-stone-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)] px-5 py-4 flex flex-wrap items-center gap-4">
                        <div className="min-w-0 flex-1">
                            <p className="font-semibold text-stone-800">{p.name}</p>
                            <p className="text-xs text-stone-400 mt-0.5">{p.area}{p.city ? `, ${p.city}` : ''} · from {naira(p.price_per_night)}/night</p>
                            {p.roomTypes.length > 0 ? (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {p.roomTypes.map((t: any) => (
                                        <span key={t.id} className="px-2.5 py-1 rounded-full bg-[#f4f9f1] text-[#02572a] text-xs font-medium">
                                            {t.name} · {t.unitCount} units · {naira(t.price_per_night)}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-stone-400 mt-1.5">{p.unitCount} bookable room{p.unitCount === 1 ? '' : 's'}</p>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${p.is_active ? 'bg-green-100 text-green-800' : 'bg-stone-100 text-stone-500'}`}>
                                {p.is_active ? 'Live' : 'Hidden'}
                            </span>
                            <button onClick={() => setEditFor(p)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-stone-300 text-xs font-semibold hover:bg-stone-50">
                                <Pencil size={13} /> Edit
                            </button>
                            <button onClick={() => toggleActive(p)}
                                className="px-3 py-1.5 rounded-md border border-stone-300 text-xs font-semibold hover:bg-stone-50">
                                {p.is_active ? 'Hide from site' : 'Publish'}
                            </button>
                            <button onClick={() => removeProperty(p)}
                                title="Delete property"
                                className="p-1.5 rounded-md border border-stone-200 text-stone-400 hover:text-[#c75146] hover:border-[#c75146]/40">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}
                {!loading && rows.length === 0 && (
                    <p className="text-stone-400 text-sm py-10 text-center">No properties yet.</p>
                )}
            </div>

            {creating && <NewPropertyModal onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load(); }} />}
            {editFor && (
                <EditPropertyModal
                    property={editFor}
                    onClose={() => setEditFor(null)}
                    onSaved={() => { setEditFor(null); load(); }}
                />
            )}
        </div>
    );
}

function NewPropertyModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const [form, setForm] = useState({
        name: '', area: '', city: 'Abuja', address: '', description: '', pricePerNight: '', maxGuests: '2',
    });
    const [images, setImages] = useState<string[]>([]);
    const [thumbnail, setThumbnail] = useState<string | null>(null);
    const [roomTypes, setRoomTypes] = useState<{ name: string; pricePerNight: string; units: string; images: string[] }[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async () => {
        setBusy(true); setError(null);
        const res = await fetch('/api/crm/properties', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: form.name,
                area: form.area,
                city: form.city,
                address: form.address || null,
                description: form.description || null,
                pricePerNight: Number(form.pricePerNight),
                maxGuests: Number(form.maxGuests) || 2,
                images,
                thumbnail: thumbnail || images[0] || null,
                roomTypes: roomTypes
                    .filter(t => t.name && Number(t.pricePerNight) > 0 && Number(t.units) > 0)
                    .map(t => ({ name: t.name, pricePerNight: Number(t.pricePerNight), units: Number(t.units), images: t.images })),
            }),
        });
        const json = await res.json();
        setBusy(false);
        if (!res.ok) { setError(json.error); return; }
        onCreated();
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto py-10" onClick={onClose}>
            <div className="bg-white rounded-xl w-[560px] max-w-[94vw] shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-stone-200">
                    <h2 className="font-bold text-stone-900">New property</h2>
                    <button onClick={onClose} className="p-1.5 rounded-md hover:bg-stone-100"><X size={18} /></button>
                </div>

                {error && <p className="mx-6 mt-3 text-xs text-[#c75146] bg-red-50 rounded-md px-3 py-2">{error}</p>}

                <div className="px-4 sm:px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <label className="block sm:col-span-2">
                        <span className="text-xs text-stone-500">Name *</span>
                        <input className="mt-1 w-full border border-stone-300 rounded-md px-2.5 py-1.5" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                    </label>
                    <label className="block">
                        <span className="text-xs text-stone-500">Area *</span>
                        <input className="mt-1 w-full border border-stone-300 rounded-md px-2.5 py-1.5" placeholder="e.g. Kaura" value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} />
                    </label>
                    <label className="block">
                        <span className="text-xs text-stone-500">City</span>
                        <input className="mt-1 w-full border border-stone-300 rounded-md px-2.5 py-1.5" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
                    </label>
                    <label className="block">
                        <span className="text-xs text-stone-500">Base price / night (₦) *</span>
                        <input type="number" className="mt-1 w-full border border-stone-300 rounded-md px-2.5 py-1.5" value={form.pricePerNight} onChange={e => setForm({ ...form, pricePerNight: e.target.value })} />
                    </label>
                    <label className="block">
                        <span className="text-xs text-stone-500">Max guests</span>
                        <input type="number" className="mt-1 w-full border border-stone-300 rounded-md px-2.5 py-1.5" value={form.maxGuests} onChange={e => setForm({ ...form, maxGuests: e.target.value })} />
                    </label>
                    <label className="block sm:col-span-2">
                        <span className="text-xs text-stone-500">Address</span>
                        <input className="mt-1 w-full border border-stone-300 rounded-md px-2.5 py-1.5" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                    </label>
                    <label className="block sm:col-span-2">
                        <span className="text-xs text-stone-500">Description</span>
                        <textarea rows={2} className="mt-1 w-full border border-stone-300 rounded-md px-2.5 py-1.5" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                    </label>

                    <div className="sm:col-span-2">
                        <span className="text-xs font-semibold text-stone-600">Property photos</span>
                        <p className="text-[11px] text-stone-400 mb-2">Gallery for the listing page. Star one as the cover.</p>
                        <MediaUploader
                            folder="crm/new"
                            existingUrls={images}
                            onUpload={setImages}
                            thumbnail={thumbnail || images[0]}
                            onThumbnailChange={setThumbnail}
                        />
                    </div>

                    <div className="sm:col-span-2 mt-1">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-semibold text-stone-600">Room types (pooled units)</span>
                            <button onClick={() => setRoomTypes([...roomTypes, { name: '', pricePerNight: '', units: '', images: [] }])}
                                className="text-xs font-semibold text-[#008737]">+ Add room type</button>
                        </div>
                        <p className="text-[11px] text-stone-400 mb-2">
                            Leave empty for a simple whole-property listing. With room types, the site shows one card per type and it stays bookable until every unit is full.
                            Only pool rooms into one type when they look the same — each type card shows its own photos.
                        </p>
                        {roomTypes.map((t, i) => (
                            <div key={i} className="mb-3 p-3 rounded-xl border border-stone-200 bg-stone-50/50">
                                <div className="flex flex-wrap gap-2 mb-2 items-center">
                                    <input placeholder="Name (e.g. Classic Room)" className="flex-1 min-w-[140px] border border-stone-300 rounded-md px-2.5 py-2 bg-white"
                                        value={t.name} onChange={e => setRoomTypes(roomTypes.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                                    <input placeholder="₦/night" type="number" className="w-24 border border-stone-300 rounded-md px-2.5 py-2 bg-white"
                                        value={t.pricePerNight} onChange={e => setRoomTypes(roomTypes.map((x, j) => j === i ? { ...x, pricePerNight: e.target.value } : x))} />
                                    <input placeholder="Units" type="number" className="w-20 border border-stone-300 rounded-md px-2.5 py-2 bg-white"
                                        value={t.units} onChange={e => setRoomTypes(roomTypes.map((x, j) => j === i ? { ...x, units: e.target.value } : x))} />
                                    <button onClick={() => setRoomTypes(roomTypes.filter((_, j) => j !== i))} className="text-stone-300 hover:text-[#c75146]"><Trash2 size={15} /></button>
                                </div>
                                <MediaUploader
                                    folder="crm/new"
                                    existingUrls={t.images}
                                    onUpload={(urls) => setRoomTypes(roomTypes.map((x, j) => j === i ? { ...x, images: urls } : x))}
                                />
                            </div>
                        ))}
                    </div>

                    <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
                        <button onClick={onClose} className="px-4 py-2 rounded-md border border-stone-300 text-sm">Cancel</button>
                        <button
                            disabled={busy || form.name.trim().length < 3 || !form.area || !Number(form.pricePerNight)}
                            onClick={submit}
                            className="px-4 py-2 rounded-md bg-[#008737] text-white text-sm font-semibold disabled:opacity-50">
                            {busy ? 'Creating…' : 'Create property'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
