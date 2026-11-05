'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Check, X, RotateCcw, Banknote } from 'lucide-react';
import { naira, fmtDay, useLiveUpdates } from './shared';
import Earnings, { MonthPicker, LineRow, thisMonth, monthName, lastDayOf, START_MONTH, type CommissionSummary } from './Earnings';

interface StaffRow extends CommissionSummary { name: string; username: string | null; roles: string[] }

// Management's month-end desk: each staff member's commission, verify or reject each booking,
// fix who took a booking, then mark the month paid. Anyone who is not an admin sees their own earnings.
export default function CommissionDesk() {
    const [month, setMonth] = useState(thisMonth() < START_MONTH ? START_MONTH : thisMonth());
    const [staff, setStaff] = useState<StaffRow[] | null>(null);
    const [forbidden, setForbidden] = useState(false);
    const [open, setOpen] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        const res = await fetch(`/api/crm/commission?month=${month}`, { cache: 'no-store' });
        if (res.status === 403) { setForbidden(true); return; }
        const json = await res.json();
        if (!res.ok) { setError(json.error || 'Could not load'); return; }
        setStaff(json.staff);
    }, [month]);
    useEffect(() => { load(); }, [load]);
    useLiveUpdates(load, !forbidden);

    if (forbidden) return <Earnings />;

    const call = async (method: string, body: unknown) => {
        setBusy(true); setError(null);
        const res = await fetch('/api/crm/commission', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const json = await res.json().catch(() => ({}));
        setBusy(false);
        if (!res.ok) { setError(json.error || 'Something went wrong'); return false; }
        await load();
        return true;
    };
    const check = (ids: string[], status: 'verified' | 'rejected' | null) => ids.length && call('PATCH', { bookingIds: ids, status });
    const reassign = (bookingId: string, userId: string | null) => call('PUT', { bookingId, userId });
    const pay = (s: StaffRow, undo = false) => {
        if (!undo && !confirm(`Mark ${naira(s.due)} commission for ${monthName(month)} as paid to ${s.name}?`)) return;
        call('POST', { userId: s.userId, month, undo });
    };

    const totals = (staff || []).reduce((t, s) => ({ calc: t.calc + s.calculated, payable: t.payable + s.due, toCheck: t.toCheck + s.lines.filter(l => l.state === 'to_verify').length }), { calc: 0, payable: 0, toCheck: 0 });

    return (
        <div className="max-w-4xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-[22px] sm:text-[26px] font-extrabold tracking-tight text-stone-900">Commission</h1>
                    <p className="text-[13px] text-stone-500">1.5% of each stay taken in the app · cap ₦200,000 · ₦500,000+ pays ₦300,000 · paid {lastDayOf(month)}</p>
                </div>
                <MonthPicker month={month} onChange={m => { setStaff(null); setMonth(m); }} />
            </div>

            <div className="grid grid-cols-3 gap-2">
                <Box label="Earned (all staff)" value={naira(totals.calc)} />
                <Box label="Still to pay (verified)" value={naira(totals.payable)} />
                <Box label="Bookings to check" value={String(totals.toCheck)} />
            </div>

            {error && <p className="text-[13px] text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
            {!staff && <p className="text-stone-400 text-sm py-6 text-center">Loading…</p>}

            {staff?.map(s => {
                const toVerify = s.lines.filter(l => l.state === 'to_verify').map(l => l.bookingId);
                const isOpen = open === s.userId;
                return (
                    <div key={s.userId} className="bg-white rounded-2xl border border-stone-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                        <button type="button" onClick={() => setOpen(isOpen ? null : s.userId)} className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left">
                            <div className="min-w-0">
                                <p className="font-semibold text-stone-900 truncate">{s.name} {s.username && <span className="font-normal text-stone-400 text-sm">@{s.username}</span>}</p>
                                <p className="text-xs text-stone-500 mt-0.5">
                                    {s.bookings} booking{s.bookings === 1 ? '' : 's'} · earned {naira(s.calculated)} · verified {naira(s.verified)}
                                    {s.pending > 0 && ` · ${naira(s.pending)} waiting for payment`}
                                    {toVerify.length > 0 && <span className="text-sky-700 font-semibold"> · {toVerify.length} to check</span>}
                                </p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <div className="text-right">
                                    <p className="text-[10px] uppercase tracking-wide text-stone-400 font-semibold">{s.paidOut ? 'Paid' : 'Payable'}</p>
                                    <p className={`font-bold tabular-nums ${s.paidOut ? 'text-green-700' : 'text-stone-900'}`}>{naira(s.paidOut ? s.paidOut.amount : s.payable)}</p>
                                </div>
                                <ChevronDown size={18} className={`text-stone-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                            </div>
                        </button>

                        {isOpen && (
                            <div className="border-t border-stone-100">
                                <div className="px-5 py-3 flex flex-wrap gap-2 bg-stone-50/60">
                                    <button disabled={busy || !toVerify.length} onClick={() => check(toVerify, 'verified')}
                                        className="px-3 py-1.5 rounded-md bg-[#008737] text-white text-[13px] font-semibold disabled:opacity-40 flex items-center gap-1.5"><Check size={14} /> Verify all {toVerify.length || ''}</button>
                                    <button disabled={busy || s.due <= 0} onClick={() => pay(s)} className="px-3 py-1.5 rounded-md bg-stone-900 text-white text-[13px] font-semibold disabled:opacity-40 flex items-center gap-1.5">
                                        <Banknote size={14} /> {s.paidOut ? `Pay top-up ${naira(s.due)}` : `Mark ${naira(s.due)} paid`}
                                    </button>
                                    {s.paidOut && (
                                        <button disabled={busy} onClick={() => pay(s, true)} className="px-3 py-1.5 rounded-md border border-stone-300 text-[13px] font-semibold text-stone-600 flex items-center gap-1.5">
                                            <RotateCcw size={14} /> Undo last payment ({fmtDay(s.paidOut.paidAt.slice(0, 10))})
                                        </button>
                                    )}
                                    {s.paidOut && s.paidOut.amount > s.payable && (
                                        <span className="text-[12px] font-semibold text-red-600 self-center">Paid {naira(s.paidOut.amount - s.payable)} more than now earned (a booking was cancelled or changed). Take it off next month.</span>
                                    )}
                                </div>
                                {s.lines.length === 0 && <p className="px-5 py-5 text-sm text-stone-500">No bookings taken this month.</p>}
                                <div className="divide-y divide-stone-100">
                                    {s.lines.map(l => (
                                        <LineRow key={l.bookingId} l={l}>
                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                                {l.state === 'to_verify' && <button disabled={busy} onClick={() => check([l.bookingId], 'verified')} className="text-[12px] font-semibold text-green-700 flex items-center gap-1"><Check size={13} /> Verify</button>}
                                                {l.state !== 'rejected' && <button disabled={busy} onClick={() => check([l.bookingId], 'rejected')} className="text-[12px] font-semibold text-red-600 flex items-center gap-1"><X size={13} /> Don’t count</button>}
                                                {(l.state === 'verified' || l.state === 'rejected') && <button disabled={busy} onClick={() => check([l.bookingId], null)} className="text-[12px] font-semibold text-stone-500 flex items-center gap-1"><RotateCcw size={12} /> Undo</button>}
                                                <select disabled={busy} value={s.userId} onChange={e => reassign(l.bookingId, e.target.value || null)}
                                                    className="text-[12px] border border-stone-200 rounded-md px-1.5 py-0.5 bg-white text-stone-600" title="Who took this booking">
                                                    {staff.map(o => <option key={o.userId} value={o.userId}>Taken by {o.name}</option>)}
                                                    <option value="">Nobody (no commission)</option>
                                                </select>
                                            </div>
                                        </LineRow>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
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
