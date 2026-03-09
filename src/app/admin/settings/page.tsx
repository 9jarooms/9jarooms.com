'use client';

import { useState, useEffect } from 'react';
import MediaUploader from '@/components/MediaUploader';
import { ImagePlus, Check, Loader2, Phone, MessageCircle } from 'lucide-react';

const CATS = [
    { key: 'budget', label: 'Budget', desc: 'Shown as tile on homepage mobile', color: 'from-emerald-700 to-emerald-500' },
    { key: 'standard', label: 'Standard', desc: 'Shown as tile on homepage mobile', color: 'from-neutral-600 to-neutral-400' },
    { key: 'luxury', label: 'Luxury', desc: 'Shown as tile on homepage mobile', color: 'from-amber-700 to-amber-500' },
];

export default function AdminSettingsPage() {
    const [thumbs, setThumbs] = useState<Record<string, string>>({ budget: '', standard: '', luxury: '' });
    const [contactPhone, setContactPhone] = useState('');
    const [contactWhatsapp, setContactWhatsapp] = useState('');
    const [saving, setSaving] = useState<string | null>(null);
    const [saved, setSaved] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/admin/settings')
            .then(r => r.json())
            .then(({ data }) => {
                if (data?.category_thumbnails) {
                    setThumbs(data.category_thumbnails);
                }
                if (data?.contact_phone) {
                    setContactPhone(data.contact_phone);
                }
                if (data?.contact_whatsapp) {
                    setContactWhatsapp(data.contact_whatsapp);
                }
            })
            .finally(() => setLoading(false));
    }, []);

    async function saveThumbnail(key: string, url: string) {
        setSaving(key);
        const next = { ...thumbs, [key]: url };
        await fetch('/api/admin/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'category_thumbnails', value: next }),
        });
        setThumbs(next);
        setSaving(null);
        setSaved(key);
        setTimeout(() => setSaved(null), 2000);
    }

    async function saveContactNumber(settingKey: string, value: string) {
        setSaving(settingKey);
        await fetch('/api/admin/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: settingKey, value }),
        });
        setSaving(null);
        setSaved(settingKey);
        setTimeout(() => setSaved(null), 2000);
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 size={22} className="animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div className="mb-8">
                <h1 className="text-2xl font-semibold text-gray-900">Site Settings</h1>
                <p className="text-sm text-gray-500 mt-1">Manage site configuration, contact numbers, and thumbnails.</p>
            </div>

            {/* Contact Numbers Section */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="text-sm font-semibold text-gray-700">Platform Contact Numbers</h2>
                    <p className="text-xs text-gray-400 mt-0.5">These numbers are shown to guests on the booking page so they can reach you directly.</p>
                </div>

                <div className="px-6 py-5 space-y-4">
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                            <Phone size={14} /> Phone Number (for calls)
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="tel"
                                value={contactPhone}
                                onChange={e => setContactPhone(e.target.value)}
                                placeholder="+234 xxx xxx xxxx"
                                className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                            />
                            <button
                                onClick={() => saveContactNumber('contact_phone', contactPhone)}
                                disabled={saving === 'contact_phone'}
                                className="px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
                            >
                                {saving === 'contact_phone' ? <Loader2 size={14} className="animate-spin" /> : saved === 'contact_phone' ? <Check size={14} /> : 'Save'}
                            </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Guests can call this number to book directly.</p>
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                            <MessageCircle size={14} /> WhatsApp Number
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="tel"
                                value={contactWhatsapp}
                                onChange={e => setContactWhatsapp(e.target.value)}
                                placeholder="+234 xxx xxx xxxx"
                                className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                            />
                            <button
                                onClick={() => saveContactNumber('contact_whatsapp', contactWhatsapp)}
                                disabled={saving === 'contact_whatsapp'}
                                className="px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
                            >
                                {saving === 'contact_whatsapp' ? <Loader2 size={14} className="animate-spin" /> : saved === 'contact_whatsapp' ? <Check size={14} /> : 'Save'}
                            </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Guests can message this number on WhatsApp.</p>
                    </div>
                </div>
            </div>

            {/* Category Thumbnails Section */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="text-sm font-semibold text-gray-700">Category Thumbnails</h2>
                    <p className="text-xs text-gray-400 mt-0.5">These images appear as the category tiles on mobile homepage.</p>
                </div>

                <div className="divide-y divide-gray-50">
                    {CATS.map((cat) => {
                        const current = thumbs[cat.key];
                        return (
                            <div key={cat.key} className="px-6 py-5">
                                <div className="flex items-start gap-4">
                                    {/* Preview */}
                                    <div className="shrink-0 w-20 h-20 rounded-xl overflow-hidden relative">
                                        {current ? (
                                            <img src={current} alt={cat.label} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className={`w-full h-full bg-gradient-to-br ${cat.color} flex items-center justify-center`}>
                                                <ImagePlus size={18} className="text-white/70" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Info + uploader */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-sm font-semibold text-gray-900">{cat.label}</span>
                                            {saved === cat.key && (
                                                <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                                                    <Check size={11} /> Saved
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-400 mb-3">{cat.desc}</p>

                                        <MediaUploader
                                            single
                                            bucket="property-media"
                                            folder="category-thumbs"
                                            existingUrls={current ? [current] : []}
                                            onUpload={(urls) => {
                                                if (urls[0]) saveThumbnail(cat.key, urls[0]);
                                            }}
                                        />

                                        {saving === cat.key && (
                                            <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-2">
                                                <Loader2 size={11} className="animate-spin" /> Saving...
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
