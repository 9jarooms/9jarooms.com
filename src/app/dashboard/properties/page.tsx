'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Users, Pencil, X, Check, ChevronRight, ImageOff, Wifi, Wind, Tv, Car, Shield, Dumbbell, Waves, Zap, UtensilsCrossed, Loader2 } from 'lucide-react';
import MediaUploader from '@/components/MediaUploader';

interface Property {
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
    check_in_instructions: string | null;
    house_rules: string | null;
    is_active: boolean;
}

const ALL_AMENITIES = ['WiFi', 'AC', 'Smart TV', 'TV', 'Kitchen', 'Parking', 'Security', 'Gym', 'Pool', 'Power Backup', 'Laundry', 'Workspace'];

const amenityIcon: Record<string, React.ReactNode> = {
    'WiFi': <Wifi size={13} />, 'AC': <Wind size={13} />, 'Smart TV': <Tv size={13} />, 'TV': <Tv size={13} />,
    'Kitchen': <UtensilsCrossed size={13} />, 'Parking': <Car size={13} />, 'Security': <Shield size={13} />,
    'Gym': <Dumbbell size={13} />, 'Pool': <Waves size={13} />, 'Power Backup': <Zap size={13} />,
};

export default function CaretakerPropertiesPage() {
    const supabase = createClient();
    const [properties, setProperties] = useState<Property[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [error, setError] = useState('');

    const blankForm = {
        name: '', description: '', area: '', city: '',
        price_per_night: '', max_guests: '',
        amenities: [] as string[],
        images: [] as string[],
        thumbnail: '',
        check_in_instructions: '',
        house_rules: '',
    };
    const [form, setForm] = useState(blankForm);

    useEffect(() => { fetchProperties(); }, []);

    async function fetchProperties() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
            .from('properties')
            .select('id,name,description,area,city,price_per_night,max_guests,amenities,images,thumbnail,check_in_instructions,house_rules,is_active')
            .eq('caretaker_id', user.id)
            .order('created_at', { ascending: false });
        setProperties(data || []);
        setLoading(false);
    }

    function openEdit(p: Property) {
        setEditingId(p.id);
        setForm({
            name: p.name || '',
            description: p.description || '',
            area: p.area || '',
            city: p.city || '',
            price_per_night: p.price_per_night?.toString() || '',
            max_guests: p.max_guests?.toString() || '',
            amenities: p.amenities || [],
            images: p.images || [],
            thumbnail: p.thumbnail || '',
            check_in_instructions: p.check_in_instructions || '',
            house_rules: p.house_rules || '',
        });
        setError('');
        setSaveSuccess(false);
    }

    function toggleAmenity(a: string) {
        setForm(f => ({
            ...f,
            amenities: f.amenities.includes(a) ? f.amenities.filter(x => x !== a) : [...f.amenities, a],
        }));
    }

    async function handleSave() {
        if (!editingId) return;
        setSaving(true);
        setError('');
        try {
            const res = await fetch(`/api/properties/${editingId}/settings`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: form.name,
                    description: form.description || null,
                    area: form.area,
                    city: form.city,
                    price_per_night: Number(form.price_per_night),
                    max_guests: Number(form.max_guests),
                    amenities: form.amenities,
                    images: form.images,
                    thumbnail: form.thumbnail || form.images[0] || null,
                    check_in_instructions: form.check_in_instructions || null,
                    house_rules: form.house_rules || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save');
            setSaveSuccess(true);
            setProperties(prev => prev.map(p => p.id === editingId ? {
                ...p,
                name: form.name, description: form.description || null,
                area: form.area, city: form.city,
                price_per_night: Number(form.price_per_night),
                max_guests: Number(form.max_guests),
                amenities: form.amenities, images: form.images,
                thumbnail: form.thumbnail || form.images[0] || null,
                check_in_instructions: form.check_in_instructions || null,
                house_rules: form.house_rules || null,
            } : p));
            setTimeout(() => { setEditingId(null); setSaveSuccess(false); }, 800);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-gray-200 border-t-green-500 rounded-full animate-spin" /></div>;
    }

    return (
        <>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">My Properties</h1>
                <p className="text-gray-500 text-sm mt-1">Tap a property to manage availability or edit its details</p>
            </div>

            {properties.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
                    <ImageOff size={32} className="text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No properties assigned to you yet</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {properties.map(p => {
                        const img = p.thumbnail || p.images?.[0];
                        return (
                            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                                {/* Property image */}
                                <div className="relative aspect-[16/9] bg-gray-100">
                                    {img ? (
                                        <Image src={img} alt={p.name} fill sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <ImageOff size={28} className="text-gray-300" />
                                        </div>
                                    )}
                                    <div className="absolute top-2 right-2">
                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${p.is_active ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                                            {p.is_active ? 'Active' : 'Draft'}
                                        </span>
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="p-4">
                                    <h3 className="font-semibold text-gray-900 text-base leading-tight">{p.name}</h3>
                                    <div className="flex items-center gap-1 mt-1 text-sm text-gray-400">
                                        <MapPin size={13} />
                                        <span>{p.area ? `${p.area}, ` : ''}{p.city}</span>
                                    </div>
                                    <div className="flex items-center justify-between mt-2">
                                        <div>
                                            <span className="text-base font-bold text-gray-900">₦{p.price_per_night?.toLocaleString()}</span>
                                            <span className="text-xs text-gray-400"> / night</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-xs text-gray-400">
                                            <Users size={13} />
                                            {p.max_guests} guests
                                        </div>
                                    </div>

                                    {/* Amenity chips */}
                                    {p.amenities?.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-3">
                                            {p.amenities.slice(0, 4).map(a => (
                                                <span key={a} className="flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">
                                                    {amenityIcon[a] || null}{a}
                                                </span>
                                            ))}
                                            {p.amenities.length > 4 && (
                                                <span className="text-[11px] text-gray-400 px-2 py-0.5">+{p.amenities.length - 4} more</span>
                                            )}
                                        </div>
                                    )}

                                    {/* Action buttons */}
                                    <div className="flex gap-2 mt-4">
                                        <Link
                                            href={`/dashboard/properties/${p.id}`}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-medium transition-colors"
                                        >
                                            Manage Dates <ChevronRight size={14} />
                                        </Link>
                                        <button
                                            onClick={() => openEdit(p)}
                                            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors"
                                        >
                                            <Pencil size={14} />
                                            Edit
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Edit bottom sheet (slides up on mobile, centered on desktop) */}
            {editingId && (
                <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center bg-black/50">
                    <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl max-h-[92vh] flex flex-col">
                        {/* Handle + header */}
                        <div className="sm:hidden flex justify-center pt-3 pb-1">
                            <div className="w-10 h-1 bg-gray-200 rounded-full" />
                        </div>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                            <h2 className="font-bold text-gray-900 text-lg">Edit Property</h2>
                            <button onClick={() => setEditingId(null)} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                                <X size={20} className="text-gray-500" />
                            </button>
                        </div>

                        {/* Scrollable body */}
                        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

                            {/* Photos */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Photos</label>
                                <MediaUploader
                                    images={form.images}
                                    onImagesChange={imgs => setForm(f => ({ ...f, images: imgs, thumbnail: imgs[0] || '' }))}
                                    propertyId={editingId}
                                />
                            </div>

                            {/* Name */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Property Name</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
                                <textarea
                                    rows={3}
                                    value={form.description}
                                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder="Describe the property..."
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-400 resize-none"
                                />
                            </div>

                            {/* Area + City */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Area</label>
                                    <input
                                        type="text"
                                        value={form.area}
                                        onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
                                        placeholder="e.g. Wuse 2"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">City</label>
                                    <input
                                        type="text"
                                        value={form.city}
                                        onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-400"
                                    />
                                </div>
                            </div>

                            {/* Price + Guests */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Price / night (₦)</label>
                                    <input
                                        type="number"
                                        value={form.price_per_night}
                                        onChange={e => setForm(f => ({ ...f, price_per_night: e.target.value }))}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Max Guests</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={form.max_guests}
                                        onChange={e => setForm(f => ({ ...f, max_guests: e.target.value }))}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-400"
                                    />
                                </div>
                            </div>

                            {/* Amenities */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Amenities</label>
                                <div className="flex flex-wrap gap-2">
                                    {ALL_AMENITIES.map(a => (
                                        <button
                                            key={a}
                                            type="button"
                                            onClick={() => toggleAmenity(a)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                                form.amenities.includes(a)
                                                    ? 'bg-green-500 text-white border-green-500'
                                                    : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'
                                            }`}
                                        >
                                            {amenityIcon[a] || null}{a}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Check-in Instructions */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Check-in Instructions</label>
                                <textarea
                                    rows={3}
                                    value={form.check_in_instructions}
                                    onChange={e => setForm(f => ({ ...f, check_in_instructions: e.target.value }))}
                                    placeholder="Door codes, directions, meeting point..."
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-400 resize-none"
                                />
                            </div>

                            {/* House Rules */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">House Rules</label>
                                <textarea
                                    rows={3}
                                    value={form.house_rules}
                                    onChange={e => setForm(f => ({ ...f, house_rules: e.target.value }))}
                                    placeholder="No smoking, quiet hours, max guests..."
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-400 resize-none"
                                />
                            </div>

                            {error && (
                                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{error}</div>
                            )}
                        </div>

                        {/* Sticky save button */}
                        <div className="px-5 py-4 border-t border-gray-100 shrink-0 bg-white">
                            <button
                                onClick={handleSave}
                                disabled={saving || saveSuccess}
                                className={`w-full py-3.5 rounded-xl text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                                    saveSuccess ? 'bg-green-500' : 'bg-gray-900 hover:bg-gray-800 disabled:opacity-50'
                                }`}
                            >
                                {saving ? <><Loader2 size={16} className="animate-spin" />Saving...</>
                                    : saveSuccess ? <><Check size={16} />Saved!</>
                                    : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
