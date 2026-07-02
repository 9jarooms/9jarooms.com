'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    CalendarDays, DollarSign, TrendingUp, Plus, Search, Settings2, Building2,
    LogIn, LogOut, BedDouble, Pencil, Ban, Trash2, RotateCcw, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
    CrmBooking, CrmProperty, CrmSource, roomLabel, naira, nights, stayState, todayISO,
} from './types';
import BookingFormModal from './BookingFormModal';
import ManageSourcesModal from './ManageSourcesModal';
import ManagePropertiesModal from './ManagePropertiesModal';

export default function BookingsCRM({
    initialBookings, properties, sources,
}: {
    initialBookings: CrmBooking[];
    properties: CrmProperty[];
    sources: CrmSource[];
}) {
    const router = useRouter();
    const today = todayISO();

    const propMap = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);
    const srcMap = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);

    // Modal state
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<CrmBooking | null>(null);
    const [sourcesOpen, setSourcesOpen] = useState(false);
    const [propsOpen, setPropsOpen] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);

    // Filters
    const [q, setQ] = useState('');
    const [fSource, setFSource] = useState('all');
    const [fProperty, setFProperty] = useState('all');
    const [fStatus, setFStatus] = useState('all');
    const [fFrom, setFFrom] = useState('');
    const [fTo, setFTo] = useState('');

    const confirmed = initialBookings.filter((b) => b.status === 'confirmed');

    // === Summary ===
    const totalRevenue = confirmed.reduce((s, b) => s + Number(b.amount_paid), 0);
    const monthPrefix = today.slice(0, 7);
    const monthRevenue = confirmed
        .filter((b) => b.check_in.slice(0, 7) === monthPrefix)
        .reduce((s, b) => s + Number(b.amount_paid), 0);

    // === Stays ===
    const stayingNow = confirmed.filter((b) => stayState(b, today) === 'staying');
    const arrivalsToday = confirmed.filter((b) => b.check_in === today);
    const checkoutsToday = confirmed.filter((b) => b.check_out === today);
    const upcoming = confirmed.filter((b) => stayState(b, today) === 'upcoming');

    // === Occupancy (today) ===
    const occupancy = properties.map((p) => {
        const booked = stayingNow
            .filter((b) => b.property_id === p.id)
            .reduce((s, b) => s + b.rooms_booked, 0);
        return { property: p, booked };
    });

    // === Revenue by source ===
    const bySource = (() => {
        const acc = new Map<string, { label: string; color: string | null; count: number; revenue: number }>();
        for (const b of confirmed) {
            const src = b.source_id ? srcMap.get(b.source_id) : null;
            const key = src?.id || 'none';
            const cur = acc.get(key) || { label: src?.label || 'Untagged', color: src?.color || null, count: 0, revenue: 0 };
            cur.count += 1;
            cur.revenue += Number(b.amount_paid);
            acc.set(key, cur);
        }
        return [...acc.values()].sort((a, b) => b.revenue - a.revenue);
    })();

    // === Filtered table ===
    const filtered = initialBookings.filter((b) => {
        if (fStatus !== 'all' && b.status !== fStatus) return false;
        if (fSource !== 'all') {
            if (fSource === 'none' ? b.source_id : b.source_id !== fSource) return false;
        }
        if (fProperty !== 'all') {
            if (fProperty === 'none' ? b.property_id : b.property_id !== fProperty) return false;
        }
        if (fFrom && b.check_in < fFrom) return false;
        if (fTo && b.check_in > fTo) return false;
        if (q.trim()) {
            const hay = `${b.guest_name} ${b.guest_email || ''} ${b.guest_phone || ''}`.toLowerCase();
            if (!hay.includes(q.trim().toLowerCase())) return false;
        }
        return true;
    });

    async function setStatus(b: CrmBooking, status: 'confirmed' | 'cancelled') {
        setBusyId(b.id);
        const res = await fetch(`/api/admin/crm/bookings/${b.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                guest_name: b.guest_name, guest_email: b.guest_email, guest_phone: b.guest_phone,
                property_id: b.property_id, rooms_booked: b.rooms_booked, check_in: b.check_in,
                check_out: b.check_out, amount_paid: b.amount_paid, source_id: b.source_id,
                status, notes: b.notes,
            }),
        });
        setBusyId(null);
        if (!res.ok) { alert((await res.json()).error || 'Failed'); return; }
        router.refresh();
    }

    async function remove(b: CrmBooking) {
        if (!confirm(`Delete booking for ${b.guest_name}? This cannot be undone.`)) return;
        setBusyId(b.id);
        const res = await fetch(`/api/admin/crm/bookings/${b.id}`, { method: 'DELETE' });
        setBusyId(null);
        if (!res.ok) { alert((await res.json()).error || 'Failed'); return; }
        router.refresh();
    }

    const statusColors: Record<string, string> = {
        confirmed: 'bg-green-50 text-green-700',
        cancelled: 'bg-red-50 text-red-600',
    };

    return (
        <div className="page-enter">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
                    <p className="text-gray-500 mt-1">{initialBookings.length} bookings tracked</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => setPropsOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50">
                        <Building2 size={16} /> Properties
                    </button>
                    <button onClick={() => setSourcesOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50">
                        <Settings2 size={16} /> Sources
                    </button>
                    <button onClick={() => { setEditing(null); setFormOpen(true); }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700">
                        <Plus size={16} /> Add Booking
                    </button>
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4 mb-4">
                <Card icon={CalendarDays} color="bg-amber-50 text-amber-600" label="Bookings (active)" value={String(confirmed.length)} />
                <Card icon={DollarSign} color="bg-green-50 text-green-600" label="Total Revenue" value={naira(totalRevenue)} />
                <Card icon={TrendingUp} color="bg-blue-50 text-blue-600" label="Revenue This Month" value={naira(monthRevenue)} />
            </div>

            {/* Stays strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4">
                <Stat icon={BedDouble} color="text-emerald-600" label="Staying now" value={stayingNow.length} />
                <Stat icon={LogIn} color="text-blue-600" label="Arrivals today" value={arrivalsToday.length} />
                <Stat icon={LogOut} color="text-amber-600" label="Checkouts today" value={checkoutsToday.length} />
                <Stat icon={CalendarDays} color="text-purple-600" label="Upcoming" value={upcoming.length} />
            </div>

            {/* Occupancy + Revenue by source */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-6">
                <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5">
                    <h3 className="font-semibold text-gray-900 text-sm mb-4">Occupancy today</h3>
                    {occupancy.length > 0 ? (
                        <div className="space-y-3">
                            {occupancy.map(({ property, booked }) => {
                                const pct = property.total_rooms > 0 ? Math.min(100, Math.round((booked / property.total_rooms) * 100)) : 0;
                                return (
                                    <div key={property.id}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-gray-700">{property.name}</span>
                                            <span className="text-sm font-bold text-gray-900">{booked} of {property.total_rooms}</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-2">
                                            <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400 text-center py-6">No properties yet — add one to track occupancy.</p>
                    )}
                </div>

                <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5">
                    <h3 className="font-semibold text-gray-900 text-sm mb-4">Revenue by source</h3>
                    {bySource.length > 0 ? (
                        <div className="space-y-3">
                            {bySource.map((s) => {
                                const pct = totalRevenue > 0 ? Math.round((s.revenue / totalRevenue) * 100) : 0;
                                return (
                                    <div key={s.label}>
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color || '#9ca3af' }} />
                                                <span className="text-sm font-medium text-gray-700">{s.label}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-gray-400">{s.count}</span>
                                                <span className="text-sm font-bold text-gray-900">{naira(s.revenue)}</span>
                                            </div>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-2">
                                            <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: s.color || '#9ca3af' }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400 text-center py-6">No revenue tracked yet.</p>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-100 p-3 sm:p-4 mb-3 flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[180px]">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone"
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-100" />
                </div>
                <select value={fProperty} onChange={(e) => setFProperty(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white">
                    <option value="all">All properties</option>
                    {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    <option value="none">— Unassigned</option>
                </select>
                <select value={fSource} onChange={(e) => setFSource(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white">
                    <option value="all">All sources</option>
                    {sources.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    <option value="none">— Untagged</option>
                </select>
                <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white">
                    <option value="all">All statuses</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="cancelled">Cancelled</option>
                </select>
                <input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} title="Check-in from"
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white" />
                <input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} title="Check-in to"
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white" />
                {(q || fSource !== 'all' || fProperty !== 'all' || fStatus !== 'all' || fFrom || fTo) && (
                    <button onClick={() => { setQ(''); setFSource('all'); setFProperty('all'); setFStatus('all'); setFFrom(''); setFTo(''); }}
                        className="flex items-center gap-1 px-2.5 py-2 text-sm text-gray-500 hover:text-gray-800">
                        <X size={14} /> Clear
                    </button>
                )}
            </div>

            {/* Table (desktop / tablet) */}
            <div className="hidden md:block bg-white rounded-xl border border-gray-100">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[920px]">
                        <thead>
                            <tr className="text-left text-gray-500 border-b border-gray-100">
                                <th className="px-5 py-3 font-medium whitespace-nowrap">Guest</th>
                                <th className="px-5 py-3 font-medium whitespace-nowrap">Property / Rooms</th>
                                <th className="px-5 py-3 font-medium whitespace-nowrap">Stay</th>
                                <th className="px-5 py-3 font-medium whitespace-nowrap">Amount</th>
                                <th className="px-5 py-3 font-medium whitespace-nowrap">Source</th>
                                <th className="px-5 py-3 font-medium whitespace-nowrap">Status</th>
                                <th className="px-5 py-3 font-medium whitespace-nowrap text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((b) => {
                                const prop = b.property_id ? propMap.get(b.property_id) : null;
                                const src = b.source_id ? srcMap.get(b.source_id) : null;
                                return (
                                    <tr key={b.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                                        <td className="px-5 py-3 whitespace-nowrap">
                                            <p className="font-medium text-gray-900">{b.guest_name}</p>
                                            {b.guest_email && <p className="text-xs text-gray-400">{b.guest_email}</p>}
                                            {b.guest_phone && <p className="text-xs text-gray-400">{b.guest_phone}</p>}
                                        </td>
                                        <td className="px-5 py-3 whitespace-nowrap">
                                            <p className="text-gray-700">{prop?.name || <span className="text-gray-400">—</span>}</p>
                                            <p className="text-xs text-gray-400">{roomLabel(b.rooms_booked)}</p>
                                        </td>
                                        <td className="px-5 py-3 text-gray-600 whitespace-nowrap">
                                            {b.check_in} → {b.check_out}
                                            <span className="text-xs text-gray-400 ml-1">({nights(b.check_in, b.check_out)}n)</span>
                                        </td>
                                        <td className="px-5 py-3 font-semibold text-gray-900 whitespace-nowrap">{naira(Number(b.amount_paid))}</td>
                                        <td className="px-5 py-3 whitespace-nowrap">
                                            {src ? (
                                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium" style={{ backgroundColor: (src.color || '#9ca3af') + '1a', color: src.color || '#6b7280' }}>
                                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: src.color || '#9ca3af' }} />
                                                    {src.label}
                                                </span>
                                            ) : <span className="text-gray-400 text-xs">Untagged</span>}
                                        </td>
                                        <td className="px-5 py-3 whitespace-nowrap">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[b.status]}`}>{b.status}</span>
                                        </td>
                                        <td className="px-5 py-3 whitespace-nowrap text-right">
                                            <div className="inline-flex items-center gap-1">
                                                <IconBtn title="Edit" onClick={() => { setEditing(b); setFormOpen(true); }} disabled={busyId === b.id}><Pencil size={15} /></IconBtn>
                                                {b.status === 'confirmed' ? (
                                                    <IconBtn title="Cancel" onClick={() => setStatus(b, 'cancelled')} disabled={busyId === b.id}><Ban size={15} /></IconBtn>
                                                ) : (
                                                    <IconBtn title="Restore" onClick={() => setStatus(b, 'confirmed')} disabled={busyId === b.id}><RotateCcw size={15} /></IconBtn>
                                                )}
                                                <IconBtn title="Delete" onClick={() => remove(b)} disabled={busyId === b.id} danger><Trash2 size={15} /></IconBtn>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && (
                                <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">
                                    {initialBookings.length === 0 ? 'No bookings yet — click “Add Booking” to start.' : 'No bookings match your filters.'}
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Cards (mobile) */}
            <div className="md:hidden space-y-3">
                {filtered.map((b) => {
                    const prop = b.property_id ? propMap.get(b.property_id) : null;
                    const src = b.source_id ? srcMap.get(b.source_id) : null;
                    return (
                        <div key={b.id} className="bg-white rounded-xl border border-gray-100 p-4">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="font-semibold text-gray-900 truncate">{b.guest_name}</p>
                                    {b.guest_phone && <p className="text-xs text-gray-400">{b.guest_phone}</p>}
                                    {b.guest_email && <p className="text-xs text-gray-400 truncate">{b.guest_email}</p>}
                                </div>
                                <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[b.status]}`}>{b.status}</span>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-y-3 gap-x-3">
                                <div>
                                    <p className="text-[10px] uppercase tracking-wide text-gray-400">Property</p>
                                    <p className="text-sm text-gray-700">{prop?.name || '—'}</p>
                                    <p className="text-xs text-gray-400">{roomLabel(b.rooms_booked)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase tracking-wide text-gray-400">Amount</p>
                                    <p className="text-sm font-semibold text-gray-900">{naira(Number(b.amount_paid))}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase tracking-wide text-gray-400">Stay</p>
                                    <p className="text-xs text-gray-600">{b.check_in} → {b.check_out}<span className="text-gray-400"> ({nights(b.check_in, b.check_out)}n)</span></p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase tracking-wide text-gray-400">Source</p>
                                    {src ? (
                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium" style={{ backgroundColor: (src.color || '#9ca3af') + '1a', color: src.color || '#6b7280' }}>
                                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: src.color || '#9ca3af' }} />
                                            {src.label}
                                        </span>
                                    ) : <span className="text-gray-400 text-xs">Untagged</span>}
                                </div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-end gap-1">
                                <IconBtn title="Edit" onClick={() => { setEditing(b); setFormOpen(true); }} disabled={busyId === b.id}><Pencil size={16} /></IconBtn>
                                {b.status === 'confirmed' ? (
                                    <IconBtn title="Cancel" onClick={() => setStatus(b, 'cancelled')} disabled={busyId === b.id}><Ban size={16} /></IconBtn>
                                ) : (
                                    <IconBtn title="Restore" onClick={() => setStatus(b, 'confirmed')} disabled={busyId === b.id}><RotateCcw size={16} /></IconBtn>
                                )}
                                <IconBtn title="Delete" onClick={() => remove(b)} disabled={busyId === b.id} danger><Trash2 size={16} /></IconBtn>
                            </div>
                        </div>
                    );
                })}
                {filtered.length === 0 && (
                    <div className="bg-white rounded-xl border border-gray-100 px-5 py-10 text-center text-gray-400">
                        {initialBookings.length === 0 ? 'No bookings yet — tap “Add Booking” to start.' : 'No bookings match your filters.'}
                    </div>
                )}
            </div>

            {formOpen && (
                <BookingFormModal
                    booking={editing}
                    properties={properties}
                    sources={sources}
                    onClose={() => setFormOpen(false)}
                    onSaved={() => { setFormOpen(false); router.refresh(); }}
                />
            )}
            {sourcesOpen && <ManageSourcesModal sources={sources} onClose={() => setSourcesOpen(false)} onChanged={() => router.refresh()} />}
            {propsOpen && <ManagePropertiesModal properties={properties} onClose={() => setPropsOpen(false)} onChanged={() => router.refresh()} />}
        </div>
    );
}

function Card({ icon: Icon, color, label, value }: { icon: LucideIcon; color: string; label: string; value: string }) {
    return (
        <div className="bg-white rounded-xl border border-gray-100 p-3 sm:p-4">
            <div className={`w-8 h-8 sm:w-10 sm:h-10 ${color} rounded-lg flex items-center justify-center mb-2 sm:mb-3`}>
                <Icon size={18} />
            </div>
            <p className="text-base sm:text-2xl font-bold text-gray-900 truncate">{value}</p>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 truncate">{label}</p>
        </div>
    );
}

function Stat({ icon: Icon, color, label, value }: { icon: LucideIcon; color: string; label: string; value: number }) {
    return (
        <div className="bg-white rounded-xl border border-gray-100 p-3 sm:p-4 flex items-center gap-3">
            <Icon size={20} className={color} />
            <div>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 leading-none">{value}</p>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-1">{label}</p>
            </div>
        </div>
    );
}

function IconBtn({ children, title, onClick, disabled, danger }: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
    return (
        <button title={title} onClick={onClick} disabled={disabled}
            className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${danger ? 'text-gray-400 hover:text-red-600 hover:bg-red-50' : 'text-gray-400 hover:text-gray-800 hover:bg-gray-100'}`}>
            {children}
        </button>
    );
}
