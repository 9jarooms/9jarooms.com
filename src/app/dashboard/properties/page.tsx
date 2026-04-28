'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
    Building2, MapPin, Users, CalendarDays, Pencil, X,
    ImageOff, Wifi, Wind, Tv, Car, Shield, Dumbbell, Waves, Zap,
    UtensilsCrossed, Loader2, Check,
} from 'lucide-react';
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
    is_active: boolean;
    check_in_instructions: string | null;
    house_rules: string | null;
    rooms?: { id: string; name: string; price_per_night: number }[];
}

const ALL_AMENITIES = ['WiFi', 'AC', 'Smart TV', 'TV', 'Kitchen', 'Parking', 'Security', 'Gym', 'Pool', 'Power Backup', 'Laundry', 'Workspace'];

const amenityIcon: Record<string, React.ReactNode> = {
    'WiFi': <Wifi size={12} />, 'AC': <Wind size={12} />, 'Smart TV': <Tv size={12} />, 'TV': <Tv size={12} />,
    'Kitchen': <UtensilsCrossed size={12} />, 'Parking': <Car size={12} />, 'Security': <Shield size={12} />,
    'Gym': <Dumbbell size={12} />, 'Pool': <Waves size={12} />, 'Power Backup': <Zap size={12} />,
};

const formatPrice = (price: number) => new Intl.NumberFormat('en-NG').format(price);

export default function PropertiesPage() {
    const router = useRouter();
    const [properties, setProperties] = useState<Property[]>([]);
    const [loading, setLoading] = useState(true);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editSaving, setEditSaving] = useState(false);
    const [editSuccess, setEditSuccess] = useState(false);
    const [editError, setEditError] = useState('');
    const [editForm, setEditForm] = useState({
        name: '', description: '', area: '', city: '',
        price_per_night: '', max_guests: '',
        amenities: [] as string[], images: [] as string[], thumbnail: '',
        check_in_instructions: '', house_rules: '',
    });

    const fetchProperties = useCallback(async () => {
        const res = await fetch('/api/dashboard/properties');
        if (res.ok) {
            const data = await res.json();
            setProperties(data.properties || []);
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchProperties(); }, [fetchProperties]);

    function openEdit(p: Property) {
        setEditingId(p.id);
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

    async function handleSave() {
        if (!editingId) return;
        setEditSaving(true); setEditError('');
        try {
            const res = await fetch(`/api/properties/${editingId}/settings`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editForm.name,
                    description: editForm.description || null,
                    area: editForm.area,
                    city: editForm.city,
                    price_per_night: Number(editForm.price_per_night),
                    max_guests: Number(editForm.max_guests),
                    amenities: editForm.amenities,
                    images: editForm.images,
                    thumbnail: editForm.thumbnail || editForm.images[0] || null,
                    check_in_instructions: editForm.check_in_instructions || null,
                    house_rules: editForm.house_rules || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save');
            setEditSuccess(true);
            await fetchProperties();
            setTimeout(() => { setEditingId(null); setEditSuccess(false); }, 800);
        } catch (e: any) {
            setEditError(e.message);
        } finally {
            setEditSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-3 border-gray-200 border-t-green-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Properties</h1>
                <p className="text-gray-500 text-sm mt-1">Manage your assigned properties</p>
            </div>

            {properties.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
                    <Building2 size={32} className="text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No properties assigned to you yet</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {properties.map(p => (
                        <div key={p.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-sm transition-shadow">
                            {/* Thumbnail */}
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

                            {/* Info */}
                            <div className="p-4">
                                <h3 className="font-semibold text-gray-900 truncate">{p.name}</h3>
                                <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                                    <MapPin size={11} />
                                    <span className="truncate">{p.area ? `${p.area}, ` : ''}{p.city}</span>
                                </div>
                                <div className="flex items-center gap-3 mt-2 text-sm">
                                    <span className="font-medium text-green-700">
                                        ₦{formatPrice(p.price_per_night)}<span className="text-xs text-gray-400 font-normal">/night</span>
                                    </span>
                                    <span className="text-gray-400 text-xs flex items-center gap-1">
                                        <Users size={11} />{p.max_guests} guests
                                    </span>
                                    {p.rooms && p.rooms.length > 0 && (
                                        <span className="text-gray-400 text-xs">{p.rooms.length} room{p.rooms.length !== 1 ? 's' : ''}</span>
                                    )}
                                </div>

                                {/* Amenity chips */}
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

                                {/* Actions */}
                                <div className="flex gap-2 mt-3">
                                    <Link
                                        href={`/dashboard/properties/${p.id}`}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-xl transition-colors border border-green-100"
                                    >
                                        <CalendarDays size={13} />
                                        Manage Dates
                                    </Link>
                                    <button
                                        onClick={() => openEdit(p)}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors border border-gray-100"
                                    >
                                        <Pencil size={13} />
                                        Edit
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Edit Bottom Sheet */}
            {editingId && (
                <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center bg-black/50">
                    <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col">
                        {/* Drag handle (mobile) */}
                        <div className="flex justify-center pt-3 pb-1 sm:hidden">
                            <div className="w-10 h-1 rounded-full bg-gray-200" />
                        </div>
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                            <h2 className="font-semibold text-gray-900">Edit Property</h2>
                            <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                                <X size={18} className="text-gray-500" />
                            </button>
                        </div>
                        {/* Scrollable form */}
                        <div className="overflow-y-auto px-5 py-4 space-y-4 flex-1">
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-2 block">Photos</label>
                                <MediaUploader
                                    images={editForm.images}
                                    onChange={imgs => setEditForm(f => ({ ...f, images: imgs, thumbnail: imgs[0] || '' }))}
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
                        {/* Footer */}
                        <div className="px-5 pb-6 pt-3 border-t border-gray-100">
                            <button
                                onClick={handleSave}
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
        </>
    );
}
