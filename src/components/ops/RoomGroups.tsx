'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Globe, EyeOff, Layers, ImageOff, Pencil, X, RefreshCw } from 'lucide-react';
import { Sheet, BigButton, Field, Chips, inputCls, naira } from './shared';
import RoomTypeSheet from './RoomTypeSheet';

interface Unit { id: string; code: string; typeId: string | null; price: number | null }
interface Group { id: string; name: string; price: number; live: boolean; images: string[] }
interface Prop { id: string; name: string; area: string | null; live: boolean; photos: number; units: Unit[]; groups: Group[] }

// Rooms & prices: every room the team runs, grouped the way the website sells them.
// Rooms that are the same (same size, same price) go in one group: one name, one price, one set of
// photos, one listing on the website — a guest books the group and the app picks a free room.
// A room that is different stays in its own group. Select rooms -> "Group" -> pick or create a group.
export default function RoomGroups() {
    const [data, setData] = useState<Prop[] | null>(null);
    const [pid, setPid] = useState<string>('');
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
        setPid(p => p && json.properties.some((x: Prop) => x.id === p) ? p : (json.properties[0]?.id || ''));
    }, []);
    useEffect(() => { load(); }, [load]);

    const prop = data?.find(p => p.id === pid) || null;
    const groups = useMemo(() => {
        if (!prop) return [];
        return prop.groups
            .map(g => ({ ...g, units: prop.units.filter(u => u.typeId === g.id) }))
            .filter(g => g.units.length > 0);
    }, [prop]);
    const loose = prop ? prop.units.filter(u => !u.typeId || !prop.groups.some(g => g.id === u.typeId)) : [];
    const toggle = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

    const setPropertyLive = async (live: boolean) => {
        if (!prop) return;
        setBusy(true); setError(null);
        const res = await fetch('/api/crm/properties', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId: prop.id, isActive: live }) });
        setBusy(false);
        if (!res.ok) { setError((await res.json()).error || 'Could not update'); return; }
        load();
    };

    if (error && !data) return <p className="text-center text-gray-500 py-16">{error}</p>;
    if (!data) return <p className="text-center text-gray-400 py-16">Loading rooms…</p>;

    const editing = edit && prop ? prop.groups.find(g => g.id === edit) : null;

    return (
        <div className="max-w-3xl mx-auto pb-10">
            <div className="flex items-center gap-2 mb-1">
                <select value={pid} onChange={e => { setPid(e.target.value); setSel(new Set()); }}
                    className="flex-1 min-w-0 h-12 rounded-xl border border-gray-200 bg-white px-3 text-[16px] font-semibold text-gray-900 shadow-sm">
                    {data.map(p => <option key={p.id} value={p.id}>{p.name}{p.live ? '' : ' — not on website'}</option>)}
                </select>
                <button type="button" onClick={load} aria-label="Refresh" className="w-12 h-12 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-900 hover:text-white transition-all shrink-0"><RefreshCw size={18} /></button>
            </div>
            <p className="text-[13px] text-gray-500 mb-4 px-1">{prop?.units.length} rooms · {groups.length} group{groups.length === 1 ? '' : 's'} on this property</p>

            {error && <p className="text-[13px] text-red-600 bg-red-50 rounded-xl px-3 py-2 mb-3">{error}</p>}

            {prop && (
                <button type="button" onClick={() => setPropertyLive(!prop.live)} disabled={busy}
                    className={`w-full rounded-2xl border px-4 py-3.5 flex items-center gap-3 text-left mb-5 ${prop.live ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white shadow-sm'}`}>
                    {prop.live ? <Globe size={20} className="text-green-600 shrink-0" /> : <EyeOff size={20} className="text-gray-400 shrink-0" />}
                    <span className="flex-1 min-w-0">
                        <span className="block font-semibold text-[15px] text-gray-900">{prop.live ? 'Property is live on the website' : 'Property is not on the website'}</span>
                        <span className="block text-[12.5px] text-gray-500">{prop.live ? 'Groups switched on below can be booked online.' : 'Group the rooms, set prices and photos, then switch it on.'}{prop.photos === 0 ? ' No property photos yet.' : ''}</span>
                    </span>
                    <span className={`w-12 h-7 rounded-full p-1 shrink-0 ${prop.live ? 'bg-green-500' : 'bg-gray-300'}`}><span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${prop.live ? 'translate-x-5' : ''}`} /></span>
                </button>
            )}

            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 px-1 mb-2">Tap rooms to select them, then group them</p>

            <div className="space-y-3">
                {groups.map(g => (
                    <div key={g.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="font-semibold text-[15px] text-gray-900 truncate">{g.name}</p>
                                <p className="text-[12.5px] text-gray-500 mt-0.5 flex flex-wrap items-center gap-x-2">
                                    <span className="font-semibold text-gray-900 tabular-nums">{naira(g.price)}<span className="font-normal text-gray-400"> / night</span></span>
                                    <span>{g.units.length} room{g.units.length === 1 ? '' : 's'}</span>
                                    {g.live && prop?.live ? <span className="text-green-700 inline-flex items-center gap-1"><Globe size={11} /> on website</span>
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
                ))}
                {loose.length > 0 && (
                    <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-4">
                        <p className="font-semibold text-[14px] text-gray-900">Not in a group yet</p>
                        <div className="mt-3 flex flex-wrap gap-2">{loose.map(u => <UnitChip key={u.id} u={u} on={sel.has(u.id)} onTap={() => toggle(u.id)} />)}</div>
                    </div>
                )}
            </div>

            {sel.size > 0 && (
                <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:bottom-6 z-40 mt-4">
                    <div className="flex items-center gap-2">
                        <div className="flex-1 h-14 rounded-full bg-gray-900 text-white px-5 flex items-center gap-3 shadow-lg">
                            <span className="font-semibold text-[15px]">{sel.size} selected</span>
                            <button type="button" onClick={() => setSel(new Set())} className="ml-auto text-white/70 flex items-center gap-1 text-[13px]"><X size={14} /> Clear</button>
                        </div>
                        <button type="button" onClick={() => setGrouping(true)}
                            className="h-14 px-6 rounded-full bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold text-[15px] shadow-lg shadow-green-500/30 flex items-center gap-2">
                            <Layers size={18} /> Group
                        </button>
                    </div>
                </div>
            )}

            {grouping && prop && (
                <GroupSheet prop={prop} units={prop.units.filter(u => sel.has(u.id))} groups={groups}
                    onClose={() => setGrouping(false)}
                    onDone={() => { setGrouping(false); setSel(new Set()); load(); }} />
            )}
            {editing && prop && (
                <RoomTypeSheet
                    type={{ id: editing.id, name: editing.name, price_per_night: editing.price, property_id: prop.id, images: editing.images, is_active: editing.live }}
                    unitCount={prop.units.filter(u => u.typeId === editing.id).length}
                    propertyName={prop.name}
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
