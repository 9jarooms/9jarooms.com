'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, Share2, Lock, Copy, Check } from 'lucide-react';
import { Field, Stepper, inputCls, naira, fmtDay, shiftIso, isoToday, type OpsToday } from './shared';
import type { NewBookingPreset } from './NewBookingSheet';

interface FreeUnit { id: string; label: string; perNight: number | null; total: number | null }
interface FreeGroup {
    key: string; propertyId: string; propertyName: string; area: string | null;
    label: string; perNight: number | null; total: number | null;
    units: FreeUnit[]; unitCount: number; link: string;
}

// The caretaker's answer to "do you have a room from X to Y?": type the
// dates, see what is free, share the options to the guest's WhatsApp, or
// hold a unit while the guest pays. Nothing is promised in chat; the app
// is where the room gets claimed.
export default function FindRoomPanel({ data, onHold }: {
    data: OpsToday;
    onHold: (preset: NewBookingPreset) => void;
}) {
    const [checkIn, setCheckIn] = useState(data.today || isoToday());
    const [nights, setNights] = useState(1);
    const [groups, setGroups] = useState<FreeGroup[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState<string | null>(null);
    const checkOut = shiftIso(checkIn, Math.max(nights, 1));

    const search = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const p = new URLSearchParams({ from: checkIn, to: checkOut });
            if (data.propertyId && data.propertyId !== 'all') p.set('propertyId', data.propertyId);
            const res = await fetch(`/api/ops/availability?${p}`, { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Could not check availability');
            setGroups(json.groups || []);
        } catch (e: any) {
            setError(e?.message || 'Could not check availability');
        } finally {
            setLoading(false);
        }
    }, [checkIn, checkOut, data.propertyId]);

    // search as soon as the dates change (small debounce for the stepper),
    // and again whenever the screen behind reloads (a hold was just placed)
    useEffect(() => {
        const t = setTimeout(search, 250);
        return () => clearTimeout(t);
    }, [search, data]);

    const stayLabel = `${fmtDay(checkIn)} to ${fmtDay(checkOut)} (${nights} night${nights === 1 ? '' : 's'})`;

    const messageFor = (g: FreeGroup) =>
        `${g.propertyName}${g.area ? `, ${g.area}` : ''} - ${g.label}\n` +
        `${stayLabel}\n` +
        (g.total != null ? `${naira(g.perNight)}/night, ${naira(g.total)} total\n` : '') +
        `${g.units.length} unit${g.units.length === 1 ? '' : 's'} free\n` +
        `Book and pay here: ${g.link}`;

    const messageForAll = (list: FreeGroup[]) =>
        `9jaRooms - available ${stayLabel}:\n\n` +
        list.map(g =>
            `${g.propertyName}${g.area ? `, ${g.area}` : ''} - ${g.label}` +
            (g.total != null ? `: ${naira(g.perNight)}/night, ${naira(g.total)} total` : '') +
            `\n${g.link}`
        ).join('\n\n');

    // Phone: the system share sheet (pick the WhatsApp chat). Desktop: WhatsApp's own picker.
    const share = async (text: string, id: string) => {
        if (typeof navigator !== 'undefined' && navigator.share) {
            try { await navigator.share({ text }); return; } catch { /* cancelled or unsupported */ }
        }
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
        void id;
    };
    const copy = async (text: string, id: string) => {
        try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(null), 1500); } catch { /* ignore */ }
    };

    const free = (groups || []).filter(g => g.units.length > 0);
    const full = (groups || []).filter(g => g.units.length === 0);

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-stone-200/80 p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Check-in">
                        <input type="date" className={inputCls} value={checkIn} min={data.today}
                            onChange={e => { if (e.target.value) setCheckIn(e.target.value); }} />
                    </Field>
                    <Field label="Nights">
                        <Stepper value={nights} onChange={setNights} />
                    </Field>
                </div>
                <p className="text-[13px] text-stone-600">
                    Check-out <b>{fmtDay(checkOut)}</b>
                    {loading && <span className="text-stone-400"> · checking…</span>}
                </p>
                {free.length > 1 && (
                    <button type="button" onClick={() => share(messageForAll(free), 'all')}
                        className="h-11 w-full rounded-xl bg-[#25D366] text-white font-bold text-[14px] flex items-center justify-center gap-2">
                        <Share2 size={17} /> Share all {free.length} options on WhatsApp
                    </button>
                )}
            </div>

            {error && <p className="text-[13px] text-[#c75146] bg-red-50 rounded-xl px-3 py-2">{error}</p>}

            {groups && free.length === 0 && !loading && (
                <p className="text-[13px] text-stone-500 bg-white/60 border border-dashed border-stone-200 rounded-2xl px-4 py-5 text-center">
                    Nothing is free for {stayLabel}. Try other dates.
                </p>
            )}

            {free.map(g => (
                <div key={g.key} className="bg-white rounded-2xl border border-stone-200/80 p-4">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <p className="font-extrabold text-[15px] text-stone-900 truncate">{g.label}</p>
                            <p className="text-[12.5px] text-stone-500 truncate">{g.propertyName}{g.area ? ` · ${g.area}` : ''}</p>
                        </div>
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-800">
                            {g.units.length} of {g.unitCount} free
                        </span>
                    </div>
                    <p className="mt-2 text-[14px]">
                        {g.total != null
                            ? <><b>{naira(g.perNight)}</b>/night · <b>{naira(g.total)}</b> for the stay</>
                            : <span className="text-stone-400">No standard price · agree one with the guest</span>}
                    </p>
                    <p className="mt-1 text-[12px] text-stone-400 truncate">Free: {g.units.map(u => u.label).join(', ')}</p>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => share(messageFor(g), g.key)}
                            className="h-11 rounded-xl bg-[#25D366] text-white font-bold text-[13px] flex items-center justify-center gap-1.5">
                            <Share2 size={16} /> Share option
                        </button>
                        <button type="button"
                            onClick={() => onHold({ unitId: g.units[0].id, date: checkIn, nights, mode: 'hold' })}
                            className="h-11 rounded-xl bg-[#008737] text-white font-bold text-[13px] flex items-center justify-center gap-1.5">
                            <Lock size={16} /> Hold a unit
                        </button>
                    </div>
                    <button type="button" onClick={() => copy(g.link, g.key)}
                        className="mt-2 h-9 w-full rounded-xl border border-stone-200 text-stone-600 text-[12.5px] font-semibold flex items-center justify-center gap-1.5">
                        {copied === g.key ? <><Check size={14} /> Link copied</> : <><Copy size={14} /> Copy booking link</>}
                    </button>
                </div>
            ))}

            {full.length > 0 && (
                <div className="text-[12.5px] text-stone-400 px-1">
                    Fully booked: {full.map(g => `${g.propertyName} ${g.label}`).join(' · ')}
                </div>
            )}
            {!groups && !error && <p className="text-center text-stone-400 py-6 flex items-center justify-center gap-2"><Search size={15} /> Checking…</p>}
        </div>
    );
}
