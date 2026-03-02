'use client';

import { useState, useEffect } from 'react';
import { Plus, X, Building2, Pencil } from 'lucide-react';
import MediaUploader from '@/components/MediaUploader';

interface Property {
    id: string;
    name: string;
    description: string;
    address: string;
    area: string;
    city: string;
    state: string;
    type: string;
    price_per_night: number;
    max_guests: number;
    check_in_instructions: string;
    house_rules: string;
    amenities: string[];
    images: string[];
    thumbnail: string;
    is_active: boolean;
    is_featured: boolean;
    owner_id: string;
    caretaker_id: string;
    owner: { id: string; name: string; email: string } | null;
    caretaker: { id: string; name: string; email: string } | null;
    rooms: {
        id: string; name: string; price_per_night: number; max_guests: number; description: string;
        images: string[];
    }[];
}

interface Owner { id: string; name: string; email: string; }
interface Caretaker { id: string; name: string; email: string; }

export default function AdminPropertiesPage() {
    const [properties, setProperties] = useState<Property[]>([]);
    const [owners, setOwners] = useState<Owner[]>([]);
    const [caretakers, setCaretakers] = useState<Caretaker[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const initialFormState = {
        name: '', description: '', address: '', area: '', city: 'Lagos',
        type: 'Entire Apartment',
        price_per_night: '', max_guests: '2', owner_id: '', caretaker_id: '',
        check_in_instructions: '', house_rules: '',
        amenities: 'WiFi,AC,Smart TV,Kitchen,Security,Power Backup',
        thumbnail: '',
        images: [] as string[],
        is_featured: false,
        rooms: [{ name: 'Entire Property', price_per_night: '', max_guests: '2', description: '', images: [] as string[] }],
    };

    const [form, setForm] = useState(initialFormState);

    useEffect(() => {
        fetchAll();
    }, []);

    async function fetchAll() {
        const [propRes, ownerRes, ctRes] = await Promise.all([
            fetch('/api/admin/properties'),
            fetch('/api/admin/users?role=owner'),
            fetch('/api/admin/users?role=caretaker'),
        ]);
        const [propData, ownerData, ctData] = await Promise.all([propRes.json(), ownerRes.json(), ctRes.json()]);
        setProperties(propData.data || []);
        setOwners(ownerData.data || []);
        setCaretakers(ctData.data || []);
        setLoading(false);
    }

    function addRoom() {
        setForm({ ...form, rooms: [...form.rooms, { name: '', price_per_night: '', max_guests: '2', description: '', images: [] }] });
    }

    function removeRoom(i: number) {
        setForm({ ...form, rooms: form.rooms.filter((_, idx) => idx !== i) });
    }

    function updateRoom(i: number, field: string, value: any) {
        const rooms = [...form.rooms];
        (rooms[i] as any)[field] = value;
        setForm({ ...form, rooms });
    }

    function handleEdit(property: Property) {
        setEditingId(property.id);
        setForm({
            name: property.name || '',
            description: property.description || '',
            address: property.address || '',
            area: property.area || '',
            city: property.city || 'Lagos',
            type: property.type || 'Entire Apartment',
            price_per_night: property.price_per_night?.toString() || '',
            max_guests: property.max_guests?.toString() || '2',
            owner_id: property.owner_id || property.owner?.id || '',
            caretaker_id: property.caretaker_id || property.caretaker?.id || '',
            check_in_instructions: property.check_in_instructions || '',
            house_rules: property.house_rules || '',
            amenities: (property.amenities || []).join(','),
            thumbnail: property.thumbnail || (property.images && property.images.length > 0 ? property.images[0] : ''),
            images: property.images || [],
            is_featured: property.is_featured || false,
            rooms: property.rooms.length > 0 ? property.rooms.map(r => ({
                name: r.name,
                price_per_night: r.price_per_night?.toString() || '',
                max_guests: r.max_guests?.toString() || '2',
                description: r.description || '',
                images: r.images || [],
            })) : [{ name: 'Entire Property', price_per_night: '', max_guests: '2', description: '', images: [] }],
        });
        setShowCreate(true);
    }

    function handleCloseModal() {
        setShowCreate(false);
        setEditingId(null);
        setForm(initialFormState);
        setError('');
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setCreating(true);
        setError('');

        const payload = {
            name: form.name,
            description: form.description,
            address: form.address,
            area: form.area,
            city: form.city,
            type: form.type,
            price_per_night: Number(form.price_per_night),
            max_guests: Number(form.max_guests),
            owner_id: form.owner_id,
            caretaker_id: form.caretaker_id || null,
            check_in_instructions: form.check_in_instructions,
            house_rules: form.house_rules,
            amenities: form.amenities.split(',').map(a => a.trim()).filter(Boolean),
            thumbnail: form.thumbnail,
            images: form.images,
            is_featured: form.is_featured,
            rooms: [], // 1-to-1 mapping enforced. API will auto-create default room.
        };

        let res;
        if (editingId) {
            res = await fetch('/api/admin/properties', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: editingId, ...payload }),
            });
        } else {
            res = await fetch('/api/admin/properties', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        }

        const data = await res.json();
        if (data.error) {
            setError(data.error);
        } else {
            setSuccess(editingId ? 'Property updated successfully' : 'Property created successfully');
            handleCloseModal();
            fetchAll();
        }
        setCreating(false);
    }

    async function toggleActive(id: string, current: boolean) {
        await fetch('/api/admin/properties', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, is_active: !current }),
        });
        fetchAll();
    }

    async function toggleFeatured(id: string, current: boolean) {
        await fetch('/api/admin/properties', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, is_featured: !current }),
        });
        fetchAll();
    }

    const formatPrice = (n: number) => new Intl.NumberFormat('en-NG').format(n);

    if (loading) {
        return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-3 border-gray-200 border-t-red-500 rounded-full animate-spin" /></div>;
    }

    return (
        <div className="page-enter">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Properties</h1>
                    <p className="text-gray-500 mt-1">{properties.length} properties registered</p>
                </div>
                <button onClick={() => { setEditingId(null); setForm(initialFormState); setShowCreate(true); }}
                    className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
                    <Plus size={16} /> Add Property
                </button>
            </div>

            {(error || success) && (
                <div className={`mb-4 px-4 py-3 rounded-xl text-sm ${error ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
                    {error || success}
                    <button onClick={() => { setError(''); setSuccess(''); }} className="ml-2 font-bold">×</button>
                </div>
            )}

            {/* Create/Edit Property Modal */}
            {showCreate && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl max-w-4xl w-full p-6 my-8">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold">{editingId ? 'Edit Property' : 'Create Property'}</h2>
                            <button onClick={handleCloseModal}><X size={20} className="text-gray-400" /></button>
                        </div>
                        <form onSubmit={handleSave} className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Property Name *</label>
                                    <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                                        placeholder="e.g. Lekki Luxury Studio" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                    <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
                                </div>

                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Thumbnail</label>
                                    <MediaUploader
                                        single
                                        accept={{ 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] }}
                                        existingUrls={form.thumbnail ? [form.thumbnail] : []}
                                        onUpload={(urls) => setForm({ ...form, thumbnail: urls[0] || '' })}
                                    />
                                    <p className="text-xs text-gray-400 mt-1">Main image displayed in search results.</p>
                                </div>

                                <div className="col-span-2">
                                    <h3 className="font-medium text-gray-900 mb-2">Property Media (Gallery)</h3>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Images</label>
                                        <MediaUploader
                                            accept={{ 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] }}
                                            existingUrls={form.images}
                                            onUpload={(urls) => setForm({ ...form, images: urls })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                                    <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500">
                                        <option value="Entire Apartment">Entire Apartment</option>
                                        <option value="Shared Apartment">Shared Apartment</option>
                                        <option value="Studio">Studio</option>
                                        <option value="Room in Boutique Hotel">Room in Boutique Hotel</option>
                                        <option value="House">House</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Area *</label>
                                    <input type="text" required value={form.area} onChange={e => setForm({ ...form, area: e.target.value })}
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                                        placeholder="e.g. Lekki" />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                                    <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                                    <input type="text" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Price per Night (₦) *</label>
                                    <input type="number" required value={form.price_per_night} onChange={e => setForm({ ...form, price_per_night: e.target.value })}
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Guests</label>
                                    <input type="number" value={form.max_guests} onChange={e => setForm({ ...form, max_guests: e.target.value })}
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Owner *</label>
                                    <select required value={form.owner_id} onChange={e => setForm({ ...form, owner_id: e.target.value })}
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500">
                                        <option value="">Select owner...</option>
                                        {owners.map(o => <option key={o.id} value={o.id}>{o.name} ({o.email})</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Caretaker</label>
                                    <select value={form.caretaker_id} onChange={e => setForm({ ...form, caretaker_id: e.target.value })}
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500">
                                        <option value="">None (assign later)</option>
                                        {caretakers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Amenities</label>
                                <input type="text" value={form.amenities} onChange={e => setForm({ ...form, amenities: e.target.value })}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Check-in Instructions</label>
                                <textarea rows={2} value={form.check_in_instructions} onChange={e => setForm({ ...form, check_in_instructions: e.target.value })}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                                    placeholder="Door codes, directions, etc." />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">House Rules</label>
                                <textarea rows={2} value={form.house_rules} onChange={e => setForm({ ...form, house_rules: e.target.value })}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
                            </div>

                            <div className="flex items-center gap-3 p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
                                <input
                                    type="checkbox"
                                    id="is_featured"
                                    checked={form.is_featured}
                                    onChange={e => setForm({ ...form, is_featured: e.target.checked })}
                                    className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                />
                                <label htmlFor="is_featured" className="text-sm font-medium text-blue-900 cursor-pointer select-none">
                                    Show on Homepage (Featured Property)
                                </label>
                            </div>

                            {/* Rooms UI Removed to enforce 1-to-1 Property:Room mapping */}

                            <button type="submit" disabled={creating}
                                className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                                {creating ? 'Saving...' : (editingId ? 'Save Changes' : 'Create Property')}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Properties Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {properties.map(prop => (
                    <div key={prop.id} className={`bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow ${!prop.is_active ? 'opacity-60' : ''}`}>
                        {prop.thumbnail || (prop.images && prop.images.length > 0) ? (
                            <img src={prop.thumbnail || prop.images[0]} alt={prop.name} className="w-full h-40 object-cover rounded-lg mb-3" />
                        ) : null}
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                                    <Building2 size={20} />
                                </div>
                                {prop.is_featured && (
                                    <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                        ★ Featured
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => toggleFeatured(prop.id, prop.is_featured)}
                                    title="Toggle show on Homepage"
                                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${prop.is_featured ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' : 'bg-gray-50 text-gray-500 border-transparent hover:bg-gray-100'}`}>
                                    {prop.is_featured ? 'On Homepage' : 'Add to Homepage'}
                                </button>
                                <button onClick={() => toggleActive(prop.id, prop.is_active)}
                                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${prop.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {prop.is_active ? 'Active' : 'Inactive'}
                                </button>
                                <button onClick={() => handleEdit(prop)}
                                    className="p-1 px-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                                    <Pencil size={14} />
                                </button>
                            </div>
                        </div>
                        <h3 className="font-semibold text-gray-900 mb-1">{prop.name}</h3>
                        <p className="text-sm text-gray-500 mb-3">{prop.type} • {prop.area}, {prop.city}</p>
                        <p className="text-lg font-bold text-gray-900 mb-3">
                            <span>₦{formatPrice(prop.price_per_night)}</span>
                            <span className="text-xs font-normal text-gray-400">/night</span>
                        </p>

                        <div className="space-y-1.5 text-xs text-gray-500">
                            <p>👤 Owner: <span className="text-gray-700">{prop.owner?.name || 'Not assigned'}</span></p>
                            <p>🏠 Caretaker: <span className="text-gray-700">{prop.caretaker?.name || 'Not assigned'}</span></p>
                        </div>
                    </div>
                ))}
                {properties.length === 0 && (
                    <div className="col-span-full text-center py-12 text-gray-400">
                        No properties yet. Click &quot;Add Property&quot; to create one.
                    </div>
                )}
            </div>
        </div>
    );
}
