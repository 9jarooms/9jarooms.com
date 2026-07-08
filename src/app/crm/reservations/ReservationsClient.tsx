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

export default function ReservationsClient() {
    const [q, setQ] = useState('');
    const [status, setStatus] = useState('');
    const [rows, setRows] = useState<any[]>([]);
    const [open, setOpen] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (status) params.set('status', status);
        const res = await fetch(`/api/crm/bookings?${params}`);
        if (res.ok) setRows((await res.json()).bookings);
        setLoading(false);
    }, [q, status]);

    useEffect(() => {
        const t = setTimeout(load, q ? 300 : 0);
        return () => clearTimeout(t);
    }, [load, q]);

    return (
        <div className="p-6">
            <div className="flex flex-wrap items-center gap-3 mb-4">
                <h1 className="text-[26px] font-extrabold tracking-tight text-stone-900 mr-2">Reservations</h1>
                <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-2.5 text-stone-400" />
                    <input
                        placeholder="Search guest, phone, email…"
                        value={q} onChange={e => setQ(e.target.value)}
                        className="pl-8 pr-3 py-1.5 border border-stone-300 rounded-md text-sm bg-white w-64"
                    />
                </div>
                <select value={status} onChange={e => setStatus(e.target.value)}
                    className="border border-stone-300 rounded-md px-2 py-1.5 text-sm bg-white">
                    {STATUS_FILTERS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
            </div>

            <div className="bg-white rounded-2xl border border-stone-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-x-auto">
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
                                    <td className="px-4 py-2.5 text-stone-600 whitespace-nowrap">{b.check_in} → {b.check_out}</td>
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
