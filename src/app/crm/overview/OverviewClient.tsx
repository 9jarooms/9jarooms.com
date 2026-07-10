'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BedDouble, LogIn, LogOut, CheckSquare, Square, CalendarDays } from 'lucide-react';

function naira(n: number) {
    return '₦' + Math.round(Number(n || 0)).toLocaleString('en-NG');
}

interface PropertyStats {
    id: string; name: string; area: string | null;
    units: number; occupiedTonight: number; freeTonight: number;
    occupancyTonight: number; occupancyMonth: number;
    arrivalsToday: number; departuresToday: number;
    revenueMonth: number; outstanding: number; bookingsMonth: number;
}

const STORE_KEY = 'crm-overview-selected';

function OccupancyBar({ pct }: { pct: number }) {
    const color = pct >= 80 ? '#c75146' : pct >= 50 ? '#e8a13c' : '#008737';
    return (
        <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
        </div>
    );
}

export default function OverviewClient() {
    const [data, setData] = useState<PropertyStats[]>([]);
    const [selected, setSelected] = useState<string[] | null>(null); // null = all
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        const res = await fetch('/api/crm/overview');
        if (res.ok) setData((await res.json()).properties);
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
        try {
            const saved = localStorage.getItem(STORE_KEY);
            if (saved) setSelected(JSON.parse(saved));
        } catch { /* ignore */ }
    }, [load]);

    const toggle = (id: string) => {
        const all = data.map(p => p.id);
        const current = selected ?? all;
        const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
        const normalized = next.length === all.length ? null : next;
        setSelected(normalized);
        try {
            if (normalized) localStorage.setItem(STORE_KEY, JSON.stringify(normalized));
            else localStorage.removeItem(STORE_KEY);
        } catch { /* ignore */ }
    };

    const visible = useMemo(
        () => selected ? data.filter(p => selected.includes(p.id)) : data,
        [data, selected]
    );

    const totals = useMemo(() => {
        const t = { units: 0, occupied: 0, free: 0, arrivals: 0, departures: 0, revenue: 0, outstanding: 0, soldPct: 0 };
        for (const p of visible) {
            t.units += p.units; t.occupied += p.occupiedTonight; t.free += p.freeTonight;
            t.arrivals += p.arrivalsToday; t.departures += p.departuresToday;
            t.revenue += p.revenueMonth; t.outstanding += p.outstanding;
        }
        t.soldPct = t.units > 0 ? Math.round((t.occupied / t.units) * 100) : 0;
        return t;
    }, [visible]);

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px]">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-5 sm:mb-6">
                <div>
                    <h1 className="text-[22px] sm:text-[26px] font-extrabold tracking-tight text-stone-900">Overview</h1>
                    <p className="text-[13px] text-stone-500 mt-0.5">
                        {new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        {selected && <span> · showing {visible.length} of {data.length} properties</span>}
                    </p>
                </div>
            </div>

            {/* property filter chips — horizontal scroll strip on mobile */}
            <div className="flex gap-2 mb-6 sm:mb-7 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 md:flex-wrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button
                    onClick={() => { setSelected(null); try { localStorage.removeItem(STORE_KEY); } catch { } }}
                    className={`shrink-0 whitespace-nowrap px-3.5 py-2 rounded-full text-[12.5px] font-semibold border transition-all ${!selected ? 'bg-[#02572a] text-white border-[#02572a] shadow-sm' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'}`}
                >
                    All properties
                </button>
                {data.map(p => {
                    const on = !selected || selected.includes(p.id);
                    return (
                        <button
                            key={p.id}
                            onClick={() => toggle(p.id)}
                            className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12.5px] font-semibold border transition-all ${on ? 'bg-[#7ed957]/15 text-[#02572a] border-[#7ed957]/50' : 'bg-white text-stone-400 border-stone-200 hover:border-stone-300'}`}
                        >
                            {on ? <CheckSquare size={13} /> : <Square size={13} />}
                            {p.name}
                        </button>
                    );
                })}
            </div>

            {/* aggregate strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
                {[
                    { label: 'Rooms free tonight', value: String(totals.free), accent: true },
                    { label: 'Occupied tonight', value: `${totals.occupied} / ${totals.units}` },
                    { label: 'Occupancy tonight', value: `${totals.soldPct}%` },
                    { label: 'Arrivals today', value: String(totals.arrivals) },
                    { label: 'Revenue this month', value: naira(totals.revenue) },
                    { label: 'Outstanding', value: naira(totals.outstanding), alert: totals.outstanding > 0 },
                ].map(c => (
                    <div key={c.label} className="bg-white rounded-2xl border border-stone-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] px-4.5 py-4 px-5">
                        <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-stone-400">{c.label}</p>
                        <p className={`text-[22px] font-extrabold tracking-tight mt-1 [font-variant-numeric:tabular-nums] ${c.alert ? 'text-[#c75146]' : c.accent ? 'text-[#008737]' : 'text-stone-900'}`}>
                            {c.value}
                        </p>
                    </div>
                ))}
            </div>

            {/* per-property cards */}
            <div className="grid md:grid-cols-2 gap-4">
                {visible.map(p => (
                    <div key={p.id} className="bg-white rounded-2xl border border-stone-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-5 hover:shadow-[0_4px_16px_rgba(2,87,42,0.08)] transition-shadow">
                        <div className="flex items-start justify-between gap-3 mb-4">
                            <div className="min-w-0">
                                <h2 className="font-bold text-[15.5px] text-stone-900 truncate">{p.name}</h2>
                                <p className="text-[12px] text-stone-400 mt-0.5">{p.area} · {p.units} unit{p.units === 1 ? '' : 's'}</p>
                            </div>
                            <Link
                                href={`/crm/calendar?propertyId=${p.id}`}
                                className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-lg bg-[#02572a] text-white text-[12px] font-bold hover:bg-[#03471f] transition-colors"
                            >
                                <CalendarDays size={13} /> Calendar
                            </Link>
                        </div>

                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[12px] font-semibold text-stone-500">Tonight</span>
                            <span className="text-[12px] font-bold [font-variant-numeric:tabular-nums]">
                                <span className={p.freeTonight === 0 ? 'text-[#c75146]' : 'text-[#008737]'}>{p.freeTonight} free</span>
                                <span className="text-stone-300"> · </span>
                                <span className="text-stone-600">{p.occupiedTonight}/{p.units} occupied ({p.occupancyTonight}%)</span>
                            </span>
                        </div>
                        <OccupancyBar pct={p.occupancyTonight} />

                        <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-stone-100">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400 flex items-center gap-1"><LogIn size={11} /> In</p>
                                <p className="text-[15px] font-extrabold [font-variant-numeric:tabular-nums]">{p.arrivalsToday}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400 flex items-center gap-1"><LogOut size={11} /> Out</p>
                                <p className="text-[15px] font-extrabold [font-variant-numeric:tabular-nums]">{p.departuresToday}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400 flex items-center gap-1"><BedDouble size={11} /> Month</p>
                                <p className="text-[15px] font-extrabold [font-variant-numeric:tabular-nums]">{p.occupancyMonth}%</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Revenue</p>
                                <p className="text-[15px] font-extrabold [font-variant-numeric:tabular-nums]">{naira(p.revenueMonth)}</p>
                            </div>
                        </div>
                        {p.outstanding > 0 && (
                            <p className="mt-3 text-[11.5px] font-bold text-[#c75146] bg-red-50 rounded-lg px-3 py-1.5 [font-variant-numeric:tabular-nums]">
                                {naira(p.outstanding)} outstanding
                            </p>
                        )}
                    </div>
                ))}
                {!loading && visible.length === 0 && (
                    <p className="text-stone-400 text-sm py-10">No properties selected.</p>
                )}
            </div>
        </div>
    );
}
