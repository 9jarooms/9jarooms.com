'use client';

import { useMemo, useState } from 'react';
import { Share2, Copy, Check, Lock } from 'lucide-react';
import {
    Sheet, BigButton, Field, Stepper, Chips, inputCls,
    naira, shiftIso, fmtDay, unitLabel, unitPrice, groupAllUnits, waLink, LIVE_STATUSES, type OpsToday,
} from './shared';

const SOURCES = [
    { value: 'walk_in', label: 'Walk-in' },
    { value: 'phone', label: 'Phone' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'referral', label: 'Referral' },
    { value: 'other', label: 'Other' },
];
const PAY_METHODS = ['Cash', 'Bank Transfer', 'POS', 'Moniepoint', 'Other'];

export interface NewBookingPreset {
    unitId?: string;
    date?: string;
    nights?: number;
    // 'hold' = block the unit for 15 minutes and get a payment link to
    // send the guest; the booking confirms itself when they pay
    mode?: 'booking' | 'block' | 'hold';
    blockStatus?: 'cleaning' | 'maintenance';
}

interface HoldResult { bookingId: string; paystackUrl: string | null; payUrl: string; expiresAt: string; holdMinutes: number; warning?: string | null }

// Walk-in / phone booking, a WhatsApp hold, or blocking a unit for cleaning
// or maintenance. Only what a caretaker needs: unit, dates, name, phone, money.
export default function NewBookingSheet({ data, preset, onClose, onCreated, onRefresh }: {
    data: OpsToday; preset: NewBookingPreset; onClose: () => void; onCreated: () => void;
    // a hold keeps the sheet open to show the pay link, so it only refreshes the screen behind
    onRefresh?: () => void;
}) {
    const [mode, setMode] = useState<'booking' | 'block' | 'hold'>(preset.mode || 'booking');
    const [unitId, setUnitId] = useState(preset.unitId || '');
    const [checkIn, setCheckIn] = useState(preset.date || data.today);
    const [nights, setNights] = useState(preset.nights && preset.nights > 0 ? preset.nights : 1);
    const [hold, setHold] = useState<HoldResult | null>(null);
    const [copied, setCopied] = useState(false);
    const [guestName, setGuestName] = useState('');
    const [phone, setPhone] = useState('');
    const [source, setSource] = useState(preset.mode === 'hold' ? 'whatsapp' : 'walk_in');
    const [price, setPrice] = useState('');      // '' = the standard price
    const [paidNow, setPaidNow] = useState('');
    const [payMethod, setPayMethod] = useState('Cash');
    const [notes, setNotes] = useState('');
    const [blockStatus, setBlockStatus] = useState<'cleaning' | 'maintenance'>(preset.blockStatus || 'cleaning');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const checkOut = shiftIso(checkIn, Math.max(nights, 1));
    const groups = useMemo(() => groupAllUnits(data), [data]);

    // Free for the whole stay? Bookings and booking-held cells always block;
    // cleaning/maintenance blocks only matter for a guest booking.
    const isFree = (id: string) => {
        const booked = data.bookings.some(b =>
            b.room_id === id && LIVE_STATUSES.includes(b.status) && b.check_in < checkOut && b.check_out > checkIn);
        const held = data.held.some(h => h.room_id === id && h.date >= checkIn && h.date < checkOut);
        const blocked = mode !== 'block' && data.blocks.some(k => k.room_id === id && k.date >= checkIn && k.date < checkOut);
        return !(booked || held || blocked);
    };

    // default to the first free unit when none was chosen
    const effectiveUnitId = unitId || data.units.find(u => isFree(u.id))?.id || '';
    const unit = data.units.find(u => u.id === effectiveUnitId);
    const unitFree = unit ? isFree(unit.id) : false;
    const perNight = unit ? unitPrice(unit, data.roomTypes) : null;
    const autoTotal = perNight != null ? perNight * Math.max(nights, 1) : null;
    const total = price !== '' ? Number(price) : (autoTotal ?? 0);
    const deposit = Number(paidNow) || 0;
    const freeCount = data.units.filter(u => isFree(u.id)).length;
    const headers = { 'Content-Type': 'application/json' };

    const submit = async () => {
        if (!unit) { setError('Pick a unit'); return; }
        if (!unitFree) { setError(`${unitLabel(unit)} is not free for those dates`); return; }
        if (nights < 1) { setError('At least 1 night'); return; }
        setBusy(true); setError(null);
        try {
            if (mode === 'block') {
                const res = await fetch('/api/ops/blocks', {
                    method: 'POST', headers,
                    body: JSON.stringify({ roomId: unit.id, from: checkIn, to: checkOut, status: blockStatus }),
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || 'Could not block the unit');
                onCreated();
                return;
            }

            if (guestName.trim().length < 2) throw new Error('Enter the guest name');
            const res = await fetch('/api/bookings', {
                method: 'POST', headers,
                body: JSON.stringify({
                    roomId: unit.id, propertyId: unit.property_id || data.propertyId, mode: 'single',
                    guestName: guestName.trim(), guestPhone: phone.trim() || null,
                    checkIn, checkOut,
                    isManualBooking: true, hold: mode === 'hold', bookingSource: source, notes: notes.trim() || null,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Could not create the booking');
            const id = json.bookingId as string;

            if (mode === 'hold') {
                // agreed price must be on the booking before the guest sees the link total
                if (price !== '' && Number(price) >= 0) {
                    await fetch(`/api/ops/bookings/${id}`, {
                        method: 'PATCH', headers, body: JSON.stringify({ totalAmount: Number(price) }),
                    });
                }
                setHold({ bookingId: id, paystackUrl: json.paystackUrl || null, payUrl: json.payUrl, expiresAt: json.expiresAt, holdMinutes: json.holdMinutes || 15, warning: json.warning || null });
                onRefresh?.();
                return;
            }

            // agreed price differs from the standard one
            if (price !== '' && Number(price) >= 0) {
                await fetch(`/api/ops/bookings/${id}`, {
                    method: 'PATCH', headers, body: JSON.stringify({ totalAmount: Number(price) }),
                });
            }
            if (deposit > 0) {
                await fetch(`/api/ops/bookings/${id}/payments`, {
                    method: 'POST', headers, body: JSON.stringify({ amount: deposit, method: payMethod, note: 'At booking' }),
                });
            }
            onCreated();
        } catch (e: any) {
            setError(e?.message || 'Failed');
        } finally {
            setBusy(false);
        }
    };

    if (hold && unit) {
        const link = hold.paystackUrl || hold.payUrl;
        const payMessage =
            `Hello ${guestName.trim()}, this is 9jaRooms. ${unitLabel(unit)} is held for you ` +
            `(${fmtDay(checkIn)} to ${fmtDay(checkOut)}, ${nights} night${nights === 1 ? '' : 's'}, ${naira(total)}). ` +
            `Please pay within ${hold.holdMinutes} minutes to confirm: ${link}`;
        const wa = waLink(phone, payMessage);
        const shareLink = async () => {
            if (typeof navigator !== 'undefined' && navigator.share && !wa) {
                try { await navigator.share({ text: payMessage }); return; } catch { /* cancelled */ }
            }
            window.open(wa || `https://wa.me/?text=${encodeURIComponent(payMessage)}`, '_blank', 'noopener');
        };
        const copyLink = async () => {
            try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
        };
        return (
            <Sheet title={`${unitLabel(unit)} is held`} subtitle={`For ${hold.holdMinutes} minutes · ${fmtDay(checkIn)} → ${fmtDay(checkOut)}`} onClose={onClose}>
                {hold.warning && <p className="text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{hold.warning}</p>}
                <div className="rounded-2xl bg-green-50 border border-green-200 px-4 py-3 text-[13.5px] text-green-900 space-y-1">
                    <p className="font-bold flex items-center gap-1.5"><Lock size={15} /> Off the website until {new Date(hold.expiresAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                    <p>Send {guestName.trim()} the payment link. When they pay, the booking confirms itself and you get a WhatsApp message. If they do not pay in time, the unit frees itself.</p>
                    <p>Paying by transfer instead? Open the booking and tap <b>Record payment</b>.</p>
                </div>
                <BigButton onClick={shareLink} icon={<Share2 size={18} />} className="!bg-[#25D366]">
                    {wa ? `Send link on WhatsApp` : 'Share payment link'}
                </BigButton>
                <BigButton tone="secondary" onClick={copyLink} icon={copied ? <Check size={18} /> : <Copy size={18} />}>
                    {copied ? 'Copied' : 'Copy payment link'}
                </BigButton>
                <BigButton tone="dark" onClick={onClose}>Done</BigButton>
            </Sheet>
        );
    }

    return (
        <Sheet
            title={mode === 'booking' ? 'New booking' : mode === 'hold' ? 'Hold a unit' : 'Block a unit'}
            subtitle={`${freeCount} of ${data.units.length} units free for these dates`}
            onClose={onClose}
        >
            <Chips
                options={[
                    { value: 'hold', label: 'Hold & send pay link' },
                    { value: 'booking', label: 'Book now' },
                    { value: 'block', label: 'Cleaning / maintenance' },
                ]}
                value={mode}
                onChange={v => setMode(v as 'booking' | 'block' | 'hold')}
            />
            {mode === 'hold' && (
                <p className="text-[12.5px] text-gray-500 -mt-1">
                    The unit comes off the website for 15 minutes while the guest pays the link you send them. Use this for WhatsApp guests.
                </p>
            )}

            {error && <p className="text-[13px] text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

            <Field label="Unit">
                <select className={inputCls} value={effectiveUnitId} onChange={e => setUnitId(e.target.value)}>
                    {groups.map(g => (
                        <optgroup key={g.key} label={g.label + (g.price != null ? ` · ${naira(g.price)}/night` : '')}>
                            {g.units.map(u => (
                                <option key={u.id} value={u.id}>{unitLabel(u)}{isFree(u.id) ? '' : ' — taken'}</option>
                            ))}
                        </optgroup>
                    ))}
                </select>
                {unit && !unitFree && <p className="text-[12px] text-red-600 mt-1 font-semibold">{unitLabel(unit)} is not free for these dates.</p>}
            </Field>

            <div className="grid grid-cols-2 gap-3">
                <Field label="Check-in">
                    <input type="date" className={inputCls} value={checkIn} onChange={e => { if (e.target.value) setCheckIn(e.target.value); }} />
                </Field>
                <Field label="Nights">
                    <Stepper value={nights} onChange={setNights} />
                </Field>
            </div>
            <p className="text-[13px] text-gray-600 -mt-2">Check-out <b>{fmtDay(checkOut)}</b></p>

            {mode !== 'block' ? (
                <>
                    <Field label="Guest name">
                        <input className={inputCls} value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="e.g. Mr Okeke" autoFocus={!!preset.unitId} />
                    </Field>
                    <Field label="Phone / WhatsApp">
                        <input type="tel" inputMode="tel" className={inputCls} value={phone} onChange={e => setPhone(e.target.value)} placeholder="080…" />
                    </Field>
                    <Field label="How did they book?">
                        <Chips options={SOURCES} value={source} onChange={setSource} />
                    </Field>
                    <Field
                        label={`Price for ${nights} night${nights === 1 ? '' : 's'} (₦)`}
                        hint={autoTotal != null ? `Leave blank to use the standard price: ${naira(autoTotal)}` : 'No standard price on this unit — enter the agreed price'}
                    >
                        <input type="number" inputMode="numeric" min={0} className={inputCls}
                            placeholder={autoTotal != null ? String(autoTotal) : '0'} value={price} onChange={e => setPrice(e.target.value)} />
                    </Field>
                    {mode === 'booking' && <Field label="Paid now (₦) — optional">
                        <input type="number" inputMode="numeric" min={0} className={inputCls} value={paidNow} onChange={e => setPaidNow(e.target.value)} placeholder="0" />
                    </Field>}
                    {deposit > 0 && (
                        <Field label="How was it paid?">
                            <Chips options={PAY_METHODS.map(m => ({ value: m, label: m }))} value={payMethod} onChange={setPayMethod} />
                        </Field>
                    )}
                    <Field label="Notes — optional">
                        <input className={inputCls} value={notes} onChange={e => setNotes(e.target.value)} />
                    </Field>

                    <div className="rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3 flex items-center justify-between gap-2 text-[13px]">
                        <span>Total <b>{naira(total)}</b></span>
                        {deposit > 0 && <span>Paid <b className="text-green-600">{naira(deposit)}</b></span>}
                        <span>Balance <b className={total - deposit > 0 ? 'text-red-600' : ''}>{naira(Math.max(total - deposit, 0))}</b></span>
                    </div>

                    <BigButton onClick={submit} busy={busy} disabled={!unit || !unitFree || guestName.trim().length < 2}
                        icon={mode === 'hold' ? <Lock size={18} /> : undefined}>
                        {mode === 'hold' ? 'Hold unit & get payment link' : 'Create booking'}
                    </BigButton>
                </>
            ) : (
                <>
                    <Field label="Reason">
                        <Chips
                            options={[{ value: 'cleaning', label: 'Cleaning' }, { value: 'maintenance', label: 'Maintenance' }]}
                            value={blockStatus}
                            onChange={v => setBlockStatus(v as 'cleaning' | 'maintenance')}
                        />
                    </Field>
                    <BigButton tone="dark" onClick={submit} busy={busy} disabled={!unit || !unitFree}>
                        Block {unit ? unitLabel(unit) : 'unit'} for {nights} night{nights === 1 ? '' : 's'}
                    </BigButton>
                </>
            )}
        </Sheet>
    );
}
