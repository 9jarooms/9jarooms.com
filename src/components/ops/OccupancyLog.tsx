'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { naira, fmtDay, shiftIso, isoToday } from './shared';

interface Row { unitId: string; unit: string; group: string | null; status: string; guest?: string; phone?: string | null; rate?: number;
    checkIn?: string; checkOut?: string; nights?: number; total?: number; paid?: number; balance?: number }
interface Prop { id: string; name: string; live: boolean; rows: Row[]; occupied: number; units: number }
interface Log { date: string; properties: Prop[]; totals: { units: number; occupied: number; revenueToday: number; owing: number };
    future: { bookingId: string; guest: string; unit: string; checkIn: string; checkOut: string; nights: number; total: number; paid: number }[];
    owing: { bookingId: string; guest: string; phone: string | null; unit: string; checkIn: string; checkOut: string; total: number; paid: number; balance: number }[] }

const LABEL: Record<string, string> = { occupied: 'In house', arriving: 'Arriving', leaving: 'Leaving today', vacant: 'Vacant', cleaning: 'Cleaning', maintenance: 'Maintenance', held: 'Held (paying)' };
const STYLE: Record<string, string> = { occupied: 'bg-green-700 text-white', arriving: 'bg-amber-100 text-amber-800', leaving: 'bg-red-50 text-red-700',
    vacant: 'bg-gray-100 text-gray-500', cleaning: 'bg-blue-100 text-blue-800', maintenance: 'bg-gray-200 text-gray-700', held: 'bg-purple-100 text-purple-700' };

// The daily occupancy log, generated from the bookings for any day. Nobody has to fill it in:
// every check-in, payment and check-out recorded in the app shows up here. Print = today's sheet.
export default function OccupancyLog() {
    const [date, setDate] = useState(isoToday());
    const [prop, setProp] = useState('all');
    const [log, setLog] = useState<Log | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        const res = await fetch(`/api/crm/occupancy?date=${date}&propertyId=${prop}`, { cache: 'no-store' });
        if (res.ok) setLog(await res.json());
        setLoading(false);
    }, [date, prop]);
    useEffect(() => { load(); }, [load]);

    const t = log?.totals;
    return (
        <div className="max-w-6xl mx-auto print:max-w-none">
            <div className="flex flex-wrap items-center gap-2 mb-4 print:hidden">
                <button type="button" onClick={() => setDate(d => shiftIso(d, -1))} aria-label="Previous day" className="w-11 h-11 rounded-full border border-gray-200 bg-white flex items-center justify-center"><ChevronLeft size={18} /></button>
                <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-[16px] shadow-sm" />
                <button type="button" onClick={() => setDate(d => shiftIso(d, 1))} aria-label="Next day" className="w-11 h-11 rounded-full border border-gray-200 bg-white flex items-center justify-center"><ChevronRight size={18} /></button>
                <button type="button" onClick={() => setDate(isoToday())} className="h-11 px-4 rounded-full border border-gray-200 bg-white text-sm font-medium">Today</button>
                <select value={prop} onChange={e => setProp(e.target.value)} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-[15px] shadow-sm min-w-0 flex-1 sm:flex-none">
                    <option value="all">All properties</option>
                    {(log?.properties || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button type="button" onClick={() => window.print()} className="h-11 px-4 rounded-full bg-gray-900 text-white text-sm font-semibold flex items-center gap-2 ml-auto"><Printer size={16} /> Print / PDF</button>
            </div>

            <h1 className="text-[22px] font-semibold tracking-tight text-gray-900">Occupancy log · {fmtDay(date, { year: true })}</h1>
            {t && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-4">
                    {[['Rooms', t.units], ['Occupied', `${t.occupied} (${t.units ? Math.round(t.occupied / t.units * 100) : 0}%)`], ['Tonight’s room revenue', naira(t.revenueToday)], ['Owed by guests', naira(t.owing)]].map(([k, v]) => (
                        <div key={k as string} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{k}</p>
                            <p className="text-[20px] font-semibold tabular-nums text-gray-900 mt-1">{v}</p>
                        </div>
                    ))}
                </div>
            )}
            {loading && !log && <p className="text-gray-400 py-10 text-center">Loading…</p>}

            {log?.properties.map(p => (
                <section key={p.id} className="mb-6 break-inside-avoid">
                    <h2 className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 px-1 mb-2">
                        {p.name} · {p.occupied}/{p.units} occupied{!p.live && <span className="normal-case tracking-normal text-amber-700"> · not on website</span>}
                    </h2>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
                        <table className="w-full text-[13px] min-w-[760px]">
                            <thead><tr className="text-left text-[10.5px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                                {['Unit', 'Guest', 'Status', 'Rate/night', 'Check-in', 'Check-out', 'Nights', 'Total due', 'Paid', 'Balance'].map(h => <th key={h} className="px-3 py-2.5 font-semibold">{h}</th>)}
                            </tr></thead>
                            <tbody>
                                {p.rows.map(r => (
                                    <tr key={r.unitId} className="border-b border-gray-50 last:border-0">
                                        <td className="px-3 py-2 font-semibold text-gray-900 whitespace-nowrap">{r.unit}</td>
                                        <td className="px-3 py-2 text-gray-800">{r.guest || <span className="text-gray-400">—</span>}{r.phone && <span className="block text-[11px] text-gray-400">{r.phone}</span>}</td>
                                        <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap ${STYLE[r.status] || ''}`}>{LABEL[r.status] || r.status}</span></td>
                                        <td className="px-3 py-2 tabular-nums">{r.rate ? naira(r.rate) : '—'}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{r.checkIn ? fmtDay(r.checkIn) : '—'}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{r.checkOut ? fmtDay(r.checkOut) : '—'}</td>
                                        <td className="px-3 py-2 tabular-nums">{r.nights ?? '—'}</td>
                                        <td className="px-3 py-2 tabular-nums">{r.total != null ? naira(r.total) : '—'}</td>
                                        <td className="px-3 py-2 tabular-nums text-green-700">{r.paid != null ? naira(r.paid) : '—'}</td>
                                        <td className={`px-3 py-2 tabular-nums font-semibold ${r.balance ? 'text-red-600' : 'text-gray-400'}`}>{r.balance != null ? naira(r.balance) : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            ))}

            {log && log.future.length > 0 && (
                <section className="mb-6 break-inside-avoid">
                    <h2 className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 px-1 mb-2">Future bookings · next 30 days</h2>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                        {log.future.map(f => (
                            <div key={f.bookingId} className="px-4 py-2.5 flex flex-wrap items-center gap-x-4 text-[13px]">
                                <b className="w-16">{f.unit}</b><span className="flex-1 min-w-[140px]">{f.guest}</span>
                                <span>{fmtDay(f.checkIn)} → {fmtDay(f.checkOut)} · {f.nights}n</span>
                                <span className="tabular-nums">{naira(f.total)}</span>
                                <span className={`tabular-nums ${f.total - f.paid > 0 ? 'text-red-600' : 'text-green-700'}`}>{f.total - f.paid > 0 ? `${naira(f.total - f.paid)} owing` : 'paid'}</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {log && log.owing.length > 0 && (
                <section className="mb-10 break-inside-avoid">
                    <h2 className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 px-1 mb-2">Outstanding balances</h2>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                        {log.owing.map(o => (
                            <div key={o.bookingId} className="px-4 py-2.5 flex flex-wrap items-center gap-x-4 text-[13px]">
                                <b className="w-16">{o.unit}</b><span className="flex-1 min-w-[140px]">{o.guest}{o.phone ? <span className="text-gray-400"> · {o.phone}</span> : null}</span>
                                <span>{fmtDay(o.checkIn)} → {fmtDay(o.checkOut)}</span>
                                <span className="tabular-nums font-semibold text-red-600">{naira(o.balance)}</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
