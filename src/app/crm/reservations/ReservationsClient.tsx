'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import BookingModal, { naira } from '../components/BookingModal';

const STATUS_FILTERS = [
    { value: '', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'paid', label: 'Paid' },
    { value: 'checked_in', label: 'Checked in' },
    { value: 'completed', label: 'Checked out' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'no_show', label: 'No show' },
];

const STATUS_STYLE: Record<string, string> = {
    pending: 'bg-purple-100 text-purple-700',
    confirmed: 'bg-amber-100 text-amber-700',
    paid: 'bg-green-100 text-green-800',
    checked_in: 'bg-emerald-100 text-emerald-900',
    completed: 'bg-stone-200 text-stone-600',
    cancelled: 'bg-red-100 text-red-700',
    no_show: 'bg-stone-100 text-stone-500',
};

// local-date helpers (WAT-safe)
function iso(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

// Operational quick-views: who's arriving / leaving, today or in the next 3 days.
type ViewKey = '' | 'arr_today' | 'dep_today' | 'arr_3d' | 'dep_3d';
function viewParams(view: ViewKey): Record<string, string> {
    const today = iso(new Date());
    const in3 = iso(addDays(new Date(), 3));
    switch (view) {
        case 'arr_today': return { from: today, to: today, sort: 'check_in', activeOnly: '1' };
        case 'dep_today': return { outFrom: today, outTo: today, sort: 'check_out', activeOnly: '1' };
        case 'arr_3d': return { from: today, to: in3, sort: 'check_in', activeOnly: '1' };
        case 'dep_3d': return { outFrom: today, outTo: in3, sort: 'check_out', activeOnly: '1' };
        default: return {};
    }
}
const VIEW_CHIPS: { key: ViewKey; label: string }[] = [
    { key: '', label: 'All' },
    { key: 'arr_today', label: 'Checking in today' },
    { key: 'dep_today', label: 'Checking out today' },
    { key: 'arr_3d', label: 'Arrivals · next 3 days' },
    { key: 'dep_3d', label: 'Departures · next 3 days' },
];

export default function ReservationsClient() {
    const [q, setQ] = useState('');
    const [status, setStatus] = useState('');
    const [view, setView] = useState<ViewKey>('');
    const [rows, setRows] = useState<any[]>([]);
    const [open, setOpen] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const isDeparture = view === 'dep_today' || view === 'dep_3d';

    const load = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (status) params.set('status', status);
        for (const [k, v] of Object.entries(viewParams(view))) params.set(k, v);
        const res = await fetch(`/api/crm/bookings?${params}`);
        if (res.ok) setRows((await res.json()).bookings);
        setLoading(false);
    }, [q, status, view]);

    useEffect(() => {
        const t = setTimeout(load, q ? 300 : 0);
        return () => clearTimeout(t);
    }, [load, q]);

    return (
        <div className="p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-2.5 mb-4">
                <h1 className="text-[22px] sm:text-[26px] font-extrabold tracking-tight text-stone-900 w-full sm:w-auto sm:mr-2">Reservations</h1>
                <div className="relative flex-1 sm:flex-none">
                    <Search size={14} className="absolute left-2.5 top-2.5 text-stone-400" />
                    <input
                        placeholder="Search guest, phone, email…"
                        value={q} onChange={e => setQ(e.target.value)}
                        className="w-full sm:w-64 pl-8 pr-3 py-2 border border-stone-300 rounded-lg text-sm bg-white"
                    />
                </div>
                <select value={status} onChange={e => setStatus(e.target.value)}
                    className="border border-stone-300 rounded-lg px-2 py-2 text-sm bg-white">
                    {STATUS_FILTERS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
            </div>

            {/* Quick views: who's arriving / leaving */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
                {VIEW_CHIPS.map(c => (
                    <button key={c.key} onClick={() => setView(c.key)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${view === c.key ? 'bg-[#008737] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
                        {c.label}
                    </button>
                ))}
                {view !== '' && !loading && (
                    <span className="text-xs text-stone-500 pl-1">
                        {rows.length} {isDeparture ? 'checking out' : 'checking in'}
                    </span>
                )}
            </div>

            {/* Mobile: tappable cards */}
            <div className="md:hidden space-y-2.5">
                {rows.map(b => {
                    const balance = Number(b.total_amount) - b.paid;
                    const owing = balance > 0 && !['cancelled', 'no_show'].includes(b.status);
                    return (
                        <button key={b.id} onClick={() => setOpen(b.id)}
                            className="w-full text-left bg-white rounded-xl border border-stone-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-3.5 active:bg-stone-50">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="font-semibold text-stone-900 truncate">{b.guest_name}</p>
                                    <p className="text-[12px] text-stone-400 truncate">{b.property?.name} · {b.room?.unit_code || b.room?.name}</p>
                                </div>
                                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10.5px] font-bold ${STATUS_STYLE[b.status] || 'bg-stone-100 text-stone-600'}`}>
                                    {b.status.replace('_', ' ')}
                                </span>
                            </div>
                            <div className="flex items-center justify-between mt-2 text-[13px]">
                                <span className="text-stone-500">{b.check_in} → {b.check_out}</span>
                                <span className="font-semibold text-stone-800">{naira(b.total_amount)}</span>
                            </div>
                            {owing && <p className="mt-1.5 text-[12px] font-bold text-[#c75146]">{naira(balance)} owing</p>}
                        </button>
                    );
                })}
                {!loading && rows.length === 0 && (
                    <p className="text-center text-stone-400 py-10">No reservations found.</p>
                )}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block bg-white rounded-2xl border border-stone-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs text-stone-500 border-b border-stone-200">
                            <th className="px-4 py-2.5 font-semibold">Guest</th>
                            <th className="px-4 py-2.5 font-semibold">Property / Unit</th>
                            <th className="px-4 py-2.5 font-semibold">Dates</th>
                            <th className="px-4 py-2.5 font-semibold text-right">Total</th>
                            <th className="px-4 py-2.5 font-semibold text-right">Balance</th>
                            <th className="px-4 py-2.5 font-semibold">Source</th>
                            <th className="px-4 py-2.5 font-semibold">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                        {rows.map(b => {
                            const balance = Number(b.total_amount) - b.paid;
                            return (
                                <tr key={b.id} onClick={() => setOpen(b.id)} className="cursor-pointer hover:bg-stone-50">
                                    <td className="px-4 py-2.5">
                                        <p className="font-medium text-stone-800">{b.guest_name}</p>
                                        <p className="text-xs text-stone-400">{b.guest_phone || b.guest_email || ''}</p>
                                    </td>
                                    <td className="px-4 py-2.5 text-stone-600">
                                        {b.property?.name}
                                        <span className="text-stone-400"> · {b.room?.unit_code || b.room?.name}{b.room_type ? ` (${b.room_type.name})` : ''}</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-stone-600 whitespace-nowrap">
                                        <span className={!isDeparture && view !== '' ? 'font-bold text-stone-900' : ''}>{b.check_in}</span>
                                        {' → '}
                                        <span className={isDeparture ? 'font-bold text-stone-900' : ''}>{b.check_out}</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-medium">{naira(b.total_amount)}</td>
                                    <td className={`px-4 py-2.5 text-right font-medium ${balance > 0 && !['cancelled', 'no_show'].includes(b.status) ? 'text-[#c75146]' : 'text-stone-400'}`}>
                                        {['cancelled', 'no_show'].includes(b.status) ? '—' : naira(Math.max(balance, 0))}
                                    </td>
                                    <td className="px-4 py-2.5 text-stone-500 capitalize">{(b.booking_source || '').replace('_', ' ')}</td>
                                    <td className="px-4 py-2.5">
                                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${STATUS_STYLE[b.status] || 'bg-stone-100 text-stone-600'}`}>
                                            {b.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                        {!loading && rows.length === 0 && (
                            <tr><td colSpan={7} className="px-4 py-10 text-center text-stone-400">No reservations found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {open && <BookingModal bookingId={open} onClose={() => setOpen(null)} onChanged={load} />}
        </div>
    );
}
