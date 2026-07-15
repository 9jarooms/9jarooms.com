'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import BookingModal, { naira } from '../components/BookingModal';

const CELL_W = 44;
const DAYS = 28;

// local-date ISO — toISOString() would shift a day back in WAT (UTC+1)
function iso(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

function barColor(b: any): string {
    if (b.status === 'checked_in') return '#02572a';
    if (b.status === 'completed') return '#9aa39c';
    if (b.status === 'paid' || b.paid >= Number(b.total_amount)) return '#008737';
    if (b.paid > 0) return '#e8a13c';
    if (b.status === 'pending') return '#8d7ab5';
    return '#c75146'; // confirmed, nothing paid — money owed
}

interface Property { id: string; name: string; area: string | null; price_per_night?: number | null }

// Many listings share a generic name ("Studio in Wuye" x2). Build a label
// per property that is unique: base is "Name — Area"; when that collides,
// append the price if it separates them, otherwise a #index. Also expose
// an area→properties grouping so the dropdown can use <optgroup>.
function buildSelectorLabels(properties: Property[]) {
    const byBase = new Map<string, Property[]>();
    for (const p of properties) {
        const area = (p.area || '').trim();
        const base = area ? `${p.name} — ${area}` : p.name;
        if (!byBase.has(base)) byBase.set(base, []);
        byBase.get(base)!.push(p);
    }
    const labelById: Record<string, string> = {};
    for (const [base, group] of byBase) {
        if (group.length === 1) { labelById[group[0].id] = base; continue; }
        const prices = group.map(g => g.price_per_night ?? null);
        const pricesUnique = new Set(prices).size === group.length && prices.every(v => v != null);
        group.forEach((g, i) => {
            labelById[g.id] = pricesUnique
                ? `${base} · ₦${Number(g.price_per_night).toLocaleString('en-NG')}`
                : `${base} · #${i + 1}`;
        });
    }
    return labelById;
}

export default function CalendarClient({ properties, initialPropertyId }: {
    properties: Property[];
    initialPropertyId?: string;
}) {
    const [propertyId, setPropertyId] = useState(
        (initialPropertyId && properties.some(p => p.id === initialPropertyId))
            ? initialPropertyId
            : (properties[0]?.id || '')
    );
    const [start, setStart] = useState(() => addDays(new Date(), -2));
    const [data, setData] = useState<any>(null);
    const [openBooking, setOpenBooking] = useState<string | null>(null);
    const [newBooking, setNewBooking] = useState<{ unitId: string; date: string } | null>(null);
    const [editUnit, setEditUnit] = useState<any>(null);

    // Keep the chosen property in the URL so a refresh stays on it (the page
    // reads ?propertyId to seed initialPropertyId).
    const selectProperty = useCallback((id: string) => {
        setPropertyId(id);
        if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', `/crm/calendar?propertyId=${id}`);
        }
    }, []);

    const labelById = useMemo(() => buildSelectorLabels(properties), [properties]);

    // group properties by area for the dropdown, areas alphabetical,
    // labels alphabetical within each area
    const groupedByArea = useMemo(() => {
        const groups = new Map<string, Property[]>();
        for (const p of properties) {
            const area = (p.area || '').trim() || 'Other';
            if (!groups.has(area)) groups.set(area, []);
            groups.get(area)!.push(p);
        }
        return [...groups.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([area, list]) => [
                area,
                list.sort((a, b) => (labelById[a.id] || '').localeCompare(labelById[b.id] || '')),
            ] as [string, Property[]]);
    }, [properties, labelById]);

    const dates = useMemo(
        () => Array.from({ length: DAYS }, (_, i) => iso(addDays(start, i))),
        [start]
    );
    const from = dates[0];
    const to = iso(addDays(start, DAYS));

    const load = useCallback(async () => {
        if (!propertyId) return;
        const res = await fetch(`/api/crm/calendar?propertyId=${propertyId}&from=${from}&to=${to}`);
        if (res.ok) setData(await res.json());
    }, [propertyId, from, to]);

    useEffect(() => { load(); }, [load]);

    const todayIso = iso(new Date());

    const typeById = useMemo(() => {
        const m = new Map<string, any>();
        for (const t of data?.roomTypes || []) m.set(t.id, t);
        return m;
    }, [data]);

    // Group the grid. Duplex properties (Kaura: unit codes like 1A/1B/1C) group
    // by unit NUMBER — one "Unit N" block holding its 3 rooms. Everything else
    // groups by room type as before.
    const groups = useMemo(() => {
        if (!data) return [];
        const allUnits: any[] = data.units || [];
        const isDuplex = allUnits.length > 0 && allUnits.every(u => /^\d+[A-Za-z]/.test(u.unit_code || ''));

        if (isDuplex) {
            const byNo = new Map<string, any[]>();
            for (const u of allUnits) {
                const n = (u.unit_code || '').match(/^(\d+)/)![1];
                if (!byNo.has(n)) byNo.set(n, []);
                byNo.get(n)!.push(u);
            }
            return [...byNo.entries()]
                .sort((a, b) => Number(a[0]) - Number(b[0]))
                .map(([n, units]) => ({
                    type: { id: `unit-${n}`, name: `Unit ${n}`, price_per_night: null as number | null },
                    units: units.sort((a, b) => (a.unit_code || '').localeCompare(b.unit_code || '')),
                }));
        }

        const types: any[] = [...(data.roomTypes || [])];
        const grouped = types.map(t => ({
            type: t,
            units: allUnits.filter((u: any) => u.room_type_id === t.id),
        })).filter(g => g.units.length > 0);
        const untyped = allUnits.filter((u: any) => !u.room_type_id);
        if (untyped.length > 0) grouped.push({ type: { id: '_none', name: 'Rooms', price_per_night: null }, units: untyped });
        return grouped;
    }, [data]);

    // per unit: which dates are taken by bookings (for free counts + click guard)
    const occupancy = useMemo(() => {
        const occ = new Map<string, Set<string>>();
        if (!data) return occ;
        for (const b of data.bookings || []) {
            const set = occ.get(b.room_id) || new Set<string>();
            let d = new Date(b.check_in);
            const end = new Date(b.check_out);
            while (d < end) { set.add(iso(d)); d = addDays(d, 1); }
            occ.set(b.room_id, set);
        }
        for (const blk of data.blocks || []) {
            const set = occ.get(blk.room_id) || new Set<string>();
            set.add(blk.date);
            occ.set(blk.room_id, set);
        }
        return occ;
    }, [data]);

    const gridWidth = DAYS * CELL_W;

    return (
        <div className="p-4 sm:p-6">
            {/* toolbar */}
            <div className="flex flex-wrap items-center gap-2.5 mb-4 sm:mb-5">
                <h1 className="text-[22px] sm:text-[26px] font-extrabold tracking-tight text-stone-900 w-full sm:w-auto sm:mr-2">Calendar</h1>
                <div className="flex items-center rounded-xl border border-stone-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden flex-1 sm:flex-none">
                    <button
                        title="Previous property"
                        onClick={() => {
                            const order = groupedByArea.flatMap(([, list]) => list);
                            const i = order.findIndex(p => p.id === propertyId);
                            selectProperty(order[(i - 1 + order.length) % order.length].id);
                        }}
                        className="px-2.5 py-2.5 hover:bg-stone-50 text-stone-500 border-r border-stone-100 shrink-0"
                    ><ChevronLeft size={15} /></button>
                    <select value={propertyId} onChange={e => selectProperty(e.target.value)}
                        className="flex-1 min-w-0 px-3 py-2.5 text-[13.5px] font-semibold bg-white outline-none sm:max-w-72">
                        {groupedByArea.map(([area, list]) => (
                            <optgroup key={area} label={area}>
                                {list.map(p => <option key={p.id} value={p.id}>{labelById[p.id]}</option>)}
                            </optgroup>
                        ))}
                    </select>
                    <button
                        title="Next property"
                        onClick={() => {
                            const order = groupedByArea.flatMap(([, list]) => list);
                            const i = order.findIndex(p => p.id === propertyId);
                            selectProperty(order[(i + 1) % order.length].id);
                        }}
                        className="px-2.5 py-2.5 hover:bg-stone-50 text-stone-500 border-l border-stone-100 shrink-0"
                    ><ChevronRight size={15} /></button>
                </div>
                <div className="flex items-center rounded-xl border border-stone-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
                    <button onClick={() => setStart(addDays(start, -7))} className="px-3 py-2.5 hover:bg-stone-50 text-stone-500"><ChevronLeft size={15} /></button>
                    <button onClick={() => setStart(addDays(new Date(), -2))} className="px-3.5 py-2.5 text-[13px] font-bold text-[#02572a] hover:bg-stone-50 border-x border-stone-100">Today</button>
                    <button onClick={() => setStart(addDays(start, 7))} className="px-3 py-2.5 hover:bg-stone-50 text-stone-500"><ChevronRight size={15} /></button>
                </div>
                <div className="hidden lg:flex ml-auto items-center gap-3.5 text-[11.5px] font-semibold text-stone-500">
                    <span><i className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-[-1px]" style={{ background: '#008737' }} />Paid</span>
                    <span><i className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-[-1px]" style={{ background: '#e8a13c' }} />Deposit</span>
                    <span><i className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-[-1px]" style={{ background: '#c75146' }} />Owing</span>
                    <span><i className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-[-1px]" style={{ background: '#8d7ab5' }} />Pending</span>
                    <span><i className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-[-1px]" style={{ background: '#02572a' }} />Checked in</span>
                </div>
            </div>

            {/* grid */}
            <div className="bg-white rounded-2xl border border-stone-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-x-auto">
                <div style={{ minWidth: gridWidth + 160 }}>
                    {/* header dates */}
                    <div className="flex sticky top-0 bg-white z-10 border-b border-stone-200">
                        <div className="w-24 sm:w-40 shrink-0 px-3 py-2 text-xs font-semibold text-stone-500 sticky left-0 bg-white z-20">Unit</div>
                        {dates.map(d => {
                            const day = new Date(d + 'T00:00:00');
                            const isToday = d === todayIso;
                            const isWeekend = [0, 6].includes(day.getDay());
                            return (
                                <div key={d} style={{ width: CELL_W }}
                                    className={`shrink-0 text-center py-1.5 text-[10px] leading-tight ${isToday ? 'bg-[#008737] text-white rounded-t' : isWeekend ? 'bg-stone-50 text-stone-500' : 'text-stone-500'}`}>
                                    <div className="font-semibold">{day.toLocaleDateString('en', { weekday: 'short' }).slice(0, 2)}</div>
                                    <div className="text-xs font-bold">{day.getDate()}</div>
                                </div>
                            );
                        })}
                    </div>

                    {groups.map(group => (
                        <div key={group.type.id}>
                            {/* type header with free counts */}
                            <div className="flex bg-[#f4f9f1] border-b border-stone-200">
                                <div className="w-24 sm:w-40 shrink-0 px-3 py-1.5 text-xs font-bold text-[#02572a] sticky left-0 bg-[#f4f9f1] z-10 leading-tight">
                                    {group.type.name}
                                    {group.type.price_per_night != null && (
                                        <span className="font-normal text-stone-400"> · {naira(group.type.price_per_night)}</span>
                                    )}
                                </div>
                                {dates.map(d => {
                                    const free = group.units.filter((u: any) => !occupancy.get(u.id)?.has(d)).length;
                                    return (
                                        <div key={d} style={{ width: CELL_W }}
                                            className={`shrink-0 text-center py-1.5 text-[10px] font-bold ${free === 0 ? 'text-[#c75146]' : 'text-[#008737]'}`}>
                                            {free}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* unit rows */}
                            {group.units.map((unit: any) => {
                                const unitBookings = (data?.bookings || []).filter((b: any) => b.room_id === unit.id);
                                const unitBlocks = (data?.blocks || []).filter((b: any) => b.room_id === unit.id);
                                return (
                                    <div key={unit.id} className="flex border-b border-stone-100 relative" style={{ height: 40 }}>
                                        <button
                                            type="button"
                                            onClick={() => setEditUnit(unit)}
                                            title="Edit this unit (name, code, price)"
                                            className="w-24 sm:w-40 shrink-0 px-3 flex flex-col justify-center text-left text-sm font-medium text-stone-700 border-r border-stone-100 sticky left-0 bg-white z-10 leading-tight hover:bg-stone-50 cursor-pointer">
                                            <span>{unit.unit_code || unit.name}</span>
                                            {group.type.price_per_night == null && typeById.get(unit.room_type_id) && (
                                                <span className="text-[10px] font-normal text-stone-400">
                                                    {typeById.get(unit.room_type_id).name} · {naira(typeById.get(unit.room_type_id).price_per_night)}
                                                </span>
                                            )}
                                        </button>
                                        {/* clickable empty cells */}
                                        <div className="relative" style={{ width: gridWidth }}>
                                            {dates.map((d, i) => {
                                                const taken = occupancy.get(unit.id)?.has(d);
                                                const isToday = d === todayIso;
                                                return (
                                                    <div key={d}
                                                        onClick={() => !taken && setNewBooking({ unitId: unit.id, date: d })}
                                                        className={`absolute top-0 bottom-0 border-r border-stone-50 ${isToday ? 'bg-[#7ed957]/10' : ''} ${taken ? '' : 'cursor-pointer hover:bg-[#7ed957]/20'}`}
                                                        style={{ left: i * CELL_W, width: CELL_W }}
                                                    />
                                                );
                                            })}
                                            {/* manual blocks */}
                                            {unitBlocks.map((blk: any) => {
                                                const idx = dates.indexOf(blk.date);
                                                if (idx < 0) return null;
                                                return (
                                                    <div key={`${blk.room_id}-${blk.date}`}
                                                        title={`${blk.status} — click to clear`}
                                                        onClick={async () => {
                                                            await fetch('/api/crm/blocks', {
                                                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ roomId: unit.id, from: blk.date, to: iso(addDays(new Date(blk.date + 'T00:00:00'), 1)), status: 'available' }),
                                                            });
                                                            load();
                                                        }}
                                                        className="absolute top-1.5 bottom-1.5 rounded cursor-pointer"
                                                        style={{
                                                            left: idx * CELL_W + 2, width: CELL_W - 4,
                                                            background: 'repeating-linear-gradient(45deg,#d6d3d1,#d6d3d1 4px,#e7e5e4 4px,#e7e5e4 8px)',
                                                        }}
                                                    />
                                                );
                                            })}
                                            {/* booking bars */}
                                            {unitBookings.map((b: any) => {
                                                const startIdx = Math.max(dates.indexOf(b.check_in), 0);
                                                const rawEnd = dates.indexOf(b.check_out);
                                                const endIdx = rawEnd === -1 ? (b.check_out > to ? DAYS : 0) : rawEnd;
                                                const span = Math.max(endIdx - startIdx, 1);
                                                if (b.check_out <= from || b.check_in >= to) return null;
                                                return (
                                                    <div key={b.id}
                                                        onClick={() => setOpenBooking(b.id)}
                                                        title={`${b.guest_name} · ${naira(b.total_amount)} (paid ${naira(b.paid)})`}
                                                        className="absolute top-1.5 bottom-1.5 rounded-md text-white text-[11px] font-semibold flex items-center px-2 cursor-pointer overflow-hidden whitespace-nowrap shadow-sm hover:brightness-110"
                                                        style={{ left: startIdx * CELL_W + 3, width: span * CELL_W - 6, background: barColor(b) }}>
                                                        {b.guest_name}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                    {groups.length === 0 && (
                        <p className="p-8 text-sm text-stone-400">No active units on this property yet.</p>
                    )}
                </div>
            </div>

            <p className="mt-3 text-xs text-stone-400">Click an empty cell to create a booking or block. The number row shows free units per day.</p>

            {openBooking && (
                <BookingModal bookingId={openBooking} onClose={() => setOpenBooking(null)} onChanged={load} />
            )}
            {newBooking && data && (
                <NewBookingModal
                    propertyId={propertyId}
                    unit={(data.units || []).find((u: any) => u.id === newBooking.unitId)}
                    roomType={(data.roomTypes || []).find((t: any) => t.id === (data.units || []).find((u: any) => u.id === newBooking.unitId)?.room_type_id)}
                    date={newBooking.date}
                    onClose={() => setNewBooking(null)}
                    onCreated={() => { setNewBooking(null); load(); }}
                />
            )}
            {editUnit && (
                <EditUnitModal
                    unit={editUnit}
                    onClose={() => setEditUnit(null)}
                    onSaved={() => { setEditUnit(null); load(); }}
                />
            )}
        </div>
    );
}

function EditUnitModal({ unit, onClose, onSaved }: {
    unit: any; onClose: () => void; onSaved: () => void;
}) {
    const [form, setForm] = useState({
        unitCode: unit.unit_code || '',
        name: unit.name || '',
        price: unit.price_per_night != null ? String(unit.price_per_night) : '',
        isActive: unit.is_active !== false,
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const save = async () => {
        if (!form.name.trim()) { setError('Name is required'); return; }
        setBusy(true); setError(null);
        try {
            const res = await fetch(`/api/crm/rooms/${unit.id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    unitCode: form.unitCode.trim() || null,
                    name: form.name.trim(),
                    pricePerNight: form.price === '' ? undefined : Number(form.price),
                    isActive: form.isActive,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to save');
            onSaved();
        } catch (e: any) {
            setError(e.message || 'Failed');
        } finally { setBusy(false); }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto py-10" onClick={onClose}>
            <div className="bg-white rounded-xl w-[440px] max-w-[94vw] shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-stone-200">
                    <h2 className="font-bold text-stone-900">Edit unit {unit.unit_code || unit.name}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-md hover:bg-stone-100"><X size={18} /></button>
                </div>

                {error && <p className="mx-6 mt-3 text-xs text-[#c75146] bg-red-50 rounded-md px-3 py-2">{error}</p>}

                <div className="px-6 py-4 grid grid-cols-2 gap-3 text-sm">
                    <label className="block">
                        <span className="text-xs text-stone-500">Unit code</span>
                        <input className="mt-1 w-full border border-stone-300 rounded-md px-2.5 py-1.5" value={form.unitCode} onChange={e => setForm({ ...form, unitCode: e.target.value })} />
                    </label>
                    <label className="block">
                        <span className="text-xs text-stone-500">Price / night (₦)</span>
                        <input type="number" min={0} className="mt-1 w-full border border-stone-300 rounded-md px-2.5 py-1.5" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
                    </label>
                    <label className="block col-span-2">
                        <span className="text-xs text-stone-500">Name</span>
                        <input className="mt-1 w-full border border-stone-300 rounded-md px-2.5 py-1.5" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                    </label>
                    <label className="col-span-2 flex items-center gap-2 mt-1">
                        <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
                        <span className="text-stone-700">Active (bookable &amp; shown on the site)</span>
                    </label>
                </div>

                <div className="flex justify-end gap-2 px-6 pb-5">
                    <button onClick={onClose} className="px-4 py-2 rounded-md border border-stone-300 text-sm">Cancel</button>
                    <button disabled={busy} onClick={save}
                        className="px-4 py-2 rounded-md bg-[#008737] text-white text-sm font-semibold disabled:opacity-50">
                        {busy ? 'Saving…' : 'Save unit'}
                    </button>
                </div>
            </div>
        </div>
    );
}

const SOURCES = ['whatsapp', 'phone', 'walk_in', 'website', 'referral', 'booking_com', 'airbnb', 'other'];

function NewBookingModal({ propertyId, unit, roomType, date, onClose, onCreated }: {
    propertyId: string; unit: any; roomType: any; date: string;
    onClose: () => void; onCreated: () => void;
}) {
    const [mode, setMode] = useState<'booking' | 'block'>('booking');
    const [form, setForm] = useState({
        guestName: '', guestPhone: '', guestEmail: '',
        checkIn: date, nights: 1,
        source: 'whatsapp', notes: '', deposit: '', price: '',
        blockStatus: 'maintenance',
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Nights-first: staff pick a check-in + number of nights; check-out and the
    // price fall out automatically.
    const nights = Math.max(Number(form.nights) || 0, 0);
    const checkOut = iso(addDays(new Date(form.checkIn + 'T00:00:00'), nights));
    const defaultPrice = roomType ? Number(roomType.price_per_night) * nights : 0;
    // Price auto-fills from the room type; blank input = use the auto price.
    const effectivePrice = form.price !== '' ? Number(form.price) : defaultPrice;
    const depositNum = Number(form.deposit) || 0;
    const balanceDue = Math.max(effectivePrice - depositNum, 0);

    const submit = async () => {
        setBusy(true); setError(null);
        try {
            if (mode === 'block') {
                const res = await fetch('/api/crm/blocks', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ roomId: unit.id, from: form.checkIn, to: checkOut, status: form.blockStatus }),
                });
                if (!res.ok) throw new Error((await res.json()).error);
                onCreated();
                return;
            }

            const res = await fetch('/api/bookings', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomId: unit.id, propertyId, mode: 'single',
                    guestName: form.guestName, guestPhone: form.guestPhone || null, guestEmail: form.guestEmail || null,
                    checkIn: form.checkIn, checkOut,
                    isManualBooking: true, bookingSource: form.source, notes: form.notes || null,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);

            // custom price and/or deposit recorded against the new booking
            const customPrice = form.price ? Number(form.price) : null;
            if (customPrice != null && customPrice !== defaultPrice) {
                await fetch(`/api/crm/bookings/${json.bookingId}`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ totalAmount: customPrice }),
                });
            }
            if (form.deposit && Number(form.deposit) > 0) {
                await fetch(`/api/crm/bookings/${json.bookingId}/payments`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount: Number(form.deposit), method: 'Bank Transfer', note: 'Deposit at booking' }),
                });
            }
            onCreated();
        } catch (e: any) {
            setError(e.message || 'Failed');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto py-10" onClick={onClose}>
            <div className="bg-white rounded-xl w-[520px] max-w-[94vw] shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-stone-200">
                    <div>
                        <h2 className="font-bold text-stone-900">
                            {mode === 'booking' ? 'New booking' : 'Block dates'} — Unit {unit?.unit_code || unit?.name}
                        </h2>
                        {roomType && <p className="text-xs text-stone-500 mt-0.5">{roomType.name} · {naira(roomType.price_per_night)}/night</p>}
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-md hover:bg-stone-100"><X size={18} /></button>
                </div>

                <div className="flex gap-2 px-6 pt-4">
                    <button onClick={() => setMode('booking')} className={`px-3 py-1.5 rounded-md text-xs font-semibold ${mode === 'booking' ? 'bg-[#008737] text-white' : 'bg-stone-100 text-stone-600'}`}>Booking</button>
                    <button onClick={() => setMode('block')} className={`px-3 py-1.5 rounded-md text-xs font-semibold ${mode === 'block' ? 'bg-stone-700 text-white' : 'bg-stone-100 text-stone-600'}`}>Block (cleaning / maintenance)</button>
                </div>

                {error && <p className="mx-6 mt-3 text-xs text-[#c75146] bg-red-50 rounded-md px-3 py-2">{error}</p>}

                <div className="px-4 sm:px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <label className="block">
                        <span className="text-xs text-stone-500">Check-in</span>
                        <input type="date" className="mt-1 w-full border border-stone-300 rounded-md px-2.5 py-1.5" value={form.checkIn} onChange={e => setForm({ ...form, checkIn: e.target.value })} />
                    </label>
                    <label className="block">
                        <span className="text-xs text-stone-500">Nights</span>
                        <input type="number" min={1} className="mt-1 w-full border border-stone-300 rounded-md px-2.5 py-1.5" value={form.nights} onChange={e => setForm({ ...form, nights: Number(e.target.value) })} />
                    </label>
                    <div className="sm:col-span-2 -mt-1 text-xs text-stone-500">
                        Check-out: <span className="font-semibold text-stone-700">{new Date(checkOut + 'T00:00:00').toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>

                    {mode === 'booking' ? (
                        <>
                            <label className="block sm:col-span-2">
                                <span className="text-xs text-stone-500">Guest name *</span>
                                <input className="mt-1 w-full border border-stone-300 rounded-md px-2.5 py-1.5" value={form.guestName} onChange={e => setForm({ ...form, guestName: e.target.value })} />
                            </label>
                            <label className="block">
                                <span className="text-xs text-stone-500">Phone / WhatsApp</span>
                                <input className="mt-1 w-full border border-stone-300 rounded-md px-2.5 py-1.5" value={form.guestPhone} onChange={e => setForm({ ...form, guestPhone: e.target.value })} />
                            </label>
                            <label className="block">
                                <span className="text-xs text-stone-500">Source</span>
                                <select className="mt-1 w-full border border-stone-300 rounded-md px-2 py-1.5 bg-white" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>
                                    {SOURCES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                                </select>
                            </label>
                            <label className="block">
                                <span className="text-xs text-stone-500">Price (₦) — auto for {nights} night{nights === 1 ? '' : 's'}</span>
                                <input type="number" placeholder={String(defaultPrice)} className="mt-1 w-full border border-stone-300 rounded-md px-2.5 py-1.5" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
                            </label>
                            <label className="block">
                                <span className="text-xs text-stone-500">Deposit now (₦) — optional</span>
                                <input type="number" className="mt-1 w-full border border-stone-300 rounded-md px-2.5 py-1.5" value={form.deposit} onChange={e => setForm({ ...form, deposit: e.target.value })} />
                            </label>
                            <label className="block sm:col-span-2">
                                <span className="text-xs text-stone-500">Notes</span>
                                <input className="mt-1 w-full border border-stone-300 rounded-md px-2.5 py-1.5" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                            </label>
                            <div className="sm:col-span-2 flex items-center justify-between rounded-md bg-stone-50 border border-stone-200 px-3 py-2 text-xs">
                                <span className="text-stone-500">Total <span className="font-semibold text-stone-800">{naira(effectivePrice)}</span></span>
                                {depositNum > 0 && <span className="text-stone-500">Deposit <span className="font-semibold text-[#008737]">{naira(depositNum)}</span></span>}
                                <span className="text-stone-500">Balance <span className={`font-semibold ${balanceDue > 0 ? 'text-[#c75146]' : 'text-stone-700'}`}>{naira(balanceDue)}</span></span>
                            </div>
                        </>
                    ) : (
                        <label className="block sm:col-span-2">
                            <span className="text-xs text-stone-500">Block reason</span>
                            <select className="mt-1 w-full border border-stone-300 rounded-md px-2 py-1.5 bg-white" value={form.blockStatus} onChange={e => setForm({ ...form, blockStatus: e.target.value })}>
                                <option value="maintenance">Maintenance</option>
                                <option value="cleaning">Cleaning</option>
                            </select>
                        </label>
                    )}

                    <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
                        <button onClick={onClose} className="px-4 py-2 rounded-md border border-stone-300 text-sm">Cancel</button>
                        <button
                            disabled={busy || nights === 0 || (mode === 'booking' && form.guestName.trim().length < 2)}
                            onClick={submit}
                            className="px-4 py-2 rounded-md bg-[#008737] text-white text-sm font-semibold disabled:opacity-50">
                            {busy ? 'Saving…' : mode === 'booking' ? 'Create booking' : 'Block dates'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
