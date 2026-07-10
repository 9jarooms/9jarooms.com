'use client';

import { useEffect, useState } from 'react';
import { X, MessageCircle, Trash2 } from 'lucide-react';

export function naira(n: number) {
    return '₦' + Number(n || 0).toLocaleString('en-NG');
}

export function waLink(phone: string | null | undefined, text: string) {
    if (!phone) return null;
    let digits = phone.replace(/[^0-9]/g, '');
    if (digits.startsWith('0')) digits = '234' + digits.slice(1);
    if (!digits.startsWith('234') && digits.length === 10) digits = '234' + digits;
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

const STATUS_LABELS: Record<string, string> = {
    pending: 'Pending payment',
    confirmed: 'Confirmed',
    paid: 'Paid',
    checked_in: 'Checked in',
    completed: 'Checked out',
    cancelled: 'Cancelled',
    no_show: 'No show',
};

const SOURCES = ['website', 'whatsapp', 'phone', 'walk_in', 'referral', 'booking_com', 'airbnb', 'other'];
const PAY_METHODS = ['Bank Transfer', 'POS', 'Moniepoint', 'Cash', 'Paystack', 'Other'];
const ID_TYPES = ['NIN', 'National ID', "Driver's Licence", 'Passport', 'Voter Card', 'Other'];

interface Props {
    bookingId: string;
    onClose: () => void;
    onChanged: () => void;
}

export default function BookingModal({ bookingId, onClose, onChanged }: Props) {
    const [tab, setTab] = useState<'booking' | 'payments'>('booking');
    const [data, setData] = useState<any>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState<any>({});
    const [payAmount, setPayAmount] = useState('');
    const [payMethod, setPayMethod] = useState(PAY_METHODS[0]);

    const load = async () => {
        const res = await fetch(`/api/crm/bookings/${bookingId}`);
        const json = await res.json();
        if (res.ok) {
            setData(json);
            const b = json.booking;
            setForm({
                guestName: b.guest_name || '',
                guestPhone: b.guest_phone || '',
                guestEmail: b.guest_email || '',
                guestIdType: b.guest_id_type || '',
                guestIdNumber: b.guest_id_number || '',
                adults: b.adults ?? 1,
                children: b.children ?? 0,
                notes: b.notes || '',
                bookingSource: b.booking_source || 'website',
                totalAmount: Number(b.total_amount),
            });
        } else setError(json.error);
    };

    useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [bookingId]);

    const patch = async (payload: any) => {
        setBusy(true); setError(null);
        const res = await fetch(`/api/crm/bookings/${bookingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const json = await res.json();
        setBusy(false);
        if (!res.ok) { setError(json.error); return false; }
        await load();
        onChanged();
        return true;
    };

    const saveDetails = () => patch({
        guestName: form.guestName,
        guestPhone: form.guestPhone || null,
        guestEmail: form.guestEmail || null,
        guestIdType: form.guestIdType || null,
        guestIdNumber: form.guestIdNumber || null,
        adults: Number(form.adults) || 0,
        children: Number(form.children) || 0,
        notes: form.notes || null,
        bookingSource: form.bookingSource,
        totalAmount: Number(form.totalAmount) || 0,
    });

    const addPayment = async () => {
        const amount = Number(payAmount);
        if (!amount || amount <= 0) return;
        setBusy(true);
        const res = await fetch(`/api/crm/bookings/${bookingId}/payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, method: payMethod }),
        });
        setBusy(false);
        if (res.ok) { setPayAmount(''); await load(); onChanged(); }
        else setError((await res.json()).error);
    };

    const deletePayment = async (paymentId: string) => {
        setBusy(true);
        await fetch(`/api/crm/bookings/${bookingId}/payments?paymentId=${paymentId}`, { method: 'DELETE' });
        setBusy(false);
        await load(); onChanged();
    };

    if (!data) {
        return (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={onClose}>
                <div className="bg-white rounded-xl p-8 text-sm text-stone-500">{error || 'Loading booking…'}</div>
            </div>
        );
    }

    const b = data.booking;
    const paid = data.paid;
    const balance = Number(b.total_amount) - paid;
    const wa = waLink(b.guest_phone,
        `Hello ${b.guest_name}, this is 9jaRooms about your booking (${b.check_in} to ${b.check_out}).` +
        (balance > 0 ? ` Outstanding balance: ${naira(balance)}.` : '')
    );

    const statusBtn = (status: string, label: string, cls: string) => (
        <button
            key={status}
            disabled={busy || b.status === status}
            onClick={() => patch({ status })}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-opacity disabled:opacity-40 ${cls}`}
        >
            {label}
        </button>
    );

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto py-10" onClick={onClose}>
            <div className="bg-white rounded-xl w-[680px] max-w-[94vw] shadow-2xl" onClick={e => e.stopPropagation()}>
                {/* header */}
                <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-stone-200">
                    <div>
                        <h2 className="font-bold text-lg text-stone-900">{b.guest_name}</h2>
                        <p className="text-xs text-stone-500 mt-0.5">
                            {b.property?.name} · Unit {b.room?.unit_code || b.room?.name} · {b.check_in} → {b.check_out} · {b.nights} night{b.nights === 1 ? '' : 's'}
                        </p>
                        <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-stone-100 text-stone-700">
                            {STATUS_LABELS[b.status] || b.status}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {wa && (
                            <a href={wa} target="_blank" rel="noopener noreferrer"
                               className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#25D366] text-white text-xs font-semibold">
                                <MessageCircle size={14} /> WhatsApp
                            </a>
                        )}
                        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-stone-100"><X size={18} /></button>
                    </div>
                </div>

                {/* money strip */}
                <div className="grid grid-cols-3 divide-x divide-stone-200 border-b border-stone-200 text-center">
                    <div className="py-3"><p className="text-[11px] uppercase tracking-wide text-stone-400">Total</p><p className="font-bold">{naira(b.total_amount)}</p></div>
                    <div className="py-3"><p className="text-[11px] uppercase tracking-wide text-stone-400">Paid</p><p className="font-bold text-[#008737]">{naira(paid)}</p></div>
                    <div className="py-3"><p className="text-[11px] uppercase tracking-wide text-stone-400">Balance</p><p className={`font-bold ${balance > 0 ? 'text-[#c75146]' : 'text-stone-500'}`}>{naira(Math.max(balance, 0))}</p></div>
                </div>

                {/* status actions */}
                <div className="flex flex-wrap gap-2 px-6 py-3 border-b border-stone-200">
                    {statusBtn('confirmed', 'Confirm', 'bg-amber-500 text-white')}
                    {statusBtn('checked_in', 'Check in', 'bg-[#008737] text-white')}
                    {statusBtn('completed', 'Check out', 'bg-[#02572a] text-white')}
                    {statusBtn('no_show', 'No show', 'bg-stone-400 text-white')}
                    {statusBtn('cancelled', 'Cancel booking', 'bg-[#c75146] text-white')}
                </div>

                {/* tabs */}
                <div className="flex border-b border-stone-200 text-sm">
                    {(['booking', 'payments'] as const).map(t => (
                        <button key={t} onClick={() => setTab(t)}
                            className={`px-6 py-2.5 font-medium capitalize border-b-2 -mb-px ${tab === t ? 'border-[#008737] text-[#008737]' : 'border-transparent text-stone-500'}`}>
                            {t}
                        </button>
                    ))}
                </div>

                {error && <p className="mx-6 mt-3 text-xs text-[#c75146] bg-red-50 rounded-md px-3 py-2">{error}</p>}

                {tab === 'booking' && (
                    <div className="px-4 sm:px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <label className="block">
                            <span className="text-xs text-stone-500">Guest name</span>
                            <input className="mt-1 w-full border border-stone-300 rounded-md px-2.5 py-1.5" value={form.guestName || ''} onChange={e => setForm({ ...form, guestName: e.target.value })} />
                        </label>
                        <label className="block">
                            <span className="text-xs text-stone-500">Phone / WhatsApp</span>
                            <input className="mt-1 w-full border border-stone-300 rounded-md px-2.5 py-1.5" value={form.guestPhone || ''} onChange={e => setForm({ ...form, guestPhone: e.target.value })} />
                        </label>
                        <label className="block">
                            <span className="text-xs text-stone-500">Email</span>
                            <input className="mt-1 w-full border border-stone-300 rounded-md px-2.5 py-1.5" value={form.guestEmail || ''} onChange={e => setForm({ ...form, guestEmail: e.target.value })} />
                        </label>
                        <label className="block">
                            <span className="text-xs text-stone-500">Source</span>
                            <select className="mt-1 w-full border border-stone-300 rounded-md px-2 py-1.5 bg-white" value={form.bookingSource || 'website'} onChange={e => setForm({ ...form, bookingSource: e.target.value })}>
                                {SOURCES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                            </select>
                        </label>
                        <label className="block">
                            <span className="text-xs text-stone-500">ID type</span>
                            <select className="mt-1 w-full border border-stone-300 rounded-md px-2 py-1.5 bg-white" value={form.guestIdType || ''} onChange={e => setForm({ ...form, guestIdType: e.target.value })}>
                                <option value="">—</option>
                                {ID_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </label>
                        <label className="block">
                            <span className="text-xs text-stone-500">ID number</span>
                            <input className="mt-1 w-full border border-stone-300 rounded-md px-2.5 py-1.5" value={form.guestIdNumber || ''} onChange={e => setForm({ ...form, guestIdNumber: e.target.value })} />
                        </label>
                        <label className="block">
                            <span className="text-xs text-stone-500">Adults</span>
                            <input type="number" min={0} className="mt-1 w-full border border-stone-300 rounded-md px-2.5 py-1.5" value={form.adults ?? 1} onChange={e => setForm({ ...form, adults: e.target.value })} />
                        </label>
                        <label className="block">
                            <span className="text-xs text-stone-500">Children</span>
                            <input type="number" min={0} className="mt-1 w-full border border-stone-300 rounded-md px-2.5 py-1.5" value={form.children ?? 0} onChange={e => setForm({ ...form, children: e.target.value })} />
                        </label>
                        <label className="block sm:col-span-2">
                            <span className="text-xs text-stone-500">Total price (₦)</span>
                            <input type="number" min={0} className="mt-1 w-full border border-stone-300 rounded-md px-2.5 py-1.5" value={form.totalAmount ?? 0} onChange={e => setForm({ ...form, totalAmount: e.target.value })} />
                        </label>
                        <label className="block sm:col-span-2">
                            <span className="text-xs text-stone-500">Notes</span>
                            <textarea rows={2} className="mt-1 w-full border border-stone-300 rounded-md px-2.5 py-1.5" value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} />
                        </label>
                        <div className="sm:col-span-2 flex justify-end">
                            <button disabled={busy} onClick={saveDetails}
                                className="px-4 py-2 rounded-md bg-[#008737] text-white text-sm font-semibold disabled:opacity-50">
                                Save changes
                            </button>
                        </div>
                    </div>
                )}

                {tab === 'payments' && (
                    <div className="px-6 py-4">
                        {(data.payments || []).length === 0 && b.status !== 'paid' && (
                            <p className="text-sm text-stone-400 mb-3">No payments recorded yet.</p>
                        )}
                        {b.status === 'paid' && (
                            <p className="text-sm text-[#008737] font-medium mb-3">Paid online via Paystack ({naira(b.total_amount)}).</p>
                        )}
                        <ul className="divide-y divide-stone-100 mb-4">
                            {(data.payments || []).map((p: any) => (
                                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                                    <span>{naira(p.amount)} <span className="text-stone-400">· {p.method || '—'} · {new Date(p.created_at).toLocaleDateString()}</span></span>
                                    <button onClick={() => deletePayment(p.id)} className="text-stone-300 hover:text-[#c75146]"><Trash2 size={14} /></button>
                                </li>
                            ))}
                        </ul>
                        <div className="flex flex-wrap gap-2">
                            <input type="number" min={0} placeholder="Amount (₦)" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                                className="flex-1 min-w-[120px] border border-stone-300 rounded-md px-2.5 py-2 text-sm" />
                            <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
                                className="border border-stone-300 rounded-md px-2 py-1.5 text-sm bg-white">
                                {PAY_METHODS.map(m => <option key={m}>{m}</option>)}
                            </select>
                            <button disabled={busy || !payAmount} onClick={addPayment}
                                className="px-4 py-1.5 rounded-md bg-[#008737] text-white text-sm font-semibold disabled:opacity-50">
                                Record payment
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
