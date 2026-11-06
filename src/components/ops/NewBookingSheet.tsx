'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Share2, Copy, Check, Lock } from 'lucide-react';
import {
    Sheet, BigButton, Field, StayPicker, Chips, inputCls,
    naira, shiftIso, fmtDay, unitLabel, unitPrice, groupAllUnits, openWhatsApp, serverNow, newRequestId, ReceiptPicker, LIVE_STATUSES, type OpsToday,
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
interface HoldResult {
    bookingId: string; paystackUrl: string | null; payUrl: string | null; expiresAt: string; holdMinutes: number; warning?: string | null; transfer?: boolean; bank?: Bank | null;
    // what was actually locked (the screen behind may move on to another free unit afterwards)
    unitLabel: string; total: number; checkIn: string; checkOut: string; nights: number;
}

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
    // WhatsApp guests pay by bank transfer, confirmed when the money is seen in the account
    const [received, setReceived] = useState(false);
    const [paidAmount, setPaidAmount] = useState('');
    const [transferRef, setTransferRef] = useState('');
    const [depositRef, setDepositRef] = useState('');
    const payAttempt = useRef('');
    const [lockMethod, setLockMethod] = useState('Bank Transfer');
    const [lockMins, setLockMins] = useState('15');
    const [lockReceipt, setLockReceipt] = useState<{ path: string; name: string } | null>(null);
    const [copied, setCopied] = useState(false);
    const [guestName, setGuestName] = useState('');
    const [phone, setPhone] = useState('');
    // guests we have hosted before: type part of a name or number and pick them
    const [known, setKnown] = useState<{ name: string; phone: string | null; stays: number; last: string }[]>([]);
    const [picked, setPicked] = useState(false);
    const [source, setSource] = useState(preset.mode === 'hold' ? 'whatsapp' : 'walk_in');
    const [price, setPrice] = useState('');      // '' = the standard price
    const [paidNow, setPaidNow] = useState('');
    const [payMethod, setPayMethod] = useState('');   // no default: staff say how it was paid
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
    // one id per booking attempt: a retry after lost signal returns the same booking, never a second one.
    // A new id as soon as anything that matters changes, so a retry never returns an outdated booking.
    const attemptKey = [mode, effectiveUnitId, checkIn, nights, price, paidNow, payMethod].join('|');
    const freshId = useMemo(() => newRequestId()
        // eslint-disable-next-line react-hooks/exhaustive-deps
        , [attemptKey]);
    // a send whose answer never came back: until we know what happened to it, every tap re-sends
    // that same id (even if the screen behind moved to another unit), so it can never book twice
    // kept for the session too: closing the sheet and starting again still re-checks the lost tap
    // within this sheet, a tap whose answer never came is always re-sent with the same id, whatever
    // was edited since: the server answers with what it saved, and the screen shows exactly that
    const unknownAttempt = useRef<string | null>(null);
    // a lost tap from an earlier sheet: ask the server what happened to it before anything else
    type Earlier = { found: boolean; guestName?: string; unit?: string; total?: number; paid?: number; status?: string };
    const [earlier, setEarlier] = useState<Earlier[] | null>(null);
    const [earlierWaiting, setEarlierWaiting] = useState(0);   // lost taps not yet checked (still no signal)
    useEffect(() => {
        let list: { id: string; at: number }[] = [];
        try { list = JSON.parse(sessionStorage.getItem('pending-booking-requests') || '[]'); } catch { /* ignore */ }
        list = list.filter(x => x?.id && Date.now() - x.at < 24 * 60 * 60 * 1000);
        if (!list.length) return;
        Promise.all(list.map(x => fetch(`/api/ops/request/${encodeURIComponent(x.id)}`).then(r => r.ok ? r.json() : null).catch(() => null)))
            .then(results => {
                const done = results.map((r, i) => r ? list[i].id : null).filter(Boolean);
                const left = list.filter(x => !done.includes(x.id));
                try { sessionStorage.setItem('pending-booking-requests', JSON.stringify(left)); } catch { /* ignore */ }
                setEarlier(results.filter(Boolean) as Earlier[]);
                setEarlierWaiting(left.length);
            });
    }, []);
    const [firstTap, setFirstTap] = useState<{ unit: string; total: number; paid: number; status: string; guest: string } | null>(null);
    const requestId = unknownAttempt.current || freshId;
    const isTransferMethod = /transfer|moniepoint|pos/i.test(payMethod);

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
            const lockFor = Number(lockMins);
            if (mode === 'hold' && (!Number.isInteger(lockFor) || lockFor < 5 || lockFor > 60)) throw new Error('Lock for between 5 and 60 minutes');
            if (!unknownAttempt.current && mode === 'booking' && deposit > 0 && !payMethod) throw new Error('Pick how they paid');
                const send = () => fetch('/api/bookings', {
                method: 'POST', headers,
                body: JSON.stringify({
                    roomId: unit.id, propertyId: unit.property_id || data.propertyId, mode: 'single',
                    guestName: guestName.trim(), guestPhone: phone.trim() || null,
                    checkIn, checkOut,
                    isManualBooking: true, hold: mode === 'hold', lockMinutes: mode === 'hold' ? lockFor : null, bookingSource: source, notes: notes.trim() || null,
                    // price, deposit and booking are saved together, so none of them can be half-done. The
                    // price sent is the one on this screen, so the screen, the message and the booking agree.
                    totalAmount: price !== '' && Number(price) >= 0 ? Number(price) : autoTotal,
                    deposit: mode === 'booking' && deposit > 0 ? { amount: deposit, method: payMethod, reference: depositRef.trim() || null } : null,
                    requestId,
                }),
            }).catch(() => null);
            // signal dropped: try once more by itself (same id, so it can never make two bookings)
            let res = await send();
            if (!res) { await new Promise(r => setTimeout(r, 2500)); res = await send(); }
            if (!res) {
                unknownAttempt.current = requestId;
                try {
                    const list = JSON.parse(sessionStorage.getItem('pending-booking-requests') || '[]') as { id: string; at: number }[];
                    if (!list.some(x => x.id === requestId)) list.push({ id: requestId, at: Date.now() });
                    sessionStorage.setItem('pending-booking-requests', JSON.stringify(list));
                } catch { /* ignore */ }
                throw new Error('No connection. When you have signal, tap the button again: it checks what happened and will not book twice.');
            }
            if (unknownAttempt.current) {
                const done = unknownAttempt.current;
                try { sessionStorage.setItem('pending-booking-requests', JSON.stringify((JSON.parse(sessionStorage.getItem('pending-booking-requests') || '[]') as { id: string }[]).filter(x => x.id !== done))); } catch { /* ignore */ }
            }
            unknownAttempt.current = null;
            const json = await res.json();
            if (!res.ok) { onRefresh?.(); throw new Error(json.error || 'Could not create the booking'); }
            const id = json.bookingId as string;
            if (json.duplicate && json.status === 'pending' && mode !== 'hold') {
                // the first tap made a lock: open it (Payment received is there)
                const lockedUnit = data.units.find(u => u.id === json.roomId) || unit;
                setHold({ bookingId: json.bookingId, paystackUrl: null, payUrl: null, expiresAt: json.expiresAt, holdMinutes: json.holdMinutes || 15, warning: 'Your first tap had already locked this room. Record the money here.',
                    transfer: true, bank: json.bank || null, unitLabel: unitLabel(lockedUnit), total: Number(json.total || 0),
                    checkIn: json.checkIn || checkIn, checkOut: json.checkOut || checkOut, nights: json.nights || nights });
                setPaidAmount(String(deposit > 0 ? deposit : json.total || ''));
                if (payMethod) setLockMethod(payMethod);
                if (depositRef) setTransferRef(depositRef);
                onRefresh?.();
                return;
            }
            if (json.duplicate && json.status !== 'pending') {
                // the first tap had gone through: show exactly what was saved (it may differ from this form)
                const u = data.units.find(x => x.id === json.roomId);
                setFirstTap({ unit: u ? unitLabel(u) : 'the unit', total: Number(json.total || 0), paid: Number(json.paid || 0), status: json.status, guest: json.guestName || guestName.trim() });
                onRefresh?.();
                return;
            }

            if (mode === 'hold') {
                const lockedUnit = data.units.find(u => u.id === (json.roomId || unit.id)) || unit;
                const lockedTotal = json.total != null ? Number(json.total) : total;
                setHold({ bookingId: id, paystackUrl: json.paystackUrl || null, payUrl: json.payUrl || null, expiresAt: json.expiresAt, holdMinutes: json.holdMinutes || 15, warning: json.warning || null,
                    transfer: true, bank: json.bank || null, unitLabel: unitLabel(lockedUnit), total: lockedTotal,
                    checkIn: json.checkIn || checkIn, checkOut: json.checkOut || checkOut, nights: json.nights || nights });
                setPaidAmount(String(lockedTotal));
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

    if (firstTap) {
        const lock = firstTap.status === 'pending';
        return (
            <Sheet title="Your first tap went through" subtitle="Nothing new was created" onClose={onCreated}>
                <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-[13.5px] text-amber-900 space-y-1">
                    <p className="font-bold">{lock ? 'A lock' : 'A booking'} for {firstTap.guest} on <b>{firstTap.unit}</b>, {naira(firstTap.total)}.</p>
                    <p>Money recorded on it: <b>{naira(firstTap.paid)}</b>.</p>
                    <p>If anything you changed since (room, price, money taken, booking instead of lock) is not shown above, open the booking from Today or Bookings and change it there. Give the guest the room shown above.</p>
                </div>
                <BigButton tone="dark" onClick={onCreated}>OK</BigButton>
            </Sheet>
        );
    }

    if (hold) {
        // everything here comes from what was locked, never from the form behind it
        const until = new Date(hold.expiresAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const lapsed = new Date(hold.expiresAt).getTime() < serverNow();
        const b = hold.bank;
        const account = b?.accountNumber ? `${b.bankName} ${b.accountNumber} (${b.accountName})` : '';
        const stay = `${fmtDay(hold.checkIn)} to ${fmtDay(hold.checkOut)}, ${hold.nights} night${hold.nights === 1 ? '' : 's'}, ${naira(hold.total)}`;
        const lockMessage =
            `Hello ${guestName.trim()}, this is 9jaRooms. ${hold.unitLabel} is locked for you for ${hold.holdMinutes} minutes (${stay}).\n\n` +
            (account ? `Please transfer ${naira(hold.total)} to:\n${account}\n\n` : `Please transfer ${naira(hold.total)} to our account.\n\n`) +
            `Send the receipt here before ${until}. If we have not received it by then, the room is released to other guests.`;
        const amount = Number(paidAmount) || 0;
        if (!payAttempt.current) payAttempt.current = newRequestId();
        // the money is in the account: record it with the bank's reference, which confirms the booking
        const confirmPaid = async (force = false) => {
            if (amount <= 0) { setError('Type the amount that came in'); return; }

            setBusy(true); setError(null);
            try {
                const send = () => fetch(`/api/ops/bookings/${hold.bookingId}/payments`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount, method: lockMethod, reference: transferRef.trim() || null, receiptPath: lockReceipt?.path || null, note: 'Payment for a locked room', requestId: payAttempt.current, force }),
                }).catch(() => null);
                let res = await send();
                if (!res) { await new Promise(r => setTimeout(r, 2500)); res = await send(); }
                if (!res) throw new Error('No connection. Tap again when you have signal: it will not record the money twice.');
                const j = await res.json();
                if (!res.ok) {
                    if (!force && ['duplicate', 'overpay'].includes(j.details?.warning)) {
                        setBusy(false);
                        payAttempt.current = '';
                        if (confirm(j.error)) return confirmPaid(true);
                        return;
                    }
                    throw new Error(j.error || 'Could not record the payment');
                }
                setReceived(true);
                onRefresh?.();
            } catch (e: any) { setError(e?.message || 'Failed'); } finally { setBusy(false); }
        };
        if (received) {
            const short = amount + 1 < hold.total;
            return (
                <Sheet title={short ? 'Part payment recorded' : 'Booking confirmed'} subtitle={`${hold.unitLabel} · ${fmtDay(hold.checkIn)} → ${fmtDay(hold.checkOut)}`} onClose={onCreated}>
                    <div className="rounded-2xl bg-green-50 border border-green-200 px-4 py-3 text-[13.5px] text-green-900">
                        <p className="font-bold flex items-center gap-1.5"><Check size={15} /> {naira(amount)} transfer recorded. {guestName.trim()} has the room.</p>
                        {short && <p className="mt-1">They still owe {naira(hold.total - amount)}. It shows on their booking until it is paid.</p>}
                    </div>
                    <BigButton onClick={() => openWhatsApp(`Hello ${guestName.trim()}, we have received your payment of ${naira(amount)}. ${hold.unitLabel} is booked for you from ${fmtDay(hold.checkIn)} to ${fmtDay(hold.checkOut)}.${short ? ` Balance to pay: ${naira(hold.total - amount)}.` : ''} Welcome to 9jaRooms!`, phone)}
                        icon={<Share2 size={18} />} className="!bg-[#25D366]">Send confirmation on WhatsApp</BigButton>
                    <BigButton tone="dark" onClick={onCreated}>Done</BigButton>
                </Sheet>
            );
        }
        return (
            <Sheet title={`${hold.unitLabel} is locked`} subtitle={`For ${hold.holdMinutes} minutes · ${fmtDay(hold.checkIn)} → ${fmtDay(hold.checkOut)}`} onClose={onClose}>
                {error && <p className="text-[13px] text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
                {hold.warning && <p className="text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{hold.warning}</p>}
                <div className={`rounded-2xl border px-4 py-3 text-[13.5px] space-y-1 ${lapsed ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-green-50 border-green-200 text-green-900'}`}>
                    <p className="font-bold flex items-center gap-1.5"><Lock size={15} /> {lapsed ? `The lock ended at ${until}` : `Nobody else can book it until ${until}`}</p>
                    <p>{lapsed
                        ? 'The money can still be recorded: the app checks the room is still free first. If someone else took it, it tells you.'
                        : `Send ${guestName.trim()} the message with the account number. When you see the money in the account, check the amount and tap Payment received. Adding the reference or a receipt photo is optional.`}</p>
                </div>
                {!account && <p className="text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">No bank account is set yet, so the message does not include one. An admin can add it in Settings → Bank account for transfers.</p>}
                <BigButton onClick={() => openWhatsApp(lockMessage, phone)} icon={<Share2 size={18} />} className="!bg-[#25D366]">
                    {phone.trim() ? `Tell ${guestName.trim()} on WhatsApp` : 'Send on WhatsApp'}
                </BigButton>
                <Field label="How did they pay?">
                    <Chips options={['Bank Transfer', 'Cash', 'POS', 'Moniepoint'].map(m => ({ value: m, label: m }))} value={lockMethod}
                        onChange={m => { payAttempt.current = ''; setLockMethod(m); }} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Amount received (₦)">
                        <input type="number" inputMode="numeric" min={0} className={inputCls} value={paidAmount} onChange={e => { payAttempt.current = ''; setPaidAmount(e.target.value); }} />
                    </Field>
                    <Field label="Reference (optional)">
                        <input className={inputCls} value={transferRef} onChange={e => { payAttempt.current = ''; setTransferRef(e.target.value); }} placeholder="from the bank alert" autoComplete="off" />
                    </Field>
                </div>
                <ReceiptPicker bookingId={hold.bookingId} receipt={lockReceipt} onChange={r => { payAttempt.current = ''; setLockReceipt(r); }} />
                <BigButton onClick={() => confirmPaid()} busy={busy} icon={<Check size={18} />}>Payment received: {naira(amount)}</BigButton>
                <BigButton tone="secondary" onClick={onClose}>Done (pay later)</BigButton>
            </Sheet>
        );
    }

    return (
        <Sheet
            title={mode === 'booking' ? 'New booking' : mode === 'hold' ? 'Lock a unit' : 'Block a unit'}
            subtitle={`${freeCount} of ${data.units.length} units free for these dates`}
            onClose={onClose}
        >
            <Chips
                options={[
                    { value: 'hold', label: 'Lock' },
                    { value: 'booking', label: 'Book now' },
                    { value: 'block', label: 'Cleaning / maintenance' },
                ]}
                value={mode}
                onChange={v => setMode(v as 'booking' | 'block' | 'hold')}
            />
            {(earlier?.length || earlierWaiting > 0) ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900 space-y-1">
                    {(earlier || []).map((e, i) => (
                        <p key={i}>{!e.found
                            ? <>An earlier tap with no signal <b>did not go through</b> (nothing was saved from it). Check Today for that guest before booking them again.</>
                            : e.status === 'expired'
                                ? <>An earlier lock for <b>{e.guestName}</b> on <b>{e.unit}</b> <b>ran out</b>: nothing is held for them now. Lock or book again if they still want it{Number(e.paid) > 0 ? ` (₦${Math.round(Number(e.paid)).toLocaleString('en-NG')} is recorded on it: open it from Bookings)` : ''}.</>
                                : ['cancelled', 'no_show'].includes(e.status || '')
                                    ? <>An earlier tap for <b>{e.guestName}</b> on <b>{e.unit}</b> was <b>cancelled</b> (for example the room was taken at that moment): nothing is held. Book again if they still want a room.</>
                                    : <>An earlier tap with no signal <b>did go through</b>: {e.status === 'pending' ? 'a lock (still running)' : 'a booking'} for <b>{e.guestName}</b> on <b>{e.unit}</b>, {naira(e.total)} ({naira(e.paid)} recorded). Don&apos;t book them again; open it from Today or Bookings to change anything.</>}</p>
                    ))}
                    {earlierWaiting > 0 && <p>Still checking {earlierWaiting} earlier tap{earlierWaiting === 1 ? '' : 's'} made with no signal. Check Today before booking the same guest again.</p>}
                    <button type="button" onClick={() => { setEarlier(null); setEarlierWaiting(0); }} className="underline">OK</button>
                </div>
            ) : null}
            {mode === 'hold' && (
                <p className="text-[12.5px] text-gray-500 -mt-1">
                    Nobody else can book the unit while the guest sends the money. You confirm when you see it.
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

            <StayPicker checkIn={checkIn} nights={nights} onCheckIn={setCheckIn} onNights={setNights} />

            {mode === 'hold' && (
                <Field label="Lock for how long?" hint="Up to 60 minutes. The room frees itself when the time is up.">
                    <div className="flex items-center gap-2">
                        {[15, 30, 60].map(m => (
                            <button key={m} type="button" onClick={() => setLockMins(String(m))}
                                className={`h-11 flex-1 rounded-xl border text-[14px] font-semibold ${lockMins === String(m) ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'}`}>{m === 60 ? '1 hour' : `${m} min`}</button>
                        ))}
                        <input type="number" inputMode="numeric" min={5} max={60} aria-label="Minutes" placeholder="Other" value={[15, 30, 60].includes(Number(lockMins)) ? '' : lockMins}
                            onChange={e => setLockMins(e.target.value)} className="h-11 w-20 rounded-xl border border-gray-200 bg-white px-2 text-center text-[16px]" />
                    </div>
                </Field>
            )}

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
                    {deposit > 0 && isTransferMethod && (
                        <Field label="Reference (optional)" hint="From the bank alert or POS slip, if you have it.">
                            <input className={inputCls} value={depositRef} onChange={e => setDepositRef(e.target.value)} autoComplete="off" />
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
                        {mode === 'hold' ? `Lock unit for ${lockMins || '…'} minutes` : 'Create booking'}
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
