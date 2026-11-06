'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarPlus, Lock, Banknote, Undo2, LogIn, LogOut, XCircle, Pencil, Clock, Globe } from 'lucide-react';
import { useLiveUpdates } from '@/components/ops/shared';
import BookingModal from '../components/BookingModal';

interface Ev { id: string; at: string; kind: string; who: string; text: string; detail?: string; amount?: number; bookingId?: string }
interface Data { days: number; events: Ev[]; today: { bookings: number; money: number; checkins: number; checkouts: number } }

const KIND: Record<string, { icon: typeof Clock; cls: string }> = {
    booking: { icon: CalendarPlus, cls: 'bg-[#7ed957]/20 text-[#02572a]' },
    online: { icon: Globe, cls: 'bg-[#7ed957]/20 text-[#02572a]' },
    lock: { icon: Lock, cls: 'bg-purple-100 text-purple-700' },
    hold: { icon: Globe, cls: 'bg-purple-100 text-purple-700' },
    payment: { icon: Banknote, cls: 'bg-emerald-100 text-emerald-700' },
    refund: { icon: Undo2, cls: 'bg-amber-100 text-amber-800' },
    checkin: { icon: LogIn, cls: 'bg-sky-100 text-sky-700' },
    checkout: { icon: LogOut, cls: 'bg-stone-200 text-stone-700' },
    cancel: { icon: XCircle, cls: 'bg-red-100 text-red-700' },
    change: { icon: Pencil, cls: 'bg-orange-100 text-orange-700' },
    lapsed: { icon: Clock, cls: 'bg-stone-100 text-stone-500' },
};
const FILTERS = [
    { key: 'all', label: 'Everything', kinds: [] as string[] },
    { key: 'bookings', label: 'Bookings', kinds: ['booking', 'online', 'lock', 'hold', 'lapsed', 'cancel'] },
    { key: 'money', label: 'Money', kinds: ['payment', 'refund'] },
    { key: 'guests', label: 'Check-ins & outs', kinds: ['checkin', 'checkout'] },
    { key: 'changes', label: 'Changes', kinds: ['change', 'cancel'] },
];
const naira = (n?: number) => `₦${Math.round(Number(n || 0)).toLocaleString('en-NG')}`;
const time = (at: string) => new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' });
const dayLabel = (at: string) => {
    const d = new Date(at).toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
    const yest = new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
    if (d === today) return 'Today';
    if (d === yest) return 'Yesterday';
    return new Date(at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' });
};

// What is happening across every property, as it happens (updates live, no refresh).
export default function ActivityFeed() {
    const [days, setDays] = useState(3);
    const [data, setData] = useState<Data | null>(null);
    const [filter, setFilter] = useState('all');
    const [open, setOpen] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        const res = await fetch(`/api/crm/activity?days=${days}`, { cache: 'no-store' }).catch(() => null);
        if (!res) { setError('No connection: showing the last loaded activity.'); return; }
        const json = await res.json();
        if (!res.ok) { setError(json.error || 'Could not load'); return; }
        setError(null); setData(json);
    }, [days]);
    useEffect(() => { load(); }, [load]);
    useLiveUpdates(load);

    const kinds = FILTERS.find(f => f.key === filter)!.kinds;
    const events = (data?.events || []).filter(e => !kinds.length || kinds.includes(e.kind));
    let lastDay = '';

    return (
        <div className="max-w-3xl space-y-4">
            <div>
                <h1 className="text-[22px] sm:text-[26px] font-extrabold tracking-tight text-stone-900">Activity</h1>
                <p className="text-[13px] text-stone-500">Everything happening across the properties, as it happens. Updates by itself.</p>
            </div>

            {data && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Box label="Bookings today" value={String(data.today.bookings)} />
                    <Box label="Money in today" value={naira(data.today.money)} />
                    <Box label="Check-ins today" value={String(data.today.checkins)} />
                    <Box label="Check-outs today" value={String(data.today.checkouts)} />
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
                {FILTERS.map(f => (
                    <button key={f.key} onClick={() => setFilter(f.key)}
                        className={`px-3 py-1.5 rounded-full text-[13px] font-semibold border ${filter === f.key ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-600 border-stone-200'}`}>
                        {f.label}
                    </button>
                ))}
                <select value={days} onChange={e => { setData(null); setDays(Number(e.target.value)); }}
                    className="ml-auto text-[13px] border border-stone-200 rounded-md px-2 py-1.5 bg-white">
                    <option value={1}>Last 24 hours</option>
                    <option value={3}>Last 3 days</option>
                    <option value={7}>Last 7 days</option>
                    <option value={31}>Last 31 days</option>
                </select>
            </div>

            {error && <p className="text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{error}</p>}
            {!data && !error && <p className="text-stone-400 text-sm py-6 text-center">Loading…</p>}
            {data && events.length === 0 && <p className="text-stone-500 text-sm py-8 text-center bg-white rounded-2xl border border-stone-200">Nothing yet for this period.</p>}

            <div className="bg-white rounded-2xl border border-stone-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
                {events.map(e => {
                    const day = dayLabel(e.at);
                    const header = day !== lastDay ? (lastDay = day) : null;
                    const k = KIND[e.kind] || KIND.change, Icon = k.icon;
                    return (
                        <div key={e.id}>
                            {header && <p className="px-4 sm:px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-stone-400 bg-stone-50 border-b border-stone-100">{header}</p>}
                            <button type="button" disabled={!e.bookingId} onClick={() => e.bookingId && setOpen(e.bookingId)}
                                className="w-full text-left px-4 sm:px-5 py-3 flex items-start gap-3 border-b border-stone-100 hover:bg-stone-50 disabled:hover:bg-white">
                                <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${k.cls}`}><Icon size={15} /></span>
                                <span className="flex-1 min-w-0">
                                    <span className="block text-[14px] text-stone-800">{e.who && <b>{e.who} </b>}{e.text}</span>
                                    {e.detail && <span className="block text-[12.5px] text-stone-500 mt-0.5 truncate">{e.detail}</span>}
                                </span>
                                <span className="shrink-0 text-right">
                                    {e.amount != null && e.amount > 0 && <span className={`block text-[13.5px] font-bold tabular-nums ${e.kind === 'refund' ? 'text-amber-700' : 'text-stone-900'}`}>{e.kind === 'refund' ? '−' : ''}{naira(e.amount)}</span>}
                                    <span className="block text-[12px] text-stone-400 tabular-nums">{time(e.at)}</span>
                                </span>
                            </button>
                        </div>
                    );
                })}
            </div>

            {open && <BookingModal bookingId={open} onClose={() => setOpen(null)} onChanged={load} />}
        </div>
    );
}

function Box({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-white rounded-2xl border border-stone-200/80 px-4 py-3">
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-stone-400">{label}</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-stone-900">{value}</p>
        </div>
    );
}
