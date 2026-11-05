'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { naira, fmtDay, useLiveUpdates, cacheGet, fetchCached } from './shared';

// Rooms "Right now": every room the team runs and what it is doing tonight, live. Free rooms say
// when their next guest arrives; occupied rooms say who is in and until when. Same figures as the
// daily log (it is built from the same data).
interface Row {
    unitId: string; unit: string; group: string | null;
    status: 'occupied' | 'arriving' | 'leaving' | 'vacant' | 'cleaning' | 'maintenance' | 'held';
    guest?: string; checkIn?: string; checkOut?: string; balance?: number; rate?: number;
}
interface Log {
    date: string;
    properties: { id: string; name: string; live: boolean; rows: Row[] }[];
    future: { unitId?: string; checkIn: string; guest: string }[];
}

const STATUS: Record<Row['status'], { label: string; card: string; dot: string }> = {
    vacant: { label: 'Free tonight', card: 'border-green-200 bg-green-50', dot: 'bg-green-500' },
    occupied: { label: 'Occupied', card: 'border-gray-200 bg-white', dot: 'bg-gray-800' },
    arriving: { label: 'Arriving today', card: 'border-sky-200 bg-sky-50', dot: 'bg-sky-500' },
    leaving: { label: 'Leaving today', card: 'border-amber-200 bg-amber-50', dot: 'bg-amber-500' },
    held: { label: 'Locked (paying)', card: 'border-purple-200 bg-purple-50', dot: 'bg-purple-500' },
    cleaning: { label: 'Cleaning', card: 'border-orange-200 bg-orange-50', dot: 'bg-orange-500' },
    maintenance: { label: 'Repair', card: 'border-red-200 bg-red-50', dot: 'bg-red-500' },
};
const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'vacant', label: 'Free' },
    { key: 'busy', label: 'Occupied' },
    { key: 'moving', label: 'Arriving / leaving' },
    { key: 'blocked', label: 'Cleaning / repair' },
];
const inFilter = (f: string, s: Row['status']) => f === 'all' || (f === 'vacant' && s === 'vacant') || (f === 'busy' && (s === 'occupied' || s === 'held'))
    || (f === 'moving' && (s === 'arriving' || s === 'leaving')) || (f === 'blocked' && (s === 'cleaning' || s === 'maintenance'));

export default function RoomsNow({ propertyId }: { propertyId: string }) {
    const [log, setLog] = useState<Log | null>(null);
    const [filter, setFilter] = useState('all');
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        const url = `/api/crm/occupancy?propertyId=${encodeURIComponent(propertyId)}`;
        const cached = cacheGet<Log>(url);
        if (cached) setLog(cached);
        try { setLog(await fetchCached<Log>(url)); setError(null); }
        catch (e: any) { setError(e?.message || 'Could not load'); }
    }, [propertyId]);
    useEffect(() => { load(); }, [load]);
    useLiveUpdates(load);

    const nextArrival = useMemo(() => {
        const m = new Map<string, { checkIn: string; guest: string }>();
        for (const f of log?.future || []) if (f.unitId && (!m.has(f.unitId) || f.checkIn < m.get(f.unitId)!.checkIn)) m.set(f.unitId, f);
        return m;
    }, [log]);

    if (!log) return <p className="text-center text-gray-400 py-10">{error || 'Loading…'}</p>;

    const rows = log.properties.flatMap(p => p.rows);
    const count = (s: Row['status'][]) => rows.filter(r => s.includes(r.status)).length;
    const inUse = count(['occupied', 'arriving', 'leaving']);
    const sellable = rows.length - count(['maintenance']);
    const rate = sellable ? Math.round((inUse / sellable) * 100) : 0;
    const overdueCount = rows.filter(r => r.status === 'leaving' && !!r.checkOut && r.checkOut < log.date).length;

    return (
        <div className="space-y-4">
            {error && <p className="text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">No connection: showing the last saved view.</p>}

            <div className="rounded-2xl bg-gradient-to-br from-green-600 to-green-700 p-5 text-white shadow-md">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-green-200">Tonight · {fmtDay(log.date)}</p>
                <div className="mt-1 flex items-end justify-between gap-3">
                    <p className="text-[34px] font-extrabold tracking-tight tabular-nums">{rate}%<span className="text-[15px] font-semibold text-white/80 ml-2">occupied</span></p>
                    <p className="text-right text-[13px] text-white/85 pb-1.5">{inUse} of {sellable} rooms in use</p>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/20 overflow-hidden"><div className="h-full bg-white rounded-full" style={{ width: `${rate}%` }} /></div>
            </div>

            {overdueCount > 0 && (
                <p className="text-[13px] text-red-800 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    <b>{overdueCount} guest{overdueCount === 1 ? ' is' : 's are'} past their check-out date</b> but still checked in. The app treats those rooms as taken until someone opens the booking and taps Check out (or extends the stay).
                </p>
            )}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                <Stat label="Free" value={count(['vacant'])} tone="text-green-700" />
                <Stat label="Occupied" value={count(['occupied'])} tone="text-gray-900" />
                <Stat label="Arriving" value={count(['arriving'])} tone="text-sky-700" />
                <Stat label="Leaving / overdue" value={count(["leaving"])} tone="text-amber-700" />
                <Stat label="Locked" value={count(['held'])} tone="text-purple-700" />
                <Stat label="Clean / repair" value={count(['cleaning', 'maintenance'])} tone="text-orange-700" />
            </div>

            <div className="flex flex-wrap gap-2">
                {FILTERS.map(f => (
                    <button key={f.key} type="button" onClick={() => setFilter(f.key)}
                        className={`px-3 py-1.5 rounded-full text-[13px] font-semibold border ${filter === f.key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'}`}>
                        {f.label}
                    </button>
                ))}
            </div>

            {log.properties.map(p => {
                const list = p.rows.filter(r => inFilter(filter, r.status));
                if (!list.length) return null;
                const free = p.rows.filter(r => r.status === 'vacant').length;
                return (
                    <div key={p.id}>
                        <div className="flex items-baseline justify-between px-1 mb-2">
                            <h3 className="font-semibold text-gray-900">{p.name}{!p.live && <span className="ml-2 text-[11px] font-semibold text-amber-700">not on website</span>}</h3>
                            <span className="text-[12.5px] text-gray-500">{free} of {p.rows.length} free tonight</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                            {list.map(r => {
                                // checked in but their check-out date has passed: nobody tapped Check out
                                const overdue = r.status === 'leaving' && !!r.checkOut && r.checkOut < log.date;
                                const st = overdue ? { label: 'Overdue check-out', card: 'border-red-300 bg-red-50', dot: 'bg-red-600' } : STATUS[r.status];
                                const next = nextArrival.get(r.unitId);
                                return (
                                    <div key={r.unitId} className={`rounded-xl border px-3 py-2.5 ${st.card}`}>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-bold text-[15px] text-gray-900">{r.unit}</span>
                                            <span className="flex items-center gap-1 text-[11px] font-semibold text-gray-600"><span className={`w-2 h-2 rounded-full ${st.dot}`} />{st.label}</span>
                                        </div>
                                        {r.group && <p className="text-[11.5px] text-gray-500 truncate">{r.group}{r.rate ? ` · ${naira(r.rate)}` : ''}</p>}
                                        {r.guest ? (
                                            <p className="mt-1 text-[12.5px] text-gray-700 truncate">
                                                <b>{r.guest}</b>{r.checkOut ? ` · until ${fmtDay(r.checkOut)}` : ''}
                                                {!!r.balance && r.balance > 0 && <span className="block text-red-600 font-semibold">owes {naira(r.balance)}</span>}
                                            </p>
                                        ) : r.status === 'vacant' ? (
                                            <p className="mt-1 text-[12px] text-green-800">{next ? `Next guest ${fmtDay(next.checkIn)}` : 'No bookings in the next 30 days'}</p>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-2.5">
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-gray-400 leading-tight">{label}</p>
            <p className={`text-xl font-bold tabular-nums ${tone}`}>{value}</p>
        </div>
    );
}
