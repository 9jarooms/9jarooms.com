'use client';

import { useState } from 'react';
import { X, Images } from 'lucide-react';
import MediaUploader from '@/components/MediaUploader';

// Manage photos for a property and each of its room types.
// Uploads go to the property-media bucket via the shared MediaUploader
// (compression + HEIC conversion + drag-to-reorder + thumbnail star).
export default function PhotosModal({ property, onClose, onSaved }: {
    property: any;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [propertyImages, setPropertyImages] = useState<string[]>(property.images || []);
    const [thumbnail, setThumbnail] = useState<string | null>(property.thumbnail || null);
    const [typeImages, setTypeImages] = useState<Record<string, string[]>>(
        Object.fromEntries((property.roomTypes || []).map((t: any) => [t.id, t.images || []]))
    );
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const save = async () => {
        setBusy(true); setError(null);
        try {
            const res = await fetch('/api/crm/properties', {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    propertyId: property.id,
                    images: propertyImages,
                    thumbnail: thumbnail || propertyImages[0] || null,
                }),
            });
            if (!res.ok) throw new Error((await res.json()).error);

            for (const t of property.roomTypes || []) {
                const imgs = typeImages[t.id] || [];
                const res2 = await fetch('/api/crm/room-types', {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ roomTypeId: t.id, images: imgs }),
                });
                if (!res2.ok) throw new Error((await res2.json()).error);
            }
            onSaved();
        } catch (e: any) {
            setError(e.message || 'Failed to save photos');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto py-10" onClick={onClose}>
            <div className="bg-white rounded-2xl w-[720px] max-w-[94vw] shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 pt-5 pb-3.5 border-b border-stone-200">
                    <div className="flex items-center gap-2">
                        <Images size={17} className="text-[#008737]" />
                        <h2 className="font-bold text-stone-900">Photos — {property.name}</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100"><X size={18} /></button>
                </div>

                {error && <p className="mx-6 mt-3 text-xs text-[#c75146] bg-red-50 rounded-lg px-3 py-2">{error}</p>}

                <div className="px-6 py-5 space-y-7 max-h-[65vh] overflow-y-auto">
                    <section>
                        <h3 className="text-[13px] font-bold text-stone-700 mb-1">Property gallery</h3>
                        <p className="text-[11.5px] text-stone-400 mb-2.5">Shown at the top of the listing page. Star an image to make it the cover.</p>
                        <MediaUploader
                            folder={`crm/${property.id}`}
                            existingUrls={propertyImages}
                            onUpload={setPropertyImages}
                            thumbnail={thumbnail || propertyImages[0]}
                            onThumbnailChange={setThumbnail}
                        />
                    </section>

                    {(property.roomTypes || []).map((t: any) => (
                        <section key={t.id} className="pt-5 border-t border-stone-100">
                            <h3 className="text-[13px] font-bold text-stone-700 mb-1">
                                {t.name} <span className="font-normal text-stone-400">· ₦{Number(t.price_per_night).toLocaleString()}/night · {t.unitCount} unit{t.unitCount === 1 ? '' : 's'}</span>
                            </h3>
                            <p className="text-[11.5px] text-stone-400 mb-2.5">Photos of this specific room — guests see these on its card.</p>
                            <MediaUploader
                                folder={`crm/${property.id}/${t.id}`}
                                existingUrls={typeImages[t.id] || []}
                                onUpload={(urls) => setTypeImages(prev => ({ ...prev, [t.id]: urls }))}
                            />
                        </section>
                    ))}
                </div>

                <div className="flex justify-end gap-2 px-6 py-4 border-t border-stone-200">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg border border-stone-300 text-sm font-semibold">Cancel</button>
                    <button disabled={busy} onClick={save}
                        className="px-5 py-2 rounded-lg bg-[#008737] text-white text-sm font-bold disabled:opacity-50 hover:bg-[#02572a] transition-colors">
                        {busy ? 'Saving…' : 'Save photos'}
                    </button>
                </div>
            </div>
        </div>
    );
}
