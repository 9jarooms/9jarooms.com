'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Globe, EyeOff, Layers, ImageOff, Pencil, X, RefreshCw } from 'lucide-react';
import { Sheet, BigButton, Field, Chips, inputCls, naira } from './shared';
import RoomTypeSheet from './RoomTypeSheet';

interface Unit { id: string; code: string; typeId: string | null; price: number | null }
interface Group { id: string; name: string; price: number; live: boolean; images: string[] }
interface Prop { id: string; name: string; area: string | null; live: boolean; photos: number; units: Unit[]; groups: Group[]; wholePrice: number | null; twoBedPrice: number | null }

// Rooms & prices: every room the team runs, grouped the way the website sells them.
// Rooms that are the same (same size, same price) go in one group: one name, one price, one set of
// photos, one listing on the website — a guest books the group and the app picks a free room.
// A room that is different stays in its own group. Select rooms -> "Group" -> pick or create a group.
export default function RoomGroups() {
    const [data, setData] = useState<Prop[] | null>(null);
    const [pid, setPid] = useState<string>('all');           // 'all' = every property
    const [view, setView] = useState<'groups' | 'price'>('groups');
    const [sel, setSel] = useState<Set<string>>(new Set());
    const [grouping, setGrouping] = useState(false);
    const [edit, setEdit] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        const res = await fetch('/api/crm/rooms', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) { setError(json.error || 'Could not load rooms'); return; }
        setData(json.properties);
        setPid(p => p === 'all' || json.properties.some((x: Prop) => x.id === p) ? p : 'all');
    }, []);
    useEffect(() => { load(); }, [load]);

    const prop = pid !== 'all' ? data?.find(p => p.id === pid) || null : null;
    const shown = useMemo(() => (data || []).filter(p => pid === 'all' || p.id === pid), [data, pid]);
    const propOfUnit = useMemo(() => new Map((data || []).flatMap(p => p.units.map(u => [u.id, p] as const))), [data]);
    const groupsOf = (p: Prop) => p.groups
        .map(g => ({ ...g, units: p.units.filter(u => u.typeId === g.id) }))
        .filter(g => g.units.length > 0);
    const looseOf = (p: Prop) => p.units.filter(u => !u.typeId || !p.groups.some(g => g.id === u.typeId));
    const priceOf = (p: Prop, u: Unit) => u.price ?? p.groups.find(g => g.id === u.typeId)?.price ?? null;

    // By price: every room with the same nightly rate side by side (within each property)
    const buckets = useMemo(() => {
        const m = new Map<number, Map<string, { prop: Prop; units: Unit[] }>>();
        for (const p of shown) for (const u of p.units) {
            const pr = priceOf(p, u) ?? 0;
            if (!m.has(pr)) m.set(pr, new Map());
            const byProp = m.get(pr)!;
            if (!byProp.has(p.id)) byProp.set(p.id, { prop: p, units: [] });
            byProp.get(p.id)!.units.push(u);
        }
        return [...m.entries()].sort((a, b) => b[0] - a[0]);
    }, [shown]);

    const toggle = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const selectMany = (ids: string[]) => setSel(s => {
        const n = new Set(s); const all = ids.every(i => n.has(i));
        ids.forEach(i => all ? n.delete(i) : n.add(i)); return n;
    });
    const selProps = [...new Set([...sel].map(id => propOfUnit.get(id)?.id).filter(Boolean))] as string[];
    const selProp = selProps.length === 1 ? data?.find(p => p.id === selProps[0]) || null : null;

    const setPropertyLive = async (p: Prop, live: boolean) => {
        setBusy(true); setError(null);
        const res = await fetch('/api/crm/properties', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId: p.id, isActive: live }) });
        setBusy(false);
        if (!res.ok) { setError((await res.json()).error || 'Could not update'); return; }
        load();
    };

    if (error && !data) return <p className="text-center text-gray-500 py-16">{error}</p>;
    if (!data) return <p className="text-center text-gray-400 py-16">Loading rooms…</p>;

    const editProp = edit ? data.find(p => p.groups.some(g => g.id === edit)) || null : null;
    const editing = edit && editProp ? editProp.groups.find(g => g.id === edit) : null;
    const totalRooms = shown.reduce((n, p) => n + p.units.length, 0);

    const groupCard = (p: Prop, g: Group & { units: Unit[] }) => (
        <div key={g.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="font-semibold text-[15px] text-gray-900 truncate">{g.name}</p>
                    <p className="text-[12.5px] text-gray-500 mt-0.5 flex flex-wrap items-center gap-x-2">
                        <span className="font-semibold text-gray-900 tabular-nums">{naira(g.price)}<span className="font-normal text-gray-400"> / night</span></span>
                        <span>{g.units.length} room{g.units.length === 1 ? '' : 's'}</span>
                        {g.live && p.live ? <span className="text-green-700 inline-flex items-center gap-1"><Globe size={11} /> on website</span>
                            : g.live ? <span className="text-gray-500 inline-flex items-center gap-1"><Globe size={11} /> shows once the property is live</span>
                            : <span className="text-amber-700 inline-flex items-center gap-1"><EyeOff size={11} /> hidden</span>}
                        {g.images.length === 0 && <span className="text-amber-700 inline-flex items-center gap-1"><ImageOff size={11} /> no photos</span>}
                    </p>
                </div>
                <button type="button" onClick={() => setEdit(g.id)} aria-label={`Edit ${g.name}`}
                    className="h-9 px-3 rounded-full border border-gray-200 text-[12.5px] font-medium text-gray-700 flex items-center gap-1.5 hover:border-gray-900 shrink-0">
                    <Pencil size={13} /> Photos & price
                </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
                {g.units.map(u => <UnitChip key={u.id} u={u} on={sel.has(u.id)} onTap={() => toggle(u.id)} />)}
            </div>
        </div>
    );

    return (
        <div className="max-w-3xl mx-auto pb-10">
            <div className="flex items-center gap-2 mb-2">
                <select value={pid} onChange={e => { setPid(e.target.value); setSel(new Set()); }}
                    className="flex-1 min-w-0 h-12 rounded-xl border border-gray-200 bg-white px-3 text-[16px] font-semibold text-gray-900 shadow-sm">
                    <option value="all">All rooms (every property)</option>
                    {data.map(p => <option key={p.id} value={p.id}>{p.name}{p.live ? '' : ' — not on website'}</option>)}
                </select>
                <button type="button" onClick={load} aria-label="Refresh" className="w-12 h-12 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-900 hover:text-white transition-all shrink-0"><RefreshCw size={18} /></button>
            </div>
            <div className="flex items-center justify-between gap-2 mb-4">
                <p className="text-[13px] text-gray-500 px-1">{totalRooms} rooms{pid === 'all' ? ` in ${shown.length} properties` : ''}</p>
                <Chips options={[{ value: 'groups', label: 'By group' }, { value: 'price', label: 'By price' }]} value={view} onChange={v => setView(v as 'groups' | 'price')} />
            </div>

            {error && <p className="text-[13px] text-red-600 bg-red-50 rounded-xl px-3 py-2 mb-3">{error}</p>}

            {prop && (
                <button type="button" onClick={() => setPropertyLive(prop, !prop.live)} disabled={busy}
                    className={`w-full rounded-2xl border px-4 py-3.5 flex items-center gap-3 text-left mb-5 ${prop.live ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white shadow-sm'}`}>
                    {prop.live ? <Globe size={20} className="text-green-600 shrink-0" /> : <EyeOff size={20} className="text-gray-400 shrink-0" />}
                    <span className="flex-1 min-w-0">
                        <span className="block font-semibold text-[15px] text-gray-900">{prop.live ? 'Property is live on the website' : 'Property is not on the website'}</span>
                        <span className="block text-[12.5px] text-gray-500">{prop.live ? 'Groups switched on below can be booked online.' : 'Group the rooms, set prices and photos, then switch it on.'}{prop.photos === 0 ? ' No property photos yet.' : ''}</span>
                    </span>
                    <span className={`w-12 h-7 rounded-full p-1 shrink-0 ${prop.live ? 'bg-green-500' : 'bg-gray-300'}`}><span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${prop.live ? 'translate-x-5' : ''}`} /></span>
                </button>
            )}
            {prop && <WholeFlat prop={prop} onSaved={load} />}

            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 px-1 mb-2">
                {view === 'price' ? 'Rooms at the same price, side by side. Tap to select, then Group' : 'Tap rooms to select them, then group them'}
            </p>

            {view === 'groups' ? (
                <div className="space-y-6">
                    {shown.map(p => {
                        const gs = groupsOf(p), loose = looseOf(p);
                        return (
                            <section key={p.id} className="space-y-3">
                                {pid === 'all' && (
                                    <div className="flex items-center justify-between gap-2 px-1">
                                        <h3 className="font-semibold text-[14px] text-gray-900 truncate">{p.name}</h3>
                                        <button type="button" onClick={() => { setPid(p.id); setSel(new Set()); }} className="text-[12px] font-medium text-green-700 shrink-0">
                                            {p.live ? 'Live' : 'Not on website'} · open →
                                        </button>
                                    </div>
                                )}
                                {gs.map(g => groupCard(p, g))}
                                {loose.length > 0 && (
                                    <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-4">
                                        <p className="font-semibold text-[14px] text-gray-900">Not in a group yet</p>
                                        <div className="mt-3 flex flex-wrap gap-2">{loose.map(u => <UnitChip key={u.id} u={u} on={sel.has(u.id)} onTap={() => toggle(u.id)} />)}</div>
                                    </div>
                                )}
                            </section>
                        );
                    })}
                </div>
            ) : (
                <div className="space-y-3">
                    {buckets.map(([price, byProp]) => (
                        <div key={price} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                            <p className="font-semibold text-[16px] text-gray-900 tabular-nums">{price ? naira(price) : 'No price yet'}<span className="font-normal text-gray-400 text-[13px]"> / night · {(() => { const n = [...byProp.values()].reduce((k, x) => k + x.units.length, 0); return `${n} room${n === 1 ? '' : 's'}`; })()}</span></p>
                            <div className="mt-2 space-y-3">
                                {[...byProp.values()].map(({ prop: p, units }) => (
                                    <div key={p.id}>
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-[12px] font-medium text-gray-500 truncate">{p.name}</p>
                                            <button type="button" onClick={() => selectMany(units.map(u => u.id))} className="text-[12px] font-semibold text-green-700 shrink-0">
                                                {units.every(u => sel.has(u.id)) ? 'Unselect' : `Select all ${units.length}`}
                                            </button>
                                        </div>
                                        <div className="mt-1.5 flex flex-wrap gap-2">
                                            {units.map(u => <UnitChip key={u.id} u={u} on={sel.has(u.id)} onTap={() => toggle(u.id)} />)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {sel.size > 0 && (
                <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:bottom-6 z-40 mt-4">
                    {selProps.length > 1 && (
                        <p className="mb-2 text-[12.5px] text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 shadow-sm">
                            You picked rooms from {selProps.length} properties. A group is one listing in one building, so pick rooms from one property at a time.
                        </p>
                    )}
                    <div className="flex items-center gap-2">
                        <div className="flex-1 h-14 rounded-full bg-gray-900 text-white px-5 flex items-center gap-3 shadow-lg min-w-0">
                            <span className="font-semibold text-[15px] truncate">{sel.size} selected{selProp && pid === 'all' ? ` · ${selProp.name}` : ''}</span>
                            <button type="button" onClick={() => setSel(new Set())} className="ml-auto text-white/70 flex items-center gap-1 text-[13px] shrink-0"><X size={14} /> Clear</button>
                        </div>
                        <button type="button" onClick={() => setGrouping(true)} disabled={!selProp}
                            className="h-14 px-6 rounded-full bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold text-[15px] shadow-lg shadow-green-500/30 flex items-center gap-2 disabled:from-gray-300 disabled:to-gray-300 disabled:shadow-none">
                            <Layers size={18} /> Group
                        </button>
                    </div>
                </div>
            )}

            {grouping && selProp && (
                <GroupSheet prop={selProp} units={selProp.units.filter(u => sel.has(u.id))} groups={groupsOf(selProp)}
                    onClose={() => setGrouping(false)}
                    onDone={() => { setGrouping(false); setSel(new Set()); load(); }} />
            )}
            {editing && editProp && (
                <RoomTypeSheet
                    type={{ id: editing.id, name: editing.name, price_per_night: editing.price, property_id: editProp.id, images: editing.images, is_active: editing.live }}
                    unitCount={editProp.units.filter(u => u.typeId === editing.id).length}
                    propertyName={editProp.name}
                    onClose={() => setEdit(null)}
                    onSaved={() => { setEdit(null); load(); }} />
            )}
        </div>
    );
}

function UnitChip({ u, on, onTap }: { u: Unit; on: boolean; onTap: () => void }) {
    return (
        <button type="button" onClick={onTap} aria-pressed={on}
            className={`h-10 min-w-[56px] px-3 rounded-full border text-[13.5px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${on ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-800 border-gray-200 hover:border-gray-900'}`}>
            {on && <Check size={14} />}{u.code}
        </button>
    );
}

function GroupSheet({ prop, units, groups, onClose, onDone }: {
    prop: Prop; units: Unit[]; groups: (Group & { units: Unit[] })[]; onClose: () => void; onDone: () => void;
}) {
    const [mode, setMode] = useState<'new' | 'existing'>(groups.length ? 'existing' : 'new');
    const [target, setTarget] = useState(groups[0]?.id || '');
    const [name, setName] = useState(units.length === 1 ? units[0].code : '');
    const [price, setPrice] = useState(units[0]?.price != null ? String(units[0].price) : '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const save = async () => {
        setBusy(true); setError(null);
        const body: Record<string, unknown> = { propertyId: prop.id, unitIds: units.map(u => u.id) };
        if (mode === 'existing') body.roomTypeId = target;
        else { body.name = name.trim(); body.pricePerNight = Number(price); }
        try {
            const res = await fetch('/api/crm/room-types/group', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Could not group');
            onDone();
        } catch (e: any) { setError(e?.message || 'Could not group'); } finally { setBusy(false); }
    };

    return (
        <Sheet title={`Group ${units.length} room${units.length === 1 ? '' : 's'}`} subtitle={units.map(u => u.code).join(', ')} onClose={onClose}>
            {error && <p className="text-[13px] text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
            {groups.length > 0 && (
                <Chips options={[{ value: 'existing', label: 'Add to a group' }, { value: 'new', label: 'New group' }]} value={mode} onChange={v => setMode(v as 'new' | 'existing')} />
            )}
            {mode === 'existing' ? (
                <Field label="Group" hint="The rooms take this group's price and photos.">
                    <select className={inputCls} value={target} onChange={e => setTarget(e.target.value)}>
                        {groups.map(g => <option key={g.id} value={g.id}>{g.name} · {naira(g.price)}/night · {g.units.length} rooms</option>)}
                    </select>
                </Field>
            ) : (
                <>
                    <Field label="Group name (shown on the website)">
                        <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Standard Room with Balcony" autoFocus />
                    </Field>
                    <Field label="Price per night (₦)" hint="Every room in the group gets this price.">
                        <input type="number" inputMode="numeric" min={0} className={inputCls} value={price} onChange={e => setPrice(e.target.value)} />
                    </Field>
                    <p className="text-[12.5px] text-gray-500 -mt-1">After grouping, tap <b>Photos & price</b> on the group to add its photos and switch it on the website.</p>
                </>
            )}
            <BigButton onClick={save} busy={busy} disabled={mode === 'new' ? !name.trim() || !(Number(price) > 0) : !target} icon={<Layers size={18} />}>
                Group {units.length} room{units.length === 1 ? '' : 's'}
            </BigButton>
        </Sheet>
    );
}

// Whole-flat booking: rooms whose codes share a flat number (1A, 1B, 1C = flat 1) can also be sold together
// as one apartment. Only shown when the property has such rooms. 2-bed = two rooms of the flat, the third kept empty.
function WholeFlat({ prop, onSaved }: { prop: Prop; onSaved: () => void }) {
    const flats = new Map<string, string[]>();
    for (const u of prop.units) {
        const m = u.code.match(/^(\d+)[A-Za-z]/);
        if (m) flats.set(m[1], [...(flats.get(m[1]) || []), u.code]);
    }
    const multi = [...flats.entries()].filter(([, codes]) => codes.length > 1);
    const [whole, setWhole] = useState(prop.wholePrice != null ? String(prop.wholePrice) : '');
    const [two, setTwo] = useState(prop.twoBedPrice != null ? String(prop.twoBedPrice) : '');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    useEffect(() => {
        setWhole(prop.wholePrice != null ? String(prop.wholePrice) : '');
        setTwo(prop.twoBedPrice != null ? String(prop.twoBedPrice) : '');
        setMsg(null);
    }, [prop.id, prop.wholePrice, prop.twoBedPrice]);
    if (multi.length === 0) return null;
    const hasThree = multi.some(([, c]) => c.length >= 3);

    const save = async () => {
        setBusy(true); setMsg(null);
        const res = await fetch('/api/crm/properties', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ propertyId: prop.id, wholeApartmentPrice: whole ? Number(whole) : null, twoBedPrice: hasThree && two ? Number(two) : null }) });
        setBusy(false);
        if (!res.ok) { setMsg((await res.json()).error || 'Could not save'); return; }
        setMsg('Saved'); onSaved();
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
            <p className="font-semibold text-[15px] text-gray-900">Whole flat booking</p>
            <p className="text-[12.5px] text-gray-500 mt-0.5">
                Rooms with the same flat number can also be booked together as one apartment
                ({multi.slice(0, 3).map(([n, c]) => `flat ${n}: ${c.join(', ')}`).join(' · ')}{multi.length > 3 ? ' …' : ''}).
                Leave empty to sell rooms only.
            </p>
            <div className={`grid gap-2 mt-3 ${hasThree ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <Field label="Whole flat, per night (₦)">
                    <input type="number" inputMode="numeric" min={0} className={inputCls} value={whole} onChange={e => setWhole(e.target.value)} placeholder="not offered" />
                </Field>
                {hasThree && (
                    <Field label="2 rooms of a flat (₦)">
                        <input type="number" inputMode="numeric" min={0} className={inputCls} value={two} onChange={e => setTwo(e.target.value)} placeholder="not offered" />
                    </Field>
                )}
            </div>
            <div className="flex items-center gap-3 mt-3">
                <button type="button" onClick={save} disabled={busy}
                    className="h-10 px-4 rounded-xl bg-gray-900 text-white text-[13.5px] font-semibold disabled:opacity-50">{busy ? 'Saving…' : 'Save flat prices'}</button>
                {msg && <span className={`text-[12.5px] ${msg === 'Saved' ? 'text-green-700' : 'text-red-600'}`}>{msg}</span>}
            </div>
        </div>
    );
}
