'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Plus, RefreshCw, Search, ChevronRight } from 'lucide-react';
import {
    BookingCard, KindPill, isoToday, fmtDay, naira, balanceOf, owes, shiftIso,
    unitLabel, groupUnits, unitPrice, relDayLower,
    type OpsToday, type OpsBooking, type UnitState,
} from './shared';
import BookingSheet from './BookingSheet';
import NewBookingSheet, { type NewBookingPreset } from './NewBookingSheet';
import UnitSheet from './UnitSheet';

type Tab = 'today' | 'units' | 'bookings';
const TABS: { key: Tab; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'units', label: 'Units' },
    { key: 'bookings', label: 'Bookings' },
];
const STORE_KEY = 'ops-property';

// The day-to-day screen for whoever is on the ground: who's arriving,
// who's leaving, who's in, which units are free — and one tap to act.
// Shared by the caretaker portal (/dashboard) and the CRM (/crm/today).
export default function OpsApp({ initialTab = 'today', bottomBar = false }: { initialTab?: Tab; bottomBar?: boolean }) {
    const [tab, setTab] = useState<Tab>(initialTab);
    const [propertyId, setPropertyId] = useState<string | null>(null); // null = not resolved yet
    const [data, setData] = useState<OpsToday | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [openBooking, setOpenBooking] = useState<string | null>(null);
    const [newBooking, setNewBooking] = useState<NewBookingPreset | null>(null);
    const [unitSheet, setUnitSheet] = useState<string | null>(null);

    // remembered property (read after mount so server + client render the same)
    useEffect(() => {
        let stored = '';
        try { stored = localStorage.getItem(STORE_KEY) || ''; } catch { /* ignore */ }
        setPropertyId(stored);
    }, []);

    const load = useCallback(async (silent = false) => {
        if (propertyId === null) return;
        if (!silent) setLoading(true);
        setError(null);
        try {
            const res = await fetch(
                `/api/ops/today?propertyId=${encodeURIComponent(propertyId)}&today=${isoToday()}`,
                { cache: 'no-store' }
            );
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Could not load');
            setData(json);
            if (json.propertyId && json.propertyId !== propertyId) setPropertyId(json.propertyId);
        } catch (e: any) {
            setError(e?.message || 'Could not load');
        } finally {
            setLoading(false);
        }
    }, [propertyId]);

    useEffect(() => { load(); }, [load]);

    const selectProperty = (id: string) => {
        setPropertyId(id);
        try { localStorage.setItem(STORE_KEY, id); } catch { /* ignore */ }
    };

    const today = data?.today || isoToday();
    const unitById = useMemo(() => new Map((data?.units || []).map(u => [u.id, u] as const)), [data]);
    const typeById = useMemo(() => new Map((data?.roomTypes || []).map(t => [t.id, t] as const)), [data]);
    const unitNameOf = useCallback((b: OpsBooking) => unitLabel(unitById.get(b.room_id) || b.room), [unitById]);

    const lists = useMemo(() => {
        const bs = data?.bookings || [];
        const expected = (b: OpsBooking) => ['pending', 'confirmed', 'paid'].includes(b.status);
        const byIn = (a: OpsBooking, b: OpsBooking) => a.check_in.localeCompare(b.check_in);
        const byOut = (a: OpsBooking, b: OpsBooking) => a.check_out.localeCompare(b.check_out);
        return {
            // due to arrive (today, or earlier and still not checked in)
            arrivals: bs.filter(b => expected(b) && b.check_in <= today && b.check_out > today).sort(byIn),
            // leaving today, or should already have left
            departures: bs.filter(b => b.status === 'checked_in' && b.check_out <= today).sort(byOut),
            inHouse: bs.filter(b => b.status === 'checked_in' && b.check_out > today).sort(byOut),
            // booked, never checked in, and the dates have passed
            missed: bs.filter(b => expected(b) && b.check_out <= today).sort(byIn),
            upcoming: bs.filter(b => expected(b) && b.check_in > today).sort(byIn),
        };
    }, [data, today]);

    // What each unit is doing tonight.
    const unitStatus = useMemo(() => {
        const m = new Map<string, UnitState>();
        if (!data) return m;
        const bs = data.bookings;
        const bookingById = new Map(bs.map(b => [b.id, b] as const));
        const heldToday = data.held.filter(h => h.date === today);
        const blocksToday = data.blocks.filter(k => k.date === today);
        for (const u of data.units) {
            const staying = bs.find(b => b.room_id === u.id && b.status === 'checked_in');
            if (staying) { m.set(u.id, { kind: 'occupied', booking: staying }); continue; }
            const due = bs.find(b => b.room_id === u.id && ['pending', 'confirmed', 'paid'].includes(b.status) && b.check_in <= today && b.check_out > today);
            if (due) { m.set(u.id, { kind: 'arriving', booking: due }); continue; }
            // extra rooms of a duplex / whole-apartment booking
            const held = heldToday.find(h => h.room_id === u.id);
            const hb = held ? bookingById.get(held.booking_id) : undefined;
            if (hb) { m.set(u.id, { kind: hb.status === 'checked_in' ? 'occupied' : 'arriving', booking: hb }); continue; }
            const blk = blocksToday.find(k => k.room_id === u.id);
            if (blk) { m.set(u.id, { kind: blk.status === 'maintenance' ? 'maintenance' : 'cleaning' }); continue; }
            m.set(u.id, { kind: 'free' });
        }
        return m;
    }, [data, today]);
    const freeTonight = [...unitStatus.values()].filter(s => s.kind === 'free').length;
    const groups = useMemo(() => data ? groupUnits(data.units, data.roomTypes) : [], [data]);

    const quick = async (id: string, payload: Record<string, unknown>) => {
        setBusyId(id);
        try {
            const res = await fetch(`/api/ops/bookings/${id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (!res.ok) { alert(json.error || 'Failed'); return; }
            await load(true);
        } catch {
            alert('Network error — check your connection and try again');
        } finally {
            setBusyId(null);
        }
    };
    const checkIn = (b: OpsBooking) => quick(b.id, { status: 'checked_in' });
    const checkOut = (b: OpsBooking) => {
        if (owes(b) && !confirm(`${b.guest_name} still owes ${naira(balanceOf(b))}. Check out anyway?`)) return;
        quick(b.id, { status: 'completed' });
    };

    const property = data?.properties.find(p => p.id === data.propertyId) || null;

    if (error && !data) {
        return (
            <div className="max-w-2xl mx-auto py-16 text-center">
                <p className="text-stone-600 mb-4">{error}</p>
                <button type="button" onClick={() => load()} className="h-11 px-5 rounded-xl bg-[#008737] text-white font-bold">Try again</button>
            </div>
        );
    }

    if (data && data.properties.length === 0) {
        return (
            <div className="max-w-2xl mx-auto py-16 text-center text-stone-500">
                <p className="font-semibold text-stone-800 mb-1">No properties assigned to you yet</p>
                <p className="text-sm">Ask the 9jaRooms team to link your account to a property.</p>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto">
            {/* header */}
            <div className="mb-4">
                <div className="flex items-center gap-2">
                    {data && data.properties.length > 1 ? (
                        <select
                            value={data.propertyId || ''}
                            onChange={e => selectProperty(e.target.value)}
                            className="flex-1 min-w-0 h-12 rounded-xl border border-stone-300 bg-white px-3 text-[16px] font-bold text-stone-900"
                        >
                            {data.properties.map(p => (
                                <option key={p.id} value={p.id}>{p.name}{p.area ? ` — ${p.area}` : ''}</option>
                            ))}
                        </select>
                    ) : (
                        <h1 className="flex-1 min-w-0 text-[22px] font-extrabold tracking-tight text-stone-900 truncate">
                            {property?.name || (loading ? 'Loading…' : 'Today')}
                        </h1>
                    )}
                    <button type="button" onClick={() => load(true)} aria-label="Refresh"
                        className="w-12 h-12 rounded-xl border border-stone-200 bg-white flex items-center justify-center text-stone-500 active:bg-stone-50 shrink-0">
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
                <p className="text-[13px] text-stone-500 mt-1.5">
                    {fmtDay(today, { year: true })}{data && <> · <b className={freeTonight > 0 ? 'text-[#008737]' : 'text-[#c75146]'}>{freeTonight} free</b> of {data.units.length} tonight</>}
                </p>

                <div className="mt-3 grid grid-cols-3 bg-stone-200/70 rounded-xl p-1">
                    {TABS.map(t => (
                        <button key={t.key} type="button" onClick={() => setTab(t.key)}
                            className={`h-10 rounded-lg text-[14px] font-bold transition-colors ${tab === t.key ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading && !data && <p className="text-center text-stone-400 py-16">Loading…</p>}

            {data && tab === 'today' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-4 gap-2">
                        {[
                            { label: 'Free tonight', value: freeTonight, accent: true, go: 'units' as Tab },
                            { label: 'Arriving', value: lists.arrivals.length },
                            { label: 'Leaving', value: lists.departures.length },
                            { label: 'In house', value: lists.inHouse.length },
                        ].map(t => (
                            <button key={t.label} type="button" onClick={() => t.go && setTab(t.go)}
                                className="bg-white rounded-2xl border border-stone-200/80 px-1 py-3 text-center">
                                <p className={`text-[22px] font-extrabold tabular-nums leading-none ${t.accent ? (t.value > 0 ? 'text-[#008737]' : 'text-[#c75146]') : 'text-stone-900'}`}>{t.value}</p>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400 mt-1.5">{t.label}</p>
                            </button>
                        ))}
                    </div>

                    <Section title="Arriving today" count={lists.arrivals.length} empty="No arrivals today">
                        {lists.arrivals.map(b => (
                            <BookingCard key={b.id} b={b} today={today} unit={unitNameOf(b)} busy={busyId === b.id}
                                onOpen={() => setOpenBooking(b.id)} onCheckIn={() => checkIn(b)} />
                        ))}
                    </Section>

                    <Section title="Leaving today" count={lists.departures.length} empty="No check-outs today">
                        {lists.departures.map(b => (
                            <BookingCard key={b.id} b={b} today={today} unit={unitNameOf(b)} busy={busyId === b.id}
                                onOpen={() => setOpenBooking(b.id)} onCheckOut={() => checkOut(b)} />
                        ))}
                    </Section>

                    {lists.missed.length > 0 && (
                        <Section title="Never checked in" count={lists.missed.length} empty="">
                            {lists.missed.map(b => (
                                <BookingCard key={b.id} b={b} today={today} unit={unitNameOf(b)} busy={busyId === b.id}
                                    onOpen={() => setOpenBooking(b.id)} />
                            ))}
                        </Section>
                    )}

                    <Section title="In house" count={lists.inHouse.length} empty="No guests staying tonight">
                        {lists.inHouse.map(b => (
                            <BookingCard key={b.id} b={b} today={today} unit={unitNameOf(b)} busy={busyId === b.id}
                                onOpen={() => setOpenBooking(b.id)} />
                        ))}
                    </Section>

                    <Section
                        title="Coming up"
                        count={lists.upcoming.length}
                        empty="Nothing booked for the next 30 days"
                        right={lists.upcoming.length > 5 && (
                            <button type="button" onClick={() => setTab('bookings')} className="text-[13px] font-bold text-[#008737] flex items-center gap-0.5">
                                See all <ChevronRight size={14} />
                            </button>
                        )}
                    >
                        {lists.upcoming.slice(0, 5).map(b => (
                            <BookingCard key={b.id} b={b} today={today} unit={unitNameOf(b)}
                                onOpen={() => setOpenBooking(b.id)} />
                        ))}
                    </Section>
                </div>
            )}

            {data && tab === 'units' && (
                <div className="space-y-5">
                    {groups.length === 0 && <p className="text-center text-stone-400 py-10">No active units on this property.</p>}
                    {groups.map(g => {
                        const free = g.units.filter(u => unitStatus.get(u.id)?.kind === 'free').length;
                        return (
                            <div key={g.key}>
                                <div className="flex items-center justify-between px-1 mb-2">
                                    <h2 className="text-[13px] font-extrabold uppercase tracking-wide text-stone-500">
                                        {g.label}{g.price != null && <span className="font-semibold text-stone-400 normal-case tracking-normal"> · {naira(g.price)}/night</span>}
                                    </h2>
                                    <span className={`text-[12px] font-bold ${free > 0 ? 'text-[#008737]' : 'text-[#c75146]'}`}>{free} free</span>
                                </div>
                                <div className="bg-white rounded-2xl border border-stone-200/80 divide-y divide-stone-100 overflow-hidden">
                                    {g.units.map(u => {
                                        const st = unitStatus.get(u.id) || { kind: 'free' as const };
                                        const price = unitPrice(u, data.roomTypes);
                                        return (
                                            <button key={u.id} type="button" onClick={() => setUnitSheet(u.id)}
                                                className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-stone-50">
                                                <span className="w-12 shrink-0 font-extrabold text-[15px] text-stone-900">{unitLabel(u)}</span>
                                                <span className="flex-1 min-w-0">
                                                    {st.booking ? (
                                                        <>
                                                            <span className="block font-semibold text-[14px] text-stone-800 truncate">{st.booking.guest_name}</span>
                                                            <span className="block text-[12px] text-stone-500">
                                                                {st.kind === 'arriving' ? 'arrives' : 'leaves'} {relDayLower(st.kind === 'arriving' ? st.booking.check_in : st.booking.check_out, today)}
                                                                {owes(st.booking) && <span className="font-bold text-[#c75146]"> · {naira(balanceOf(st.booking))} owing</span>}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span className="block text-[13px] text-stone-400">
                                                            {g.price == null && typeById.get(u.room_type_id || '')?.name}
                                                            {g.price == null && price != null && ` · ${naira(price)}/night`}
                                                            {g.price != null && (st.kind === 'free' ? 'Ready for a guest' : '')}
                                                        </span>
                                                    )}
                                                </span>
                                                <KindPill kind={st.kind} />
                                                <ChevronRight size={16} className="text-stone-300 shrink-0" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {data && tab === 'bookings' && data.propertyId && (
                <BookingSearch propertyId={data.propertyId} today={today} unitNameOf={unitNameOf} onOpen={id => setOpenBooking(id)} />
            )}

            {/* new booking */}
            {data && data.units.length > 0 && (
                <button
                    type="button"
                    onClick={() => setNewBooking({})}
                    className={`fixed right-4 z-30 h-14 pl-4 pr-5 rounded-full bg-[#008737] text-white font-bold text-[15px] shadow-[0_8px_24px_rgba(0,135,55,0.35)] flex items-center gap-2 active:bg-[#00762e] ${bottomBar ? 'bottom-[calc(4.75rem+env(safe-area-inset-bottom))] lg:bottom-8' : 'bottom-[calc(1.25rem+env(safe-area-inset-bottom))] sm:bottom-8'}`}
                >
                    <Plus size={20} strokeWidth={2.5} /> New booking
                </button>
            )}

            {openBooking && data && (
                <BookingSheet bookingId={openBooking} role={data.role} today={today}
                    onClose={() => setOpenBooking(null)} onChanged={() => load(true)} />
            )}
            {newBooking && data && (
                <NewBookingSheet data={data} preset={newBooking}
                    onClose={() => setNewBooking(null)} onCreated={() => { setNewBooking(null); load(true); }} />
            )}
            {unitSheet && data && unitById.get(unitSheet) && (
                <UnitSheet
                    unit={unitById.get(unitSheet)!}
                    typeName={typeById.get(unitById.get(unitSheet)!.room_type_id || '')?.name || null}
                    state={unitStatus.get(unitSheet) || { kind: 'free' }}
                    today={today}
                    blocks={data.blocks}
                    onClose={() => setUnitSheet(null)}
                    onOpenBooking={id => { setUnitSheet(null); setOpenBooking(id); }}
                    onNewBooking={() => { const id = unitSheet; setUnitSheet(null); setNewBooking({ unitId: id, mode: 'booking' }); }}
                    onBlock={status => { const id = unitSheet; setUnitSheet(null); setNewBooking({ unitId: id, mode: 'block', blockStatus: status }); }}
                    onChanged={() => load(true)}
                />
            )}
        </div>
    );
}

function Section({ title, count, empty, right, children }: {
    title: string; count: number; empty: string; right?: ReactNode; children: ReactNode;
}) {
    return (
        <section>
            <div className="flex items-center justify-between px-1 mb-2">
                <h2 className="text-[13px] font-extrabold uppercase tracking-wide text-stone-500">
                    {title}<span className="ml-1.5 text-stone-400">{count}</span>
                </h2>
                {right}
            </div>
            {count === 0
                ? <p className="text-[13px] text-stone-400 bg-white/60 border border-dashed border-stone-200 rounded-2xl px-4 py-4 text-center">{empty}</p>
                : <div className="space-y-2.5">{children}</div>}
        </section>
    );
}

const SCOPES = [
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'inhouse', label: 'In house' },
    { value: 'past', label: 'Past' },
    { value: 'all', label: 'All' },
];

// Search every booking on the property. Typing a name searches everything;
// otherwise the chips narrow to upcoming / in house / past.
function BookingSearch({ propertyId, today, unitNameOf, onOpen }: {
    propertyId: string; today: string; unitNameOf: (b: OpsBooking) => string; onOpen: (id: string) => void;
}) {
    const [q, setQ] = useState('');
    const [scope, setScope] = useState('upcoming');
    const [rows, setRows] = useState<OpsBooking[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        const p = new URLSearchParams({ propertyId, limit: '100' });
        if (q.trim()) {
            p.set('q', q.trim());
        } else if (scope === 'upcoming') {
            p.set('from', today); p.set('sort', 'check_in'); p.set('activeOnly', '1');
        } else if (scope === 'inhouse') {
            p.set('status', 'checked_in'); p.set('sort', 'check_out');
        } else if (scope === 'past') {
            p.set('outTo', shiftIso(today, -1));
        }
        try {
            const res = await fetch(`/api/ops/bookings?${p}`, { cache: 'no-store' });
            if (res.ok) setRows((await res.json()).bookings || []);
        } finally {
            setLoading(false);
        }
    }, [propertyId, q, scope, today]);

    useEffect(() => {
        const t = setTimeout(load, q ? 300 : 0);
        return () => clearTimeout(t);
    }, [load, q]);

    return (
        <div className="space-y-3">
            <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                    placeholder="Search guest name or phone…"
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    className="w-full h-12 pl-10 pr-3 rounded-xl border border-stone-300 bg-white text-[16px] outline-none focus:border-[#008737]"
                />
            </div>
            {!q.trim() && (
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {SCOPES.map(s => (
                        <button key={s.value} type="button" onClick={() => setScope(s.value)}
                            className={`shrink-0 px-3.5 h-9 rounded-full text-[13px] font-semibold border ${scope === s.value ? 'bg-[#02572a] text-white border-[#02572a]' : 'bg-white text-stone-600 border-stone-300'}`}>
                            {s.label}
                        </button>
                    ))}
                </div>
            )}
            <div className="space-y-2.5">
                {rows.map(b => (
                    <BookingCard key={b.id} b={b} today={today} unit={unitNameOf(b)} onOpen={() => onOpen(b.id)} />
                ))}
                {!loading && rows.length === 0 && <p className="text-center text-stone-400 py-10">No bookings found.</p>}
                {loading && rows.length === 0 && <p className="text-center text-stone-400 py-10">Loading…</p>}
            </div>
        </div>
    );
}
