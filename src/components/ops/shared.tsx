'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X, Minus, Plus, Phone, MessageCircle, LogIn, LogOut, AlertTriangle } from 'lucide-react';

// ------------------------------------------------------------------
// Types — mirror what /api/ops/today returns
// ------------------------------------------------------------------
export interface OpsProperty { id: string; name: string; area: string | null }
export interface OpsRoomType { id: string; name: string; price_per_night: number | string | null; property_id?: string; images?: string[] | null; is_active?: boolean | null }
export interface OpsUnit {
    id: string; name: string; unit_code: string | null;
    room_type_id: string | null; price_per_night: number | string | null; property_id?: string;
}
export interface OpsBooking {
    id: string; room_id: string; room_type_id: string | null; property_id: string;
    guest_name: string; guest_phone: string | null; guest_email: string | null;
    check_in: string; check_out: string; nights: number; status: string;
    total_amount: number | string; paid: number;
    booking_source: string | null; notes: string | null;
    adults?: number | null; children?: number | null;
    checked_in_at?: string | null; checked_out_at?: string | null;
    expires_at?: string | null;
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
    lapsed?: OpsBooking[];      // transfer locks that ran out in the last hour (money may still come)
    refundsDue?: OpsBooking[] | null;  // more received than the stay costs (cancelled count as ₦0); null = could not load
    serverNow?: number;
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

// Open WhatsApp with a message ready to send (pick the chat there). Straight into the app on a phone:
// the phone's general share sheet offered "Google" among its targets, which searched the message
// instead of sending it. Falls back to WhatsApp's web link when the app is not installed.
export function openWhatsApp(text: string, phone?: string | null) {
    const d = phoneDigits(phone);
    const q = `text=${encodeURIComponent(text)}${d ? `&phone=${d}` : ''}`;
    const web = `https://api.whatsapp.com/send?${q}`;
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!mobile) { window.open(web, '_blank', 'noopener'); return; }
    const t = setTimeout(() => { if (document.visibilityState === 'visible') window.location.href = web; }, 1500);
    document.addEventListener('visibilitychange', () => clearTimeout(t), { once: true });
    window.location.href = `whatsapp://send?${q}`;
}

// ------------------------------------------------------------------
// Status vocab
// ------------------------------------------------------------------
export const LIVE_STATUSES = ['pending', 'confirmed', 'paid', 'checked_in'];
export const STATUS_LABEL: Record<string, string> = {
    pending: 'Hold', confirmed: 'Confirmed', paid: 'Paid', checked_in: 'In house',
    completed: 'Checked out', cancelled: 'Cancelled', no_show: 'No show', expired: 'Expired',
};
export const STATUS_STYLE: Record<string, string> = {
    pending: 'bg-purple-100 text-purple-700',
    confirmed: 'bg-amber-100 text-amber-800',
    paid: 'bg-green-100 text-green-800',
    checked_in: 'bg-green-700 text-white',
    completed: 'bg-gray-200 text-gray-600',
    cancelled: 'bg-red-100 text-red-700',
    no_show: 'bg-gray-100 text-gray-500',
    expired: 'bg-gray-100 text-gray-500',
};
export const UNIT_KIND_LABEL: Record<UnitKind, string> = {
    free: 'Free', occupied: 'Occupied', arriving: 'Arriving', cleaning: 'Cleaning', maintenance: 'Maintenance',
};
export const UNIT_KIND_STYLE: Record<UnitKind, string> = {
    free: 'bg-green-100 text-green-800',
    occupied: 'bg-green-700 text-white',
    arriving: 'bg-amber-100 text-amber-800',
    cleaning: 'bg-blue-100 text-blue-800',
    maintenance: 'bg-gray-200 text-gray-700',
};

export function unitLabel(u: { unit_code?: string | null; name?: string | null } | null | undefined) {
    if (!u) return '—';
    return u.unit_code || u.name || '—';
}

// ------------------------------------------------------------------
// Unit grouping — same rule as the CRM calendar: duplex properties
// (codes like 1A/1B/1C) group by unit number, everything else by type.
// ------------------------------------------------------------------
export interface UnitGroup { key: string; label: string; price: number | null; units: OpsUnit[]; typeId?: string; hidden?: boolean; photos?: number }
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
            key: t.id, label: t.name, typeId: t.id, hidden: t.is_active === false, photos: (t.images || []).length,
            price: t.price_per_night == null ? null : Number(t.price_per_night),
            units: units.filter(u => u.room_type_id === t.id),
        }))
        .filter(g => g.units.length > 0);
    const untyped = units.filter(u => !u.room_type_id || !roomTypes.some(t => t.id === u.room_type_id));
    if (untyped.length) groups.push({ key: '_none', label: 'Rooms', price: null, units: untyped });
    return groups;
}
// Groups for one property, or for every property when the Today screen is
// in "All properties" mode (group labels then carry the property name).
export function groupAllUnits(data: { propertyId: string | null; properties: OpsProperty[]; units: OpsUnit[]; roomTypes: OpsRoomType[] }): UnitGroup[] {
    if (data.propertyId !== 'all') return groupUnits(data.units, data.roomTypes);
    return data.properties.flatMap(p =>
        groupUnits(data.units.filter(u => u.property_id === p.id), data.roomTypes.filter(t => t.property_id === p.id))
            .map(g => ({ ...g, key: `${p.id}:${g.key}`, label: `${p.name} · ${g.label}` }))
    );
}
export function unitPrice(u: OpsUnit, roomTypes: OpsRoomType[]): number | null {
    if (u.price_per_night != null && u.price_per_night !== '') return Number(u.price_per_night);
    const t = roomTypes.find(rt => rt.id === u.room_type_id);
    return t && t.price_per_night != null ? Number(t.price_per_night) : null;
}

// ------------------------------------------------------------------
// UI atoms — big touch targets, 16px inputs (no iOS zoom)
// ------------------------------------------------------------------
export const inputCls = 'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-[16px] text-gray-900 outline-none shadow-sm focus:border-green-500 focus:ring-2 focus:ring-green-500/20';

export function StatusPill({ status }: { status: string }) {
    return (
        <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap ${STATUS_STYLE[status] || 'bg-gray-100 text-gray-600'}`}>
            {STATUS_LABEL[status] || status.replace('_', ' ')}
        </span>
    );
}
export function KindPill({ kind }: { kind: UnitKind }) {
    return (
        <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap ${UNIT_KIND_STYLE[kind]}`}>
            {UNIT_KIND_LABEL[kind]}
        </span>
    );
}

const TONE: Record<string, string> = {
    primary: 'bg-green-500 text-white hover:bg-green-600 shadow-sm',
    dark: 'bg-gray-900 text-white hover:bg-black',
    amber: 'bg-amber-500 text-white hover:bg-amber-600',
    secondary: 'bg-white border border-gray-200 text-gray-800 hover:border-gray-900',
    danger: 'bg-white border border-red-200 text-red-600 hover:bg-red-50',
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
            className={`h-12 w-full rounded-xl font-semibold text-[15px] flex items-center justify-center gap-2 disabled:opacity-50 transition-colors btn-press ${TONE[tone]} ${className}`}
        >
            {busy ? 'Please wait…' : <>{icon}{children}</>}
        </button>
    );
}

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
    return (
        <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{label}</span>
            {children}
            {hint && <span className="block text-[12px] text-gray-400 mt-1">{hint}</span>}
        </div>
    );
}

export function Stepper({ value, onChange, min = 1, max = 90 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
    return (
        <div className="inline-flex items-center rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <button type="button" aria-label="Fewer" onClick={() => onChange(Math.max(min, value - 1))} className="w-11 h-11 flex items-center justify-center active:bg-gray-100"><Minus size={16} /></button>
            <span className="w-12 text-center font-bold text-[16px] tabular-nums">{value}</span>
            <button type="button" aria-label="More" onClick={() => onChange(Math.min(max, value + 1))} className="w-11 h-11 flex items-center justify-center active:bg-gray-100"><Plus size={16} /></button>
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
                    className={`px-3.5 h-10 rounded-full text-xs font-medium border transition-colors ${value === o.value ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-900'}`}
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
                <div className="sm:hidden absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-gray-300" />
                <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-gray-100">
                    <div className="min-w-0">
                        <h2 className="font-semibold text-[18px] tracking-tight text-gray-900 leading-tight truncate">{title}</h2>
                        {subtitle && <p className="text-[13px] text-gray-500 mt-0.5">{subtitle}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {right}
                        <button type="button" onClick={onClose} aria-label="Close" className="p-2 -mr-2 rounded-full active:bg-gray-100"><X size={20} /></button>
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
        return compact ? null : <p className="text-[13px] text-gray-400">No phone number on this booking.</p>;
    }
    if (compact) {
        return (
            <div className="flex items-center gap-2">
                <a href={tel} aria-label="Call guest" className="w-10 h-10 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-700 active:bg-gray-50"><Phone size={16} /></a>
                <a href={wa} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp guest" className="w-10 h-10 rounded-xl bg-[#25D366] text-white flex items-center justify-center"><MessageCircle size={17} /></a>
            </div>
        );
    }
    return (
        <div className="grid grid-cols-2 gap-2">
            <a href={tel} className="h-12 rounded-xl border border-gray-200 bg-white flex items-center justify-center gap-2 font-semibold text-[14px] text-gray-800 hover:border-gray-900 transition-colors"><Phone size={17} /> Call</a>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="h-12 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white flex items-center justify-center gap-2 font-semibold text-[14px] transition-colors shadow-sm"><MessageCircle size={18} /> WhatsApp</a>
        </div>
    );
}

// One booking as a card. Tap the body to open it; check-in / check-out are
// one tap from the list so the common case never needs the full sheet.
// "expires in 7 min" for an unpaid hold; null once it has lapsed or when there is no hold
// phone clocks can be wrong: countdowns use the server time (set whenever Today loads)
let clockSkew = 0;
export function syncClock(serverNow?: number) { if (serverNow) clockSkew = serverNow - Date.now(); }
export function serverNow() { return Date.now() + clockSkew; }
export function newRequestId() { return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; }
export function holdCountdown(b: { status: string; expires_at?: string | null }, now = Date.now() + clockSkew) {
    if (b.status !== 'pending' || !b.expires_at) return null;
    const ms = new Date(b.expires_at).getTime() - now;
    if (ms <= 0) return 'hold expired';
    const min = Math.ceil(ms / 60000);
    return `${min} min left to pay`;
}

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
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button type="button" onClick={onOpen} className="w-full text-left p-4 active:bg-gray-50">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center shrink-0">
                        {(b.guest_name || 'G').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-gray-900 truncate text-[15px]">{b.guest_name}</p>
                            <StatusPill status={b.status} />
                        </div>
                        <p className="text-[13px] text-gray-500 mt-0.5 truncate">
                            {unit && <span className="font-semibold text-gray-700">{unit} · </span>}
                            {relDay(b.check_in, today)} → {relDay(b.check_out, today)} · {b.nights} night{b.nights === 1 ? '' : 's'}
                        </p>
                        <div className="flex items-center justify-between mt-1.5 text-[13px]">
                            <span className="font-semibold text-gray-900 tabular-nums">{naira(b.total_amount)}</span>
                            {owing
                                ? <span className="font-bold text-red-600">{naira(balance)} owing</span>
                                : <span className="text-gray-400">Paid in full</span>}
                        </div>
                        {holdCountdown(b) && (
                            <p className="mt-1.5 text-[12px] font-semibold text-purple-700">Held · {holdCountdown(b)}</p>
                        )}
                        {(late || overdue) && (
                            <p className="mt-1.5 text-[12px] font-semibold text-red-600 flex items-center gap-1">
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
                            className="h-10 px-4 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold text-[13px] flex items-center gap-1.5 disabled:opacity-50 transition-colors">
                            <LogIn size={15} /> Check in
                        </button>
                    )}
                    {onCheckOut && (
                        <button type="button" onClick={onCheckOut} disabled={busy}
                            className="h-10 px-4 rounded-xl bg-gray-900 hover:bg-black text-white font-semibold text-[13px] flex items-center gap-1.5 disabled:opacity-50 transition-colors">
                            <LogOut size={15} /> Check out
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

// ------------------------------------------------------------------
// Stale-while-revalidate: screens show the last data for a request at once
// (this tab session), then refresh it. Keeps tab switches instant on slow data.
// ------------------------------------------------------------------
const memCache = new Map<string, unknown>();
export function cacheGet<T>(key: string): T | null {
    if (memCache.has(key)) return memCache.get(key) as T;
    try { const v = sessionStorage.getItem('swr:' + key); if (v) { const j = JSON.parse(v); memCache.set(key, j); return j as T; } } catch { /* ignore */ }
    return null;
}
export function cacheSet(key: string, value: unknown) {
    memCache.set(key, value);
    try { sessionStorage.setItem('swr:' + key, JSON.stringify(value)); } catch { /* quota or private mode */ }
}
// fetch JSON and remember it; the same request made while one is in flight shares it
const inflight = new Map<string, Promise<any>>();
export function fetchCached<T>(url: string): Promise<T> {
    if (inflight.has(url)) return inflight.get(url)!;
    const p = fetch(url, { cache: 'no-store' }).then(async r => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Could not load');
        cacheSet(url, j); return j as T;
    }).finally(() => inflight.delete(url));
    inflight.set(url, p);
    return p;
}

// ------------------------------------------------------------------
// Live updates: the database bumps one public row (ops_pulse) whenever a booking, a night or a payment
// changes, and Supabase Realtime pushes that to every open screen. Screens then reload what they show,
// so a booking made on another phone appears without anyone refreshing. One socket per tab, shared by
// every screen; if the socket drops, the screens' own timers and focus refreshes still catch up.
// ------------------------------------------------------------------
const pulseListeners = new Set<() => void>();
let pulseChannel: { unsubscribe: () => unknown } | null = null;
let pulseLive = false;          // the socket has confirmed it is listening
let pulseClient: ReturnType<typeof createClient> | null = null;
function notifyAll() { memCache.clear(); pulseListeners.forEach(fn => fn()); }
function startPulse() {
    if (pulseChannel || typeof window === 'undefined') return;
    pulseClient = pulseClient || createClient();
    const supabase = pulseClient;
    const ch = supabase.channel(`ops-pulse-${Date.now()}`)
        .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'ops_pulse' }, notifyAll);
    pulseChannel = ch;
    ch.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
            // (re)connected: anything missed while it was down is fetched now
            if (!pulseLive) { pulseLive = true; notifyAll(); }
            return;
        }
        // the socket dropped (bad signal, phone asleep): start a new one shortly and catch up
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            if (pulseChannel !== ch) return;
            pulseChannel = null; pulseLive = false;
            supabase.removeChannel(ch);
            setTimeout(() => { if (pulseListeners.size) startPulse(); }, 3000);
        }
    });
}
// An installed app that was in the background often comes back with a dead socket that never
// reported closing: start a fresh one whenever the app is opened again or the signal returns.
function revivePulse() {
    if (!pulseListeners.size) return;
    if (pulseChannel && pulseClient) { pulseClient.removeChannel(pulseChannel as any); }
    pulseChannel = null; pulseLive = false;
    startPulse();
    notifyAll();
}
if (typeof window !== 'undefined') {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') revivePulse(); });
    window.addEventListener('online', revivePulse);
    window.addEventListener('pageshow', e => { if ((e as PageTransitionEvent).persisted) revivePulse(); });
}
// Reload when anyone changes a booking, payment or night, plus a quiet catch-up when the phone comes
// back to the app (it may have missed updates while asleep). Never on a timer: data changes in place,
// nothing reloads under someone's fingers, and forms keep what is being typed.
export function useLiveUpdates(onChange: () => void, enabled = true) {
    const ref = useRef(onChange);
    useEffect(() => { ref.current = onChange; }, [onChange]);
    useEffect(() => {
        if (!enabled) return;
        let timer: ReturnType<typeof setTimeout> | null = null;
        // several changes land together (booking + nights + payment): reload once
        const fire = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => ref.current(), 350); };
        pulseListeners.add(fire);
        startPulse();
        return () => { pulseListeners.delete(fire); if (timer) clearTimeout(timer); };
    }, [enabled]);
}

// Signing out on a shared phone: the next person must not see the last person's guests
export function clearOpsCache() {
    memCache.clear();
    try { Object.keys(sessionStorage).filter(k => k.startsWith('swr:')).forEach(k => sessionStorage.removeItem(k)); } catch { /* ignore */ }
}

// Optional receipt photo for a payment: phone photos are shrunk (max 1600px, JPEG) before upload so
// it works on slow data. Returns the stored path, or throws with a message to show.
export async function uploadReceipt(file: File, bookingId: string): Promise<string> {
    let blob: Blob = file;
    if (file.type.startsWith('image/') && file.type !== 'image/gif') {
        try {
            const bmp = await createImageBitmap(file);
            const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
            canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
            blob = await new Promise<Blob>((ok, no) => canvas.toBlob(b => b ? ok(b) : no(new Error('x')), 'image/jpeg', 0.8));
        } catch { blob = file; }
    }
    const form = new FormData();
    form.append('file', new File([blob], 'receipt', { type: blob.type || file.type }));
    form.append('bookingId', bookingId);
    const res = await fetch('/api/ops/receipts', { method: 'POST', body: form }).catch(() => null);
    if (!res) throw new Error('No connection: the receipt was not attached. Try again, or save without it.');
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || 'Could not attach the receipt');
    return j.path as string;
}
export const receiptLink = (path: string) => `/api/ops/receipts?path=${encodeURIComponent(path)}`;

export function ReceiptPicker({ bookingId, receipt, onChange }: {
    bookingId: string; receipt: { path: string; name: string } | null; onChange: (r: { path: string; name: string } | null) => void;
}) {
    const [state, setState] = useState<'idle' | 'busy'>('idle');
    const [err, setErr] = useState<string | null>(null);
    const pick = async (f: File | undefined) => {
        if (!f) return;
        setState('busy'); setErr(null);
        try { onChange({ path: await uploadReceipt(f, bookingId), name: f.name }); }
        catch (e: any) { setErr(e?.message || 'Could not attach'); }
        finally { setState('idle'); }
    };
    return (
        <div className="text-[13px]">
            {receipt ? (
                <p className="flex items-center gap-2 text-green-700">Receipt attached
                    <a href={receiptLink(receipt.path)} target="_blank" rel="noopener noreferrer" className="underline">view</a>
                    <button type="button" className="text-gray-500 underline" onClick={() => onChange(null)}>remove</button></p>
            ) : (
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-gray-300 text-gray-600 cursor-pointer bg-white">
                    {state === 'busy' ? 'Attaching…' : 'Add receipt photo (optional)'}
                    <input type="file" accept="image/*,application/pdf" className="hidden" disabled={state === 'busy'} onChange={e => pick(e.target.files?.[0])} />
                </label>
            )}
            {err && <p className="mt-1 text-red-600">{err}</p>}
        </div>
    );
}
