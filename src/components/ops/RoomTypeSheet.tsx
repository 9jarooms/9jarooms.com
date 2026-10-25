'use client';

import { useState } from 'react';
import { Globe, EyeOff, ImagePlus } from 'lucide-react';
import MediaUploader from '@/components/MediaUploader';
import { Sheet, BigButton, Field, inputCls, naira, type OpsRoomType } from './shared';

// One room type = one listing on the website. Every unit of the type (A1, A2 …) shares these photos and
// this price; a website guest books the type and the app gives them whichever unit is free.
// "Show on website" takes the whole listing off the site; caretakers can still book its units here.
export default function RoomTypeSheet({ type, unitCount, propertyName, onClose, onSaved }: {
    type: OpsRoomType; unitCount: number; propertyName?: string | null;
    onClose: () => void; onSaved: () => void;
}) {
    const [name, setName] = useState(type.name);
    const [price, setPrice] = useState(type.price_per_night != null ? String(type.price_per_night) : '');
    const [visible, setVisible] = useState(type.is_active !== false);
    const [images, setImages] = useState<string[]>(type.images || []);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const save = async () => {
        const p = Number(price);
        if (!name.trim() || name.trim().length < 2) { setError('Give the room type a name'); return; }
        if (!p || p <= 0) { setError('Enter the price per night'); return; }
        setBusy(true); setError(null);
        try {
            const res = await fetch('/api/crm/room-types', {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomTypeId: type.id, name: name.trim(), pricePerNight: p, isActive: visible, images }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Could not save');
            onSaved();
        } catch (e: any) {
            setError(e?.message || 'Could not save');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Sheet title={type.name} subtitle={`${propertyName ? propertyName + ' · ' : ''}${unitCount} unit${unitCount === 1 ? ' uses' : 's share'} this listing`} onClose={onClose}>
            {error && <p className="text-[13px] text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

            <button type="button" onClick={() => setVisible(v => !v)}
                className={`w-full rounded-2xl border px-4 py-3.5 flex items-center gap-3 text-left transition-colors ${visible ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                {visible ? <Globe size={20} className="text-green-600 shrink-0" /> : <EyeOff size={20} className="text-gray-400 shrink-0" />}
                <span className="flex-1">
                    <span className="block font-semibold text-[15px] text-gray-900">{visible ? 'Showing on the website' : 'Hidden from the website'}</span>
                    <span className="block text-[12.5px] text-gray-500">{visible ? 'Guests can find and book it online.' : 'Only you can book it, from this app.'}</span>
                </span>
                <span className={`w-12 h-7 rounded-full p-1 transition-colors ${visible ? 'bg-green-500' : 'bg-gray-300'}`}>
                    <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${visible ? 'translate-x-5' : ''}`} />
                </span>
            </button>

            <Field label="Name on the website">
                <input className={inputCls} value={name} onChange={e => setName(e.target.value)} />
            </Field>
            <Field label="Price per night (₦)" hint={`Applies to all ${unitCount} unit${unitCount === 1 ? '' : 's'}. Currently ${naira(type.price_per_night)}.`}>
                <input type="number" inputMode="numeric" min={0} className={inputCls} value={price} onChange={e => setPrice(e.target.value)} />
            </Field>

            <Field label="Photos" hint={images.length === 0
                ? 'No photos yet: the website shows the property’s photos instead. One set of photos covers every unit of this type.'
                : 'First photo is the cover. Drag to reorder.'}>
                {images.length === 0 && (
                    <p className="flex items-center gap-2 text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-2">
                        <ImagePlus size={16} /> Add a few photos of one unit of this type
                    </p>
                )}
                <MediaUploader existingUrls={images} onUpload={setImages} folder={`room-types/${type.id}`} />
            </Field>

            <BigButton onClick={save} busy={busy}>Save</BigButton>
        </Sheet>
    );
}
