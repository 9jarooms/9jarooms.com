'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Wallet, CheckCircle2, Clock, XCircle, Award } from 'lucide-react';
import { naira, fmtDay, cacheGet, fetchCached, useLiveUpdates } from './shared';

export interface CommissionLine {
    bookingId: string; guest: string; unit: string; property: string;
    checkIn: string; checkOut: string; nights: number; takenAt: string;
    total: number; paid: number; commission: number; state: 'awaiting_payment' | 'to_verify' | 'verified' | 'rejected';
}
export interface CommissionSummary {
    userId: string; month: string; lines: CommissionLine[]; bookings: number;
    calculated: number; verified: number; pending: number; payable: number; special: boolean;
    paidOut: { amount: number; paidAt: string } | null;
}

export const START_MONTH = '2026-11';
export const thisMonth = () => new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 7);
export function shiftMonth(m: string, by: number) {
    const [y, mo] = m.split('-').map(Number);
    const d = new Date(Date.UTC(y, mo - 1 + by, 1));
    return d.toISOString().slice(0, 7);
}
export const monthName = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
export const lastDayOf = (m: string) => fmtDay(new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).toISOString().slice(0, 10));

export const STATE: Record<CommissionLine['state'], { label: string; cls: string; icon: typeof Clock }> = {
    awaiting_payment: { label: 'Waiting for full payment', cls: 'bg-amber-50 text-amber-700', icon: Clock },
    to_verify: { label: 'Earned · awaiting check', cls: 'bg-sky-50 text-sky-700', icon: Clock },
    verified: { label: 'Verified', cls: 'bg-green-50 text-green-700', icon: CheckCircle2 },
    rejected: { label: 'Not counted', cls: 'bg-red-50 text-red-600', icon: XCircle },
};

export function MonthPicker({ month, onChange }: { month: string; onChange: (m: string) => void }) {
    return (
        <div className="flex items-center gap-1">
            <button type="button" aria-label="Previous month" disabled={month <= START_MONTH} onClick={() => onChange(shiftMonth(month, -1))}
                className="w-9 h-9 rounded-full border border-gray-200 bg-white flex items-center justify-center disabled:opacity-30"><ChevronLeft size={16} /></button>
            <span className="min-w-[8.5rem] text-center text-sm font-semibold text-gray-800">{monthName(month)}</span>
            <button type="button" aria-label="Next month" disabled={month >= thisMonth()} onClick={() => onChange(shiftMonth(month, 1))}
                className="w-9 h-9 rounded-full border border-gray-200 bg-white flex items-center justify-center disabled:opacity-30"><ChevronRight size={16} /></button>
        </div>
    );
}

// "My earnings": what the signed-in staff member has earned this month from bookings they took in the app.
export default function Earnings() {
    const [month, setMonth] = useState(thisMonth() < START_MONTH ? START_MONTH : thisMonth());
    const [me, setMe] = useState<CommissionSummary | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        const url = `/api/ops/commission?month=${month}`;
        const cached = cacheGet<{ me: CommissionSummary }>(url);
        if (cached) setMe(cached.me);
        try { setMe((await fetchCached<{ me: CommissionSummary }>(url)).me); setError(null); }
        catch (e: any) { setError(e?.message || 'Could not load'); }
    }, [month]);
    useEffect(() => { load(); }, [load]);
    useLiveUpdates(load);

    const capPct = me ? Math.min(100, Math.round((me.calculated / 200_000) * 100)) : 0;

    return (
        <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex items-center justify-between gap-3">
                <h1 className="text-xl font-bold text-gray-900">My earnings</h1>
                <MonthPicker month={month} onChange={m => { setMe(null); setMonth(m); }} />
            </div>

            {error && <p className="text-[13px] text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

            <div className="rounded-2xl bg-gradient-to-br from-green-600 to-green-700 p-5 text-white shadow-md">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-green-200 flex items-center gap-1.5"><Wallet size={13} /> Commission · {monthName(month)}</p>
                <p className="text-[34px] font-extrabold tracking-tight mt-1 tabular-nums">{me ? naira(me.calculated) : '—'}</p>
                <p className="text-white/80 text-sm">{me ? `${me.bookings} booking${me.bookings === 1 ? '' : 's'} taken in the app · 1.5% of each stay` : 'Loading…'}</p>
                {me && (
                    <>
                        <div className="mt-4 h-2 rounded-full bg-white/20 overflow-hidden"><div className="h-full bg-white rounded-full" style={{ width: `${capPct}%` }} /></div>
                        <p className="mt-1.5 text-[12px] text-white/75">
                            {me.special ? 'You reached ₦500,000: you qualify for the special ₦300,000 payout.'
                                : me.calculated >= 200_000 ? 'Monthly cap of ₦200,000 reached. Reach ₦500,000 for the special ₦300,000 payout.'
                                    : `${naira(200_000 - me.calculated)} to the ₦200,000 monthly cap`}
                        </p>
                    </>
                )}
            </div>

            {me && (
                <div className="grid grid-cols-3 gap-2">
                    <Stat label="Verified" value={naira(me.verified)} tone="text-green-700" />
                    <Stat label="Waiting for payment" value={naira(me.pending)} tone="text-amber-700" />
                    <Stat label={me.paidOut ? 'Paid out' : `Payout ${lastDayOf(month)}`} value={naira(me.paidOut ? me.paidOut.amount : me.payable)} tone="text-gray-900" />
                </div>
            )}

            {me?.special && (
                <p className="flex items-center gap-2 text-[13px] bg-amber-50 text-amber-800 rounded-xl px-3 py-2"><Award size={16} /> Special payout month: ₦300,000 once management verifies.</p>
            )}

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
                {me && me.lines.length === 0 && (
                    <p className="px-5 py-8 text-center text-sm text-gray-500">No bookings yet this month. Every booking you take in the app (Book now, or Hold + pay link) earns you 1.5% of the stay.</p>
                )}
                {me?.lines.map(l => <LineRow key={l.bookingId} l={l} />)}
            </div>

            <div className="text-[12px] text-gray-500 leading-relaxed px-1 space-y-1">
                <p>How it works: you earn 1.5% of the whole stay on every booking you take in the app, once the guest has paid in full. Cancelled bookings do not count.</p>
                <p>Management checks every booking at the end of the month. Only verified bookings are paid, on the last day of the month. Monthly cap ₦200,000; ₦500,000 or more in a month pays a special ₦300,000.</p>
            </div>
        </div>
    );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-3 py-3">
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-gray-400 leading-tight">{label}</p>
            <p className={`mt-1 text-[15px] font-bold tabular-nums ${tone}`}>{value}</p>
        </div>
    );
}

export function LineRow({ l, children }: { l: CommissionLine; children?: React.ReactNode }) {
    const s = STATE[l.state], Icon = s.icon;
    return (
        <div className="px-4 sm:px-5 py-3.5 flex items-start justify-between gap-3">
            <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{l.guest} <span className="font-normal text-gray-400">· {l.unit}{l.property ? `, ${l.property}` : ''}</span></p>
                <p className="text-xs text-gray-500 mt-0.5">{fmtDay(l.checkIn)} → {fmtDay(l.checkOut)} · {l.nights} night{l.nights === 1 ? '' : 's'} · stay {naira(l.total)}{l.paid + 1 < l.total ? ` (paid ${naira(l.paid)})` : ''}</p>
                <span className={`mt-1.5 inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${s.cls}`}><Icon size={11} /> {s.label}</span>
                {children}
            </div>
            <p className={`shrink-0 text-sm font-bold tabular-nums ${l.state === 'rejected' ? 'text-gray-300 line-through' : 'text-gray-900'}`}>{naira(l.commission)}</p>
        </div>
    );
}
