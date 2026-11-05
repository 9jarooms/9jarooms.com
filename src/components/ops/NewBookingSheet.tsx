'use client';

import { useEffect, useMemo, useState } from 'react';
import { Share2, Copy, Check, Lock } from 'lucide-react';
import {
    Sheet, BigButton, Field, Stepper, Chips, inputCls,
    naira, shiftIso, fmtDay, unitLabel, unitPrice, groupAllUnits, openWhatsApp, LIVE_STATUSES, type OpsToday,
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

interface Bank { bankName?: string; accountNumber?: string; accountName?: string }
interface HoldResult { bookingId: string; paystackUrl: string | null; payUrl: string | null; expiresAt: string; holdMinutes: number; warning?: string | null; transfer?: boolean; bank?: Bank | null }

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
    // how a held guest pays: bank transfer (staff confirm when it lands) or a Paystack link
    const [payBy, setPayBy] = useState<'transfer' | 'paystack'>('transfer');
    const [received, setReceived] = useState(false);
    // one id per booking attempt: a retry after lost signal returns the same booking, never a second one
    const [requestId] = useState(() => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`));
    const [copied, setCopied] = useState(false);
    const [guestName, setGuestName] = useState('');
    const [phone, setPhone] = useState('');
    // guests we have hosted before: type part of a name or number and pick them
    const [known, setKnown] = useState<{ name: string; phone: string | null; stays: number; last: string }[]>([]);
    const [picked, setPicked] = useState(false);
    const [source, setSource] = useState(preset.mode === 'hold' ? 'whatsapp' : 'walk_in');
    const [price, setPrice] = useState('');      // '' = the standard price
    const [paidNow, setPaidNow] = useState('');
    const [payMethod, setPayMethod] = useState('Cash');
    const [notes, setNotes] = useState('');
    const [blockStatus, setBlockStatus] = useState<'cleaning' | 'maintenance'>(preset.blockStatus || 'cleaning');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const checkOut = shiftIso(checkIn, Math.max(nights, 1));

    useEffect(() => {
        const q = phone.replace(/\D/g, '').length >= 3 ? phone : guestName;
        if (picked || q.trim().length < 2) { const t = setTimeout(() => setKnown([]), 0); return () => clearTimeout(t); }
        const ctl = new AbortController();
        const t = setTimeout(() => {
            fetch(`/api/ops/guests?q=${encodeURIComponent(q.trim())}`, { signal: ctl.signal })
                .then(r => r.json()).then(j => setKnown(j.guests || [])).catch(() => {});
        }, 250);
        return () => { clearTimeout(t); ctl.abort(); };
    }, [guestName, phone, picked]);
    const groups = useMemo(() => groupAllUnits(data), [data]);

    // Free for the whole stay? Bookings and booking-held cells always block;
    // cleaning/maintenance blocks only matter for a guest booking.
    const isFree = (id: string) => {
        const booked = data.bookings.some(b =>
            b.room_id === id && LIVE_STATUSES.includes(b.status) && b.check_in < checkOut && b.check_out > checkIn);
        // a guest still checked in after their check-out date is in the room tonight
        const overstay = checkIn <= data.today && data.bookings.some(b => b.room_id === id && b.status === 'checked_in' && b.check_out <= data.today);
        const held = data.held.some(h => h.room_id === id && h.date >= checkIn && h.date < checkOut);
        const blocked = mode !== 'block' && data.blocks.some(k => k.room_id === id && k.date >= checkIn && k.date < checkOut);
        return !(booked || overstay || held || blocked);
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
                    isManualBooking: true, hold: mode === 'hold', payBy: mode === 'hold' ? payBy : undefined, bookingSource: source, notes: notes.trim() || null,
                    // price, deposit and booking are saved together, so none of them can be half-done
                    totalAmount: price !== '' && Number(price) >= 0 ? Number(price) : null,
                    deposit: mode === 'booking' && deposit > 0 ? { amount: deposit, method: payMethod } : null,
                    requestId,
                }),
            }).catch(() => null);
            if (!res) {
                onRefresh?.();
                throw new Error('No connection. Check your data, then tap again: it will not book twice.');
            }
            const json = await res.json();
            if (!res.ok) { onRefresh?.(); throw new Error(json.error || 'Could not create the booking'); }
            const id = json.bookingId as string;

            if (mode === 'hold') {
                setHold({ bookingId: id, paystackUrl: json.paystackUrl || null, payUrl: json.payUrl || null, expiresAt: json.expiresAt, holdMinutes: json.holdMinutes || 15, warning: json.warning || null, transfer: !!json.transfer || (!!json.duplicate && payBy === 'transfer'), bank: json.bank || null });
                onRefresh?.();
                return;
            }

            onCreated();
        } catch (e: any) {
            setError(e?.message || 'Failed');
        } finally {
            setBusy(false);
        }
    };

    if (hold && unit && hold.transfer) {
        const until = new Date(hold.expiresAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const b = hold.bank;
        const account = b?.accountNumber ? `${b.bankName} ${b.accountNumber} (${b.accountName})` : '';
        const lockMessage =
            `Hello ${guestName.trim()}, this is 9jaRooms. ${unitLabel(unit)} is locked for you for ${hold.holdMinutes} minutes ` +
            `(${fmtDay(checkIn)} to ${fmtDay(checkOut)}, ${nights} night${nights === 1 ? '' : 's'}, ${naira(total)}).\n\n` +
            (account ? `Please transfer ${naira(total)} to:\n${account}\n\n` : `Please transfer ${naira(total)} to our account.\n\n`) +
            `Send the receipt here before ${until}. If we have not received it by then, the room is released to other guests.`;
        // the money is in: record it, which confirms the booking (and counts the commission)
        const confirmPaid = async () => {
            setBusy(true); setError(null);
            try {
                const res = await fetch(`/api/ops/bookings/${hold.bookingId}/payments`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount: total, method: 'Transfer', note: 'Bank transfer for a locked room', requestId: `${requestId}-pay` }),
                }).catch(() => null);
                if (!res) throw new Error('No connection. Tap again when you have signal: it will not record the money twice.');
                const j = await res.json();
                if (!res.ok) throw new Error(j.error || 'Could not record the payment');
                setReceived(true);
                onRefresh?.();
            } catch (e: any) { setError(e?.message || 'Failed'); } finally { setBusy(false); }
        };
        if (received) {
            return (
                <Sheet title="Booking confirmed" subtitle={`${unitLabel(unit)} · ${fmtDay(checkIn)} → ${fmtDay(checkOut)}`} onClose={onCreated}>
                    <div className="rounded-2xl bg-green-50 border border-green-200 px-4 py-3 text-[13.5px] text-green-900">
                        <p className="font-bold flex items-center gap-1.5"><Check size={15} /> {naira(total)} transfer recorded. {guestName.trim()} has the room.</p>
                    </div>
                    <BigButton onClick={() => openWhatsApp(`Hello ${guestName.trim()}, we have received your payment of ${naira(total)}. ${unitLabel(unit)} is booked for you from ${fmtDay(checkIn)} to ${fmtDay(checkOut)}. Welcome to 9jaRooms!`, phone)}
                        icon={<Share2 size={18} />} className="!bg-[#25D366]">Send confirmation on WhatsApp</BigButton>
                    <BigButton tone="dark" onClick={onCreated}>Done</BigButton>
                </Sheet>
            );
        }
        return (
            <Sheet title={`${unitLabel(unit)} is locked`} subtitle={`For ${hold.holdMinutes} minutes · ${fmtDay(checkIn)} → ${fmtDay(checkOut)}`} onClose={onClose}>
                {error && <p className="text-[13px] text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
                <div className="rounded-2xl bg-green-50 border border-green-200 px-4 py-3 text-[13.5px] text-green-900 space-y-1">
                    <p className="font-bold flex items-center gap-1.5"><Lock size={15} /> Nobody else can book it until {until}</p>
                    <p>Send {guestName.trim()} the message with the account number. When the transfer shows in the account, tap <b>Payment received</b>. If it does not come in time, the room frees itself.</p>
                </div>
                {!account && <p className="text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">No bank account is set yet, so the message does not include one. An admin can add it in Settings → Bank account for transfers.</p>}
                <BigButton onClick={() => openWhatsApp(lockMessage, phone)} icon={<Share2 size={18} />} className="!bg-[#25D366]">
                    {phone.trim() ? `Tell ${guestName.trim()} on WhatsApp` : 'Send on WhatsApp'}
                </BigButton>
                <BigButton onClick={confirmPaid} busy={busy} icon={<Check size={18} />}>Payment received: {naira(total)}</BigButton>
                <p className="text-[12px] text-gray-500 text-center -mt-1">Got only part of it? Tap Done, open the booking and use Record payment.</p>
                <BigButton tone="secondary" onClick={onClose}>Done</BigButton>
            </Sheet>
        );
    }

    if (hold && unit) {
        const link = hold.paystackUrl || hold.payUrl || '';
        const payMessage =
            `Hello ${guestName.trim()}, this is 9jaRooms. ${unitLabel(unit)} is held for you ` +
            `(${fmtDay(checkIn)} to ${fmtDay(checkOut)}, ${nights} night${nights === 1 ? '' : 's'}, ${naira(total)}). ` +
            `Please pay within ${hold.holdMinutes} minutes to confirm: ${link}`;
        const shareLink = () => openWhatsApp(payMessage, phone);   // the guest's chat when we have their number
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
                    {phone.trim() ? `Send link to ${guestName.trim()} on WhatsApp` : 'Send link on WhatsApp'}
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
            title={mode === 'booking' ? 'New booking' : mode === 'hold' ? 'Lock a unit for 15 minutes' : 'Block a unit'}
            subtitle={`${freeCount} of ${data.units.length} units free for these dates`}
            onClose={onClose}
        >
            <Chips
                options={[
                    { value: 'hold', label: 'Lock for 15 min' },
                    { value: 'booking', label: 'Book now' },
                    { value: 'block', label: 'Cleaning / maintenance' },
                ]}
                value={mode}
                onChange={v => setMode(v as 'booking' | 'block' | 'hold')}
            />
            {mode === 'hold' && (
                <p className="text-[12.5px] text-gray-500 -mt-1">
                    Nobody else can book the unit for 15 minutes while the guest pays. Use this for WhatsApp guests.
                </p>
            )}
            {mode === 'hold' && (
                <Field label="How will they pay?">
                    <Chips options={[{ value: 'transfer', label: 'Bank transfer' }, { value: 'paystack', label: 'Paystack link (card)' }]}
                        value={payBy} onChange={v => setPayBy(v as 'transfer' | 'paystack')} />
                </Field>
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
                        <input className={inputCls} value={guestName} onChange={e => { setGuestName(e.target.value); setPicked(false); }} placeholder="Type a name to find a past guest" autoFocus={!!preset.unitId} autoComplete="off" />
                    </Field>
                    <Field label="Phone / WhatsApp">
                        <input type="tel" inputMode="tel" className={inputCls} value={phone} onChange={e => { setPhone(e.target.value); setPicked(false); }} placeholder="080… (or type it to find them)" autoComplete="off" />
                    </Field>
                    {known.length > 0 && (
                        <div className="-mt-2 rounded-xl border border-green-100 bg-green-50/50 overflow-hidden">
                            <p className="px-3 pt-2 text-[10.5px] font-semibold uppercase tracking-wide text-green-700">Stayed with us before: tap to fill</p>
                            {known.map(g => (
                                <button key={`${g.name}|${g.phone}`} type="button"
                                    onClick={() => { setGuestName(g.name); setPhone(g.phone || ''); setPicked(true); setKnown([]); }}
                                    className="w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 border-t border-green-100 first-of-type:border-t-0 active:bg-green-100">
                                    <span className="min-w-0">
                                        <span className="block text-sm font-semibold text-gray-900 truncate">{g.name}</span>
                                        <span className="block text-xs text-gray-500">{g.phone || 'no phone'} · {g.stays} stay{g.stays === 1 ? '' : 's'}, last {fmtDay(g.last)}</span>
                                    </span>
                                    <span className="text-xs font-semibold text-green-700 shrink-0">Use</span>
                                </button>
                            ))}
                        </div>
                    )}
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
                        {mode === 'hold' ? (payBy === 'transfer' ? 'Lock unit for 15 minutes' : 'Lock unit & get payment link') : 'Create booking'}
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
