'use client';

import { useEffect, type ReactNode } from 'react';
import { X, Minus, Plus, Phone, MessageCircle, LogIn, LogOut, AlertTriangle } from 'lucide-react';

// ------------------------------------------------------------------
// Types — mirror what /api/ops/today returns
// ------------------------------------------------------------------
export interface OpsProperty { id: string; name: string; area: string | null }
export interface OpsRoomType { id: string; name: string; price_per_night: number | string | null }
export interface OpsUnit {
    id: string; name: string; unit_code: string | null;
    room_type_id: string | null; price_per_night: number | string | null;
}
export interface OpsBooking {
    id: string; room_id: string; room_type_id: string | null; property_id: string;
    guest_name: string; guest_phone: string | null; guest_email: string | null;
    check_in: string; check_out: string; nights: number; status: string;
    total_amount: number | string; paid: number;
    booking_source: string | null; notes: string | null;
    adults?: number | null; children?: number | null;
    checked_in_at?: string | null; checked_out_at?: string | null;
    room?: { unit_code: string | null; name: string } | null;
    property?: { id: string; name: string } | null;
}
export interface OpsBlock { room_id: string; date: string; status: string }
export interface OpsHeld { room_id: string; date: string; booking_id: string }
export type OpsRole = 'admin' | 'customer_rep' | 'caretaker';
export interface OpsToday {
    today: string; role: OpsRole;
    properties: OpsProperty[]; propertyId: string | null;
    roomTypes: OpsRoomType[]; units: OpsUnit[];
    bookings: OpsBooking[]; blocks: OpsBlock[]; held: OpsHeld[];
}
export type UnitKind = 'free' | 'occupied' | 'arriving' | 'cleaning' | 'maintenance';
export interface UnitState { kind: UnitKind; booking?: OpsBooking }

// ------------------------------------------------------------------
// Dates & money — all local-date, string based (WAT-safe)
// ------------------------------------------------------------------
export function iso(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function isoToday() { return iso(new Date()); }
export function parseIso(s: string) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
}
export function shiftIso(s: string, days: number) {
    const d = parseIso(s);
    d.setDate(d.getDate() + days);
    return iso(d);
}
export function nightsBetween(a: string, b: string) {
    return Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / 86400000);
}
export function fmtDay(s: string, opts: { year?: boolean } = {}) {
    if (!s) return '—';
    return parseIso(s).toLocaleDateString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short',
        ...(opts.year ? { year: 'numeric' } : {}),
    });
}
export function relDay(s: string, today: string) {
    if (s === today) return 'Today';
    if (s === shiftIso(today, 1)) return 'Tomorrow';
    if (s === shiftIso(today, -1)) return 'Yesterday';
    return fmtDay(s);
}
// "today" / "tomorrow" / "on Fri 12 Sept" — for mid-sentence use
export function relDayLower(s: string, today: string) {
    const r = relDay(s, today);
    return ['Today', 'Yesterday', 'Tomorrow'].includes(r) ? r.toLowerCase() : `on ${r}`;
}
export function naira(n: number | string | null | undefined) {
    return '₦' + Math.round(Number(n || 0)).toLocaleString('en-NG');
}
export function balanceOf(b: { total_amount: number | string; paid: number }) {
    return Math.max(Number(b.total_amount) - Number(b.paid || 0), 0);
}
export function owes(b: { total_amount: number | string; paid: number; status: string }) {
    return balanceOf(b) > 0 && !['cancelled', 'no_show', 'expired'].includes(b.status);
}

// ------------------------------------------------------------------
// Contact links
// ------------------------------------------------------------------
export function phoneDigits(phone: string | null | undefined) {
    if (!phone) return null;
    let digits = phone.replace(/[^0-9]/g, '');
    if (!digits) return null;
    if (digits.startsWith('0')) digits = '234' + digits.slice(1);
    if (!digits.startsWith('234') && digits.length === 10) digits = '234' + digits;
    return digits;
}
export function telLink(phone: string | null | undefined) {
    const d = phoneDigits(phone);
    return d ? `tel:+${d}` : null;
}
export function waLink(phone: string | null | undefined, text: string) {
    const d = phoneDigits(phone);
    return d ? `https://wa.me/${d}?text=${encodeURIComponent(text)}` : null;
}

// ------------------------------------------------------------------
// Status vocab
// ------------------------------------------------------------------
export const LIVE_STATUSES = ['pending', 'confirmed', 'paid', 'checked_in'];
export const STATUS_LABEL: Record<string, string> = {
    pending: 'Pending', confirmed: 'Confirmed', paid: 'Paid', checked_in: 'In house',
    completed: 'Checked out', cancelled: 'Cancelled', no_show: 'No show', expired: 'Expired',
};
export const STATUS_STYLE: Record<string, string> = {
    pending: 'bg-purple-100 text-purple-700',
    confirmed: 'bg-amber-100 text-amber-800',
    paid: 'bg-green-100 text-green-800',
    checked_in: 'bg-[#02572a] text-white',
    completed: 'bg-stone-200 text-stone-600',
    cancelled: 'bg-red-100 text-red-700',
    no_show: 'bg-stone-100 text-stone-500',
    expired: 'bg-stone-100 text-stone-500',
};
export const UNIT_KIND_LABEL: Record<UnitKind, string> = {
    free: 'Free', occupied: 'Occupied', arriving: 'Arriving', cleaning: 'Cleaning', maintenance: 'Maintenance',
};
export const UNIT_KIND_STYLE: Record<UnitKind, string> = {
    free: 'bg-green-100 text-green-800',
    occupied: 'bg-[#02572a] text-white',
    arriving: 'bg-amber-100 text-amber-800',
    cleaning: 'bg-blue-100 text-blue-800',
    maintenance: 'bg-stone-200 text-stone-700',
};

export function unitLabel(u: { unit_code?: string | null; name?: string | null } | null | undefined) {
    if (!u) return '—';
    return u.unit_code || u.name || '—';
}

// ------------------------------------------------------------------
// Unit grouping — same rule as the CRM calendar: duplex properties
// (codes like 1A/1B/1C) group by unit number, everything else by type.
// ------------------------------------------------------------------
export interface UnitGroup { key: string; label: string; price: number | null; units: OpsUnit[] }
export function groupUnits(units: OpsUnit[], roomTypes: OpsRoomType[]): UnitGroup[] {
    const isDuplex = units.length > 0 && units.every(u => /^\d+[A-Za-z]/.test(u.unit_code || ''));
    if (isDuplex) {
        const byNo = new Map<string, OpsUnit[]>();
        for (const u of units) {
            const n = (u.unit_code || '').match(/^(\d+)/)![1];
            if (!byNo.has(n)) byNo.set(n, []);
            byNo.get(n)!.push(u);
        }
        return [...byNo.entries()]
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([n, list]) => ({
                key: `unit-${n}`, label: `Unit ${n}`, price: null,
                units: list.sort((a, b) => (a.unit_code || '').localeCompare(b.unit_code || '')),
            }));
    }
    const groups: UnitGroup[] = roomTypes
        .map(t => ({
            key: t.id, label: t.name,
            price: t.price_per_night == null ? null : Number(t.price_per_night),
            units: units.filter(u => u.room_type_id === t.id),
        }))
        .filter(g => g.units.length > 0);
    const untyped = units.filter(u => !u.room_type_id || !roomTypes.some(t => t.id === u.room_type_id));
    if (untyped.length) groups.push({ key: '_none', label: 'Rooms', price: null, units: untyped });
    return groups;
}
export function unitPrice(u: OpsUnit, roomTypes: OpsRoomType[]): number | null {
    if (u.price_per_night != null && u.price_per_night !== '') return Number(u.price_per_night);
    const t = roomTypes.find(rt => rt.id === u.room_type_id);
    return t && t.price_per_night != null ? Number(t.price_per_night) : null;
}

// ------------------------------------------------------------------
// UI atoms — big touch targets, 16px inputs (no iOS zoom)
// ------------------------------------------------------------------
export const inputCls = 'w-full rounded-xl border border-stone-300 bg-white px-3.5 py-3 text-[16px] text-stone-900 outline-none focus:border-[#008737] focus:ring-2 focus:ring-[#008737]/20';

export function StatusPill({ status }: { status: string }) {
    return (
        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10.5px] font-bold whitespace-nowrap ${STATUS_STYLE[status] || 'bg-stone-100 text-stone-600'}`}>
            {STATUS_LABEL[status] || status.replace('_', ' ')}
        </span>
    );
}
export function KindPill({ kind }: { kind: UnitKind }) {
    return (
        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10.5px] font-bold whitespace-nowrap ${UNIT_KIND_STYLE[kind]}`}>
            {UNIT_KIND_LABEL[kind]}
        </span>
    );
}

const TONE: Record<string, string> = {
    primary: 'bg-[#008737] text-white active:bg-[#00762e]',
    dark: 'bg-[#02572a] text-white active:bg-[#03471f]',
    amber: 'bg-amber-500 text-white active:bg-amber-600',
    secondary: 'bg-white border border-stone-300 text-stone-800 active:bg-stone-50',
    danger: 'bg-white border border-[#c75146]/40 text-[#c75146] active:bg-red-50',
};
export function BigButton({ children, onClick, tone = 'primary', disabled, busy, icon, className = '' }: {
    children: ReactNode; onClick?: () => void;
    tone?: 'primary' | 'dark' | 'amber' | 'secondary' | 'danger';
    disabled?: boolean; busy?: boolean; icon?: ReactNode; className?: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled || busy}
            className={`h-12 w-full rounded-xl font-bold text-[15px] flex items-center justify-center gap-2 disabled:opacity-50 transition-colors ${TONE[tone]} ${className}`}
        >
            {busy ? 'Please wait…' : <>{icon}{children}</>}
        </button>
    );
}

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
    return (
        <div>
            <span className="block text-[12px] font-semibold text-stone-600 mb-1.5">{label}</span>
            {children}
            {hint && <span className="block text-[12px] text-stone-400 mt-1">{hint}</span>}
        </div>
    );
}

export function Stepper({ value, onChange, min = 1, max = 90 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
    return (
        <div className="inline-flex items-center rounded-xl border border-stone-300 bg-white overflow-hidden">
            <button type="button" aria-label="Fewer" onClick={() => onChange(Math.max(min, value - 1))} className="w-11 h-11 flex items-center justify-center active:bg-stone-100"><Minus size={16} /></button>
            <span className="w-12 text-center font-bold text-[16px] tabular-nums">{value}</span>
            <button type="button" aria-label="More" onClick={() => onChange(Math.min(max, value + 1))} className="w-11 h-11 flex items-center justify-center active:bg-stone-100"><Plus size={16} /></button>
        </div>
    );
}

export function Chips({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
    return (
        <div className="flex flex-wrap gap-2">
            {options.map(o => (
                <button
                    key={o.value}
                    type="button"
                    onClick={() => onChange(o.value)}
                    className={`px-3.5 h-10 rounded-full text-[13px] font-semibold border transition-colors ${value === o.value ? 'bg-[#02572a] text-white border-[#02572a]' : 'bg-white text-stone-600 border-stone-300 active:bg-stone-50'}`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

// Bottom sheet on phones, centred dialog on larger screens.
export function Sheet({ title, subtitle, right, onClose, children }: {
    title: ReactNode; subtitle?: ReactNode; right?: ReactNode; onClose: () => void; children: ReactNode;
}) {
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = prev;
            window.removeEventListener('keydown', onKey);
        };
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="sm:hidden absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-stone-300" />
                <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-stone-200">
                    <div className="min-w-0">
                        <h2 className="font-extrabold text-[18px] text-stone-900 leading-tight truncate">{title}</h2>
                        {subtitle && <p className="text-[13px] text-stone-500 mt-0.5">{subtitle}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {right}
                        <button type="button" onClick={onClose} aria-label="Close" className="p-2 -mr-2 rounded-full active:bg-stone-100"><X size={20} /></button>
                    </div>
                </div>
                <div className="overflow-y-auto px-5 py-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-4">
                    {children}
                </div>
            </div>
        </div>
    );
}

export function ContactButtons({ phone, name, message, compact }: {
    phone: string | null | undefined; name: string; message?: string; compact?: boolean;
}) {
    const tel = telLink(phone);
    const wa = waLink(phone, message || `Hello ${name}, this is 9jaRooms.`);
    if (!tel || !wa) {
        return compact ? null : <p className="text-[13px] text-stone-400">No phone number on this booking.</p>;
    }
    if (compact) {
        return (
            <div className="flex items-center gap-2">
                <a href={tel} aria-label="Call guest" className="w-10 h-10 rounded-xl border border-stone-200 bg-white flex items-center justify-center text-stone-700 active:bg-stone-50"><Phone size={16} /></a>
                <a href={wa} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp guest" className="w-10 h-10 rounded-xl bg-[#25D366] text-white flex items-center justify-center"><MessageCircle size={17} /></a>
            </div>
        );
    }
    return (
        <div className="grid grid-cols-2 gap-2">
            <a href={tel} className="h-12 rounded-xl border border-stone-300 bg-white flex items-center justify-center gap-2 font-bold text-[14px] text-stone-800 active:bg-stone-50"><Phone size={17} /> Call</a>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="h-12 rounded-xl bg-[#25D366] text-white flex items-center justify-center gap-2 font-bold text-[14px]"><MessageCircle size={18} /> WhatsApp</a>
        </div>
    );
}

// One booking as a card. Tap the body to open it; check-in / check-out are
// one tap from the list so the common case never needs the full sheet.
export function BookingCard({ b, today, unit, onOpen, onCheckIn, onCheckOut, busy }: {
    b: OpsBooking; today: string; unit?: string;
    onOpen: () => void; onCheckIn?: () => void; onCheckOut?: () => void; busy?: boolean;
}) {
    const balance = balanceOf(b);
    const owing = owes(b);
    const late = LIVE_STATUSES.includes(b.status) && b.status !== 'checked_in' && b.check_in < today;
    const overdue = b.status === 'checked_in' && b.check_out < today;
    const when = (s: string) => relDayLower(s, today);

    return (
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
            <button type="button" onClick={onOpen} className="w-full text-left p-4 active:bg-stone-50">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#7ed957]/25 text-[#02572a] font-bold flex items-center justify-center shrink-0">
                        {(b.guest_name || 'G').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                            <p className="font-bold text-stone-900 truncate text-[15px]">{b.guest_name}</p>
                            <StatusPill status={b.status} />
                        </div>
                        <p className="text-[13px] text-stone-500 mt-0.5 truncate">
                            {unit && <span className="font-semibold text-stone-700">{unit} · </span>}
                            {relDay(b.check_in, today)} → {relDay(b.check_out, today)} · {b.nights} night{b.nights === 1 ? '' : 's'}
                        </p>
                        <div className="flex items-center justify-between mt-1.5 text-[13px]">
                            <span className="font-semibold text-stone-800">{naira(b.total_amount)}</span>
                            {owing
                                ? <span className="font-bold text-[#c75146]">{naira(balance)} owing</span>
                                : <span className="text-stone-400">Paid in full</span>}
                        </div>
                        {(late || overdue) && (
                            <p className="mt-1.5 text-[12px] font-semibold text-[#c75146] flex items-center gap-1">
                                <AlertTriangle size={12} />
                                {overdue ? `Was due to leave ${when(b.check_out)}` : `Was due to arrive ${when(b.check_in)}`}
                            </p>
                        )}
                    </div>
                </div>
            </button>
            {(onCheckIn || onCheckOut || phoneDigits(b.guest_phone)) && (
                <div className="flex items-center gap-2 px-3 pb-3">
                    <ContactButtons phone={b.guest_phone} name={b.guest_name} compact />
                    <div className="flex-1" />
                    {onCheckIn && (
                        <button type="button" onClick={onCheckIn} disabled={busy}
                            className="h-10 px-4 rounded-xl bg-[#008737] text-white font-bold text-[13px] flex items-center gap-1.5 disabled:opacity-50 active:bg-[#00762e]">
                            <LogIn size={15} /> Check in
                        </button>
                    )}
                    {onCheckOut && (
                        <button type="button" onClick={onCheckOut} disabled={busy}
                            className="h-10 px-4 rounded-xl bg-[#02572a] text-white font-bold text-[13px] flex items-center gap-1.5 disabled:opacity-50 active:bg-[#03471f]">
                            <LogOut size={15} /> Check out
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
