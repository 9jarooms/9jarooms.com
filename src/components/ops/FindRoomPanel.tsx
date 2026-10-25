'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, Share2, Lock, Copy, Check, MapPin } from 'lucide-react';
import { Field, Stepper, inputCls, naira, fmtDay, shiftIso, isoToday, cacheGet, fetchCached, type OpsToday } from './shared';
import type { NewBookingPreset } from './NewBookingSheet';

interface FreeUnit { id: string; label: string; perNight: number | null; total: number | null }
interface FreeGroup {
    key: string; propertyId: string; propertyName: string; area: string | null;
    label: string; perNight: number | null; total: number | null;
    units: FreeUnit[]; unitCount: number; link: string; hidden?: boolean;
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
        setError(null);
        const p = new URLSearchParams({ from: checkIn, to: checkOut });
        if (data.propertyId && data.propertyId !== 'all') p.set('propertyId', data.propertyId);
        const url = `/api/ops/availability?${p}`;
        const cached = cacheGet<{ groups: FreeGroup[] }>(url);
        if (cached) setGroups(cached.groups || []); else setLoading(true);
        try {
            const json = await fetchCached<{ groups: FreeGroup[] }>(url);
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
        const t = setTimeout(search, 120);
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
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Check-in">
                        <input type="date" className={inputCls} value={checkIn} min={data.today}
                            onChange={e => { if (e.target.value) setCheckIn(e.target.value); }} />
                    </Field>
                    <Field label="Nights">
                        <Stepper value={nights} onChange={setNights} />
                    </Field>
                </div>
                <p className="text-[13px] text-gray-600">
                    Check-out <b>{fmtDay(checkOut)}</b>
                    {loading && !groups && <span className="text-gray-400"> · checking…</span>}
                </p>
            </div>

            {free.length > 1 && (
                <div className="rounded-2xl bg-gradient-to-br from-green-600 to-green-700 p-5 text-white shadow-md flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-green-200">Send to the guest</p>
                        <p className="font-semibold text-lg leading-snug mt-1">{free.length} options free for {stayLabel}</p>
                        <p className="text-white/70 text-sm mt-1">One message with every option and its booking link. Nothing is held until they pay.</p>
                    </div>
                    <button type="button" onClick={() => share(messageForAll(free), 'all')}
                        className="shrink-0 flex items-center justify-center gap-2 px-4 py-3 bg-white text-green-700 hover:bg-green-50 rounded-xl text-sm font-semibold transition-all shadow-sm">
                        <Share2 size={16} /> Share all on WhatsApp
                    </button>
                </div>
            )}

            {error && <p className="text-[13px] text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

            {groups && free.length === 0 && !loading && (
                <p className="text-sm text-gray-500 bg-white border border-dashed border-gray-200 rounded-2xl px-4 py-6 text-center">
                    Nothing is free for {stayLabel}. Try other dates.
                </p>
            )}

            {free.map(g => (
                <div key={g.key} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <span className="inline-block bg-green-50 text-green-700 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                                {g.units.length} of {g.unitCount} free
                            </span>
                            {g.hidden && <span className="ml-1.5 inline-block bg-amber-50 text-amber-700 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">Not on website</span>}
                            <h3 className="mt-2 text-base font-semibold text-gray-900 leading-snug truncate">{g.label}</h3>
                            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1 truncate">
                                <MapPin size={11} /> {g.propertyName}{g.area ? `, ${g.area}` : ''}
                            </p>
                        </div>
                        <div className="text-right shrink-0">
                            {g.total != null ? (
                                <>
                                    <p className="text-sm font-semibold text-gray-900 tabular-nums">{naira(g.perNight)}<span className="font-normal text-gray-400 text-xs ml-1">/ night</span></p>
                                    <p className="text-xs text-gray-500 tabular-nums mt-0.5">{naira(g.total)} for {nights} night{nights === 1 ? '' : 's'}</p>
                                </>
                            ) : (
                                <p className="text-xs text-gray-400">Agree a price</p>
                            )}
                        </div>
                    </div>
                    <p className="mt-3 text-xs text-gray-400 truncate">Free units: {g.units.map(u => u.label).join(', ')}</p>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => share(messageFor(g), g.key)}
                            className="h-11 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors shadow-sm btn-press">
                            <Share2 size={16} /> Share option
                        </button>
                        <button type="button"
                            onClick={() => onHold({ unitId: g.units[0].id, date: checkIn, nights, mode: 'hold' })}
                            className="h-11 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors shadow-sm btn-press">
                            <Lock size={16} /> Hold a unit
                        </button>
                    </div>
                    <button type="button" onClick={() => copy(g.link, g.key)}
                        className="mt-2 h-9 w-full rounded-full border border-gray-200 bg-white text-gray-600 text-xs font-medium flex items-center justify-center gap-1.5 hover:border-gray-900 transition-colors">
                        {copied === g.key ? <><Check size={14} /> Link copied</> : <><Copy size={14} /> Copy booking link</>}
                    </button>
                </div>
            ))}

            {full.length > 0 && (
                <div className="text-xs text-gray-400 px-1">
                    Fully booked: {full.map(g => `${g.propertyName} ${g.label}`).join(' · ')}
                </div>
            )}
            {!groups && !error && <p className="text-center text-gray-400 py-6 flex items-center justify-center gap-2"><Search size={15} /> Checking…</p>}
        </div>
    );
}
