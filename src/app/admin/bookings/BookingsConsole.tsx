'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    CalendarDays, DollarSign, TrendingUp, Search, BedDouble,
    LogIn, LogOut, X, Plus, CheckCircle, Ban,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
    ConsoleBooking, ConsoleSource, BookingMode, MODE_LABEL, REVENUE_STATUSES,
    naira, nights, todayISO,
} from './types';
import LogBookingModal, { type ConsoleProperty } from './LogBookingModal';

// Sensible defaults for legacy booking_source values that predate the editable list.
const LEGACY_SOURCE_CONFIG: Record<string, { label: string; color: string }> = {
    website: { label: 'Website', color: '#16a34a' },
    whatsapp: { label: 'WhatsApp', color: '#059669' },
    operator: { label: 'Call Operator', color: '#2563eb' },
    caretaker: { label: 'Caretaker', color: '#7c3aed' },
    maintenance: { label: 'Maintenance', color: '#d97706' },
};

const UNTAGGED = { key: '__untagged__', label: 'Untagged', color: '#9ca3af' };

type SourceConfig = { key: string; label: string; color: string };

export default function BookingsConsole({
    bookings, sources, properties,
}: {
    bookings: ConsoleBooking[];
    sources: ConsoleSource[];
    properties: ConsoleProperty[];
}) {
    const router = useRouter();
    const today = todayISO();

    const [logOpen, setLogOpen] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);

    async function postAction(url: string, bookingId: string) {
        setBusyId(bookingId);
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingId }),
            });
            const data = await res.json();
            if (!res.ok) {
                alert(data.error || 'Request failed');
                return;
            }
            router.refresh();
        } catch {
            alert('Request failed');
        } finally {
            setBusyId(null);
        }
    }

    const markPaid = (b: ConsoleBooking) => {
        if (!confirm(`Mark ${b.guest_name}'s booking (${b.check_in} → ${b.check_out}) as paid?`)) return;
        postAction('/api/admin/bookings/confirm', b.id);
    };

    const cancelBooking = (b: ConsoleBooking) => {
        if (!confirm(`Cancel ${b.guest_name}'s booking (${b.check_in} → ${b.check_out})? This frees its rooms for new bookings.`)) return;
        postAction('/api/admin/bookings/cancel', b.id);
    };

    // Build a source-key → config map from the loaded list + legacy defaults.
    // Real bookings store the raw source string in `booking_source`; we normalise
    // by lowercased string so DB labels and legacy values collapse to one config.
    const sourceConfig = (() => {
        const map = new Map<string, SourceConfig>();
        for (const [key, cfg] of Object.entries(LEGACY_SOURCE_CONFIG)) {
            map.set(key, { key, label: cfg.label, color: cfg.color });
        }
        for (const s of sources) {
            const key = s.label.toLowerCase();
            map.set(key, { key, label: s.label, color: s.color || '#9ca3af' });
        }
        return map;
    })();

    const configFor = (raw: string | null): SourceConfig => {
        if (!raw) return UNTAGGED;
        const key = raw.toLowerCase();
        return sourceConfig.get(key) || { key, label: raw, color: '#9ca3af' };
    };

    // Filters
    const [q, setQ] = useState('');
    const [fSource, setFSource] = useState('all');
    const [fProperty, setFProperty] = useState('all');
    const [fStatus, setFStatus] = useState('all');
    const [fMode, setFMode] = useState('all');
    const [fFrom, setFFrom] = useState('');
    const [fTo, setFTo] = useState('');

    const isRevenue = (b: ConsoleBooking) =>
        (REVENUE_STATUSES as readonly string[]).includes(b.status);
    const earning = bookings.filter(isRevenue);

    // === Summary ===
    const totalRevenue = earning.reduce((s, b) => s + Number(b.total_amount), 0);
    const monthPrefix = today.slice(0, 7);
    const monthRevenue = earning
        .filter((b) => b.check_in?.slice(0, 7) === monthPrefix)
        .reduce((s, b) => s + Number(b.total_amount), 0);

    // === Stays strip ===
    const stayingNow = earning.filter((b) => b.check_in <= today && today < b.check_out);
    const arrivalsToday = earning.filter((b) => b.check_in === today);
    const checkoutsToday = earning.filter((b) => b.check_out === today);
    const upcoming = earning.filter((b) => b.check_in > today);

    // === Revenue by source ===
    const bySource = (() => {
        const acc = new Map<string, { label: string; color: string; count: number; revenue: number }>();
        for (const b of earning) {
            const cfg = configFor(b.booking_source);
            const cur = acc.get(cfg.key) || { label: cfg.label, color: cfg.color, count: 0, revenue: 0 };
            cur.count += 1;
            cur.revenue += Number(b.total_amount);
            acc.set(cfg.key, cur);
        }
        return [...acc.values()].sort((a, b) => b.revenue - a.revenue);
    })();

    // Distinct properties present in the loaded rows (for the property filter).
    const propertyOptions = (() => {
        const map = new Map<string, string>();
        for (const b of bookings) {
            if (b.property_id) map.set(b.property_id, b.property?.name || 'Unnamed property');
        }
        return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    })();

    // Source filter options = loaded sources + any legacy/raw values actually present.
    const sourceFilterOptions = (() => {
        const map = new Map<string, string>();
        for (const s of sources) map.set(s.label.toLowerCase(), s.label);
        for (const b of bookings) {
            const cfg = configFor(b.booking_source);
            if (cfg.key !== UNTAGGED.key) map.set(cfg.key, cfg.label);
        }
        return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    })();

    // === Filtered table ===
    const filtered = bookings.filter((b) => {
        if (fStatus !== 'all' && b.status !== fStatus) return false;
        if (fMode !== 'all' && b.booking_mode !== fMode) return false;
        if (fProperty !== 'all' && b.property_id !== fProperty) return false;
        if (fSource !== 'all') {
            const cfg = configFor(b.booking_source);
            if (fSource === UNTAGGED.key ? cfg.key !== UNTAGGED.key : cfg.key !== fSource) return false;
        }
        if (fFrom && b.check_in < fFrom) return false;
        if (fTo && b.check_in > fTo) return false;
        if (q.trim()) {
            const hay = `${b.guest_name} ${b.guest_email || ''} ${b.guest_phone || ''}`.toLowerCase();
            if (!hay.includes(q.trim().toLowerCase())) return false;
        }
        return true;
    });

    const statusColors: Record<string, string> = {
        pending: 'bg-amber-50 text-amber-700',
        paid: 'bg-green-50 text-green-700',
        cancelled: 'bg-red-50 text-red-600',
        completed: 'bg-blue-50 text-blue-700',
        expired: 'bg-gray-100 text-gray-500',
        confirmed: 'bg-emerald-50 text-emerald-700',
    };

    const roomsLabel = (b: ConsoleBooking): string => {
        const count = b.booking_rooms?.length || 0;
        if (b.booking_mode === 'single') return b.room?.name || (count > 0 ? `${count} room` : '1 room');
        if (count > 1) return `${count} rooms`;
        return b.room?.name || `${count || 1} room${(count || 1) > 1 ? 's' : ''}`;
    };

    return (
        <div className="page-enter">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
                    <p className="text-gray-500 mt-1">{bookings.length} bookings</p>
                </div>
                <button onClick={() => setLogOpen(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700">
                    <Plus size={16} /> Log Booking
                </button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4 mb-4">
                <Card icon={CalendarDays} color="bg-amber-50 text-amber-600" label="Total Bookings" value={String(bookings.length)} />
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

            {/* Revenue by source */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5 mb-6">
                <h3 className="font-semibold text-gray-900 text-sm mb-4">Revenue by source</h3>
                {bySource.length > 0 ? (
                    <div className="space-y-3">
                        {bySource.map((s) => {
                            const pct = totalRevenue > 0 ? Math.round((s.revenue / totalRevenue) * 100) : 0;
                            return (
                                <div key={s.label}>
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                                            <span className="text-sm font-medium text-gray-700">{s.label}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-gray-400">{s.count}</span>
                                            <span className="text-sm font-bold text-gray-900">{naira(s.revenue)}</span>
                                        </div>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2">
                                        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-sm text-gray-400 text-center py-6">No revenue tracked yet.</p>
                )}
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
                    {propertyOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
                <select value={fSource} onChange={(e) => setFSource(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white">
                    <option value="all">All sources</option>
                    {sourceFilterOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                    <option value={UNTAGGED.key}>— Untagged</option>
                </select>
                <select value={fMode} onChange={(e) => setFMode(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white">
                    <option value="all">All modes</option>
                    <option value="single">Single</option>
                    <option value="two_bed">2-Bed</option>
                    <option value="whole">Whole</option>
                </select>
                <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white">
                    <option value="all">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="expired">Expired</option>
                </select>
                <input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} title="Check-in from"
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white" />
                <input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} title="Check-in to"
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white" />
                {(q || fSource !== 'all' || fProperty !== 'all' || fStatus !== 'all' || fMode !== 'all' || fFrom || fTo) && (
                    <button onClick={() => { setQ(''); setFSource('all'); setFProperty('all'); setFStatus('all'); setFMode('all'); setFFrom(''); setFTo(''); }}
                        className="flex items-center gap-1 px-2.5 py-2 text-sm text-gray-500 hover:text-gray-800">
                        <X size={14} /> Clear
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-100">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[980px]">
                        <thead>
                            <tr className="text-left text-gray-500 border-b border-gray-100">
                                <th className="px-5 py-3 font-medium whitespace-nowrap">Guest</th>
                                <th className="px-5 py-3 font-medium whitespace-nowrap">Property</th>
                                <th className="px-5 py-3 font-medium whitespace-nowrap">Rooms / Mode</th>
                                <th className="px-5 py-3 font-medium whitespace-nowrap">Stay</th>
                                <th className="px-5 py-3 font-medium whitespace-nowrap">Amount</th>
                                <th className="px-5 py-3 font-medium whitespace-nowrap">Source</th>
                                <th className="px-5 py-3 font-medium whitespace-nowrap">Status</th>
                                <th className="px-5 py-3 font-medium whitespace-nowrap text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((b) => {
                                const cfg = configFor(b.booking_source);
                                const tagged = cfg.key !== UNTAGGED.key;
                                return (
                                    <tr key={b.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                                        <td className="px-5 py-3 whitespace-nowrap">
                                            <p className="font-medium text-gray-900">{b.guest_name}</p>
                                            {b.guest_email && <p className="text-xs text-gray-400">{b.guest_email}</p>}
                                            {b.guest_phone && <p className="text-xs text-gray-400">{b.guest_phone}</p>}
                                        </td>
                                        <td className="px-5 py-3 whitespace-nowrap">
                                            <p className="text-gray-700">{b.property?.name || <span className="text-gray-400">—</span>}</p>
                                            {b.property?.area && <p className="text-xs text-gray-400">{b.property.area}</p>}
                                        </td>
                                        <td className="px-5 py-3 whitespace-nowrap">
                                            <p className="text-gray-700">{MODE_LABEL[b.booking_mode as BookingMode] || b.booking_mode}</p>
                                            <p className="text-xs text-gray-400">{roomsLabel(b)}</p>
                                        </td>
                                        <td className="px-5 py-3 text-gray-600 whitespace-nowrap">
                                            {b.check_in} → {b.check_out}
                                            <span className="text-xs text-gray-400 ml-1">({b.nights ?? nights(b.check_in, b.check_out)}n)</span>
                                        </td>
                                        <td className="px-5 py-3 font-semibold text-gray-900 whitespace-nowrap">{naira(Number(b.total_amount))}</td>
                                        <td className="px-5 py-3 whitespace-nowrap">
                                            {tagged ? (
                                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium" style={{ backgroundColor: cfg.color + '1a', color: cfg.color }}>
                                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                                                    {cfg.label}
                                                </span>
                                            ) : <span className="text-gray-400 text-xs">Untagged</span>}
                                        </td>
                                        <td className="px-5 py-3 whitespace-nowrap">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[b.status] || 'bg-gray-100 text-gray-500'}`}>{b.status}</span>
                                        </td>
                                        <td className="px-5 py-3 whitespace-nowrap">
                                            <div className="flex items-center justify-end gap-1">
                                                {(b.status === 'pending' || b.status === 'confirmed') && (
                                                    <IconBtn title="Mark paid" onClick={() => markPaid(b)} disabled={busyId === b.id}>
                                                        <CheckCircle size={15} />
                                                    </IconBtn>
                                                )}
                                                {b.status !== 'cancelled' && (
                                                    <IconBtn title="Cancel booking" onClick={() => cancelBooking(b)} disabled={busyId === b.id} danger>
                                                        <Ban size={15} />
                                                    </IconBtn>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && (
                                <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-400">
                                    {bookings.length === 0 ? 'No bookings yet.' : 'No bookings match your filters.'}
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {logOpen && (
                <LogBookingModal properties={properties} sources={sources} onClose={() => setLogOpen(false)} />
            )}
        </div>
    );
}

function IconBtn({ children, title, onClick, disabled, danger }: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
    return (
        <button title={title} onClick={onClick} disabled={disabled}
            className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${danger ? 'text-gray-400 hover:text-red-600 hover:bg-red-50' : 'text-gray-400 hover:text-emerald-700 hover:bg-emerald-50'}`}>
            {children}
        </button>
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
