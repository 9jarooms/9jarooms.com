'use client';

import { useCallback, useEffect, useState } from 'react';
import { Smartphone, Copy, Check, RotateCcw, UserPlus, Trash2, MessageCircle } from 'lucide-react';

interface Caretaker {
    userId: string;
    name: string;
    phone: string | null;
    whatsapp: string | null;
    lastSignIn: string | null;
    link: string;
}

function ago(iso: string | null) {
    if (!iso) return 'Never opened';
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
    if (days <= 0) return 'Opened today';
    if (days === 1) return 'Opened yesterday';
    if (days < 60) return `Opened ${days} days ago`;
    return `Opened ${new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

function message(c: Caretaker) {
    const first = c.name.split(/\s+/)[0];
    return `Hi ${first}, this is your 9jaRooms app for checking guests in and out, walk-in bookings and payments.\n\nTap this link, then add it to your home screen:\n${c.link}\n\nPlease keep it to yourself.`;
}

// Caretakers live on their phones. Add one with a name and a number, then
// send them their personal link on WhatsApp: one tap signs them in.
export default function CaretakerLinks() {
    const [rows, setRows] = useState<Caretaker[] | null>(null);
    const [form, setForm] = useState({ name: '', phone: '' });
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState<string | null>(null);
    const [phoneEdit, setPhoneEdit] = useState<Record<string, string>>({});

    const load = useCallback(async () => {
        const res = await fetch('/api/crm/caretakers', { cache: 'no-store' });
        const json = await res.json();
        if (res.ok) setRows(json.caretakers); else setError(json.error || 'Could not load caretakers');
    }, []);
    useEffect(() => { load(); }, [load]);

    const call = async (key: string, method: string, body?: unknown, query = '') => {
        setBusy(key); setError(null);
        try {
            const res = await fetch(`/api/crm/caretakers${query}`, {
                method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
            });
            const json = await res.json();
            if (!res.ok) { setError(json.error || 'Something went wrong'); return null; }
            await load();
            return json;
        } finally {
            setBusy(null);
        }
    };

    const add = async () => {
        const json = await call('add', 'POST', form);
        if (json) setForm({ name: '', phone: '' });
    };
    const copy = async (c: Caretaker) => {
        try { await navigator.clipboard.writeText(message(c)); setCopied(c.userId); setTimeout(() => setCopied(null), 2000); } catch { /* ignore */ }
    };
    const reset = (c: Caretaker) => {
        if (!confirm(`Make a new link for ${c.name}? The old link stops working. Send them the new one.`)) return;
        call(c.userId, 'PATCH', { userId: c.userId, resetLink: true });
    };
    const remove = (c: Caretaker) => {
        if (!confirm(`Remove ${c.name}'s access? Their app stops working straight away.`)) return;
        call(c.userId, 'DELETE', undefined, `?userId=${c.userId}`);
    };
    const savePhone = (c: Caretaker) => call(c.userId, 'PATCH', { userId: c.userId, phone: phoneEdit[c.userId] || '' })
        .then(ok => { if (ok) setPhoneEdit(p => { const n = { ...p }; delete n[c.userId]; return n; }); });

    return (
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)] mb-5">
            <h2 className="px-5 py-3.5 text-sm font-bold text-stone-700 border-b border-stone-200 flex items-center gap-2">
                <Smartphone size={15} /> Caretakers on their phones
            </h2>
            <div className="px-5 py-4">
                <p className="text-[13px] text-stone-500 mb-4">
                    Each caretaker gets a personal link. Send it on WhatsApp; one tap opens their Today screen, already signed in.
                    They add it to their home screen once and it works like an app. No password.
                </p>

                {error && <p className="text-xs text-[#c75146] bg-red-50 rounded-md px-3 py-2 mb-3">{error}</p>}

                {rows === null && <p className="text-sm text-stone-400 py-3">Loading…</p>}
                {rows && rows.length === 0 && <p className="text-sm text-stone-400 py-3">No caretakers yet. Add one below.</p>}

                <ul className="space-y-3 mb-5">
                    {rows?.map(c => {
                        const editing = phoneEdit[c.userId] !== undefined;
                        const wa = c.whatsapp ? `https://wa.me/${c.whatsapp}?text=${encodeURIComponent(message(c))}` : null;
                        return (
                            <li key={c.userId} className="rounded-xl border border-stone-200 p-3.5">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="font-bold text-[15px] text-stone-900 truncate">{c.name}</p>
                                        <p className={`text-[12px] ${c.lastSignIn ? 'text-stone-500' : 'text-[#c75146] font-semibold'}`}>{ago(c.lastSignIn)}</p>
                                    </div>
                                    <button type="button" onClick={() => remove(c)} disabled={busy === c.userId} aria-label="Remove access"
                                        className="p-2 -m-1 text-stone-300 hover:text-[#c75146]"><Trash2 size={15} /></button>
                                </div>

                                {(!c.phone || editing) ? (
                                    <div className="mt-2.5 flex gap-2">
                                        <input inputMode="tel" placeholder="WhatsApp number, e.g. 0803 123 4567"
                                            value={phoneEdit[c.userId] ?? c.phone ?? ''}
                                            onChange={e => setPhoneEdit(p => ({ ...p, [c.userId]: e.target.value }))}
                                            className="flex-1 min-w-0 h-11 border border-stone-300 rounded-lg px-3 text-[16px]" />
                                        <button type="button" onClick={() => savePhone(c)} disabled={busy === c.userId}
                                            className="h-11 px-4 rounded-lg bg-stone-800 text-white text-sm font-semibold disabled:opacity-50">Save</button>
                                    </div>
                                ) : (
                                    <button type="button" onClick={() => setPhoneEdit(p => ({ ...p, [c.userId]: c.phone || '' }))}
                                        className="mt-1 text-[13px] text-stone-500 underline decoration-dotted">{c.phone}</button>
                                )}

                                <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-2">
                                    {wa ? (
                                        <a href={wa} target="_blank" rel="noopener noreferrer"
                                            className="h-11 rounded-lg bg-[#25D366] active:bg-[#1ebe5d] text-white text-sm font-bold flex items-center justify-center gap-1.5">
                                            <MessageCircle size={16} /> Send on WhatsApp
                                        </a>
                                    ) : (
                                        <span className="h-11 rounded-lg bg-stone-100 text-stone-400 text-sm font-semibold flex items-center justify-center">Add a number to send</span>
                                    )}
                                    <button type="button" onClick={() => copy(c)} aria-label="Copy message"
                                        className="h-11 w-11 rounded-lg border border-stone-300 flex items-center justify-center text-stone-600">
                                        {copied === c.userId ? <Check size={16} className="text-[#008737]" /> : <Copy size={16} />}
                                    </button>
                                    <button type="button" onClick={() => reset(c)} disabled={busy === c.userId} aria-label="New link"
                                        className="h-11 w-11 rounded-lg border border-stone-300 flex items-center justify-center text-stone-600">
                                        <RotateCcw size={16} />
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>

                <h3 className="text-xs font-semibold text-stone-600 mb-2 flex items-center gap-1.5">
                    <UserPlus size={14} /> Add a caretaker
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
                    <input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                        className="h-11 border border-stone-300 rounded-lg px-3 text-[16px]" />
                    <input placeholder="WhatsApp number" inputMode="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                        className="h-11 border border-stone-300 rounded-lg px-3 text-[16px]" />
                    <button type="button" onClick={add} disabled={busy === 'add' || form.name.trim().length < 2 || form.phone.trim().length < 7}
                        className="h-11 px-5 rounded-lg bg-[#008737] text-white text-sm font-bold disabled:opacity-50">
                        {busy === 'add' ? 'Adding…' : 'Add'}
                    </button>
                </div>
            </div>
        </div>
    );
}
