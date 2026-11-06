'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { LogIn, LogOut, Banknote, CalendarDays, Pencil, ChevronDown, ChevronUp, Trash2, Ban, UserX, Share2, Unlock } from 'lucide-react';
import {
    Sheet, StatusPill, BigButton, Field, StayPicker, Chips, ContactButtons, inputCls,
    naira, balanceOf, owes, fmtDay, shiftIso, unitLabel, waLink, holdCountdown, useLiveUpdates, serverNow, ReceiptPicker, receiptLink, type OpsRole,
} from './shared';

const PAY_METHODS = ['Cash', 'Bank Transfer', 'POS', 'Moniepoint', 'Other'];

interface Detail { booking: any; payments: any[]; paid: number; units: any[]; history?: { at: string; who: string; action: string; detail: any }[] }

const HISTORY_LABEL: Record<string, string> = {
    payment_removed: 'removed a payment', refund: 'recorded a refund', total_changed: 'changed the price', agreed_price: 'set an agreed price',
    cancelled: 'cancelled the booking', no_show: 'marked no-show', commission_reassigned: 'changed who took the booking',
};
function historyDetail(h: { action: string; detail: any }) {
    const d = h.detail || {};
    const n = (x: unknown) => `₦${Math.round(Number(x || 0)).toLocaleString('en-NG')}`;
    if (h.action === 'payment_removed') return ` (${n(d.amount)} ${d.method || ''}${d.reference ? ` ref ${d.reference}` : ''})`;
    if (h.action === 'refund') return ` (${n(Math.abs(Number(d.amount)))})`;
    if (h.action === 'total_changed') return ` (${n(d.from)} → ${n(d.to)})`;
    if (h.action === 'agreed_price') return ` (standard ${n(d.standard)}, agreed ${n(d.agreed)})`;
    return '';
}
type Panel = 'none' | 'pay' | 'stay' | 'guest' | 'more';

// Everything you can do to one booking, biggest buttons first:
// check in / check out / take money, then change the stay, then details.
export default function BookingSheet({ bookingId, role, today, onClose, onChanged }: {
    bookingId: string; role: OpsRole; today: string; onClose: () => void; onChanged: () => void;
}) {
    const [data, setData] = useState<Detail | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [panel, setPanel] = useState<Panel>('none');
    const [pay, setPay] = useState({ amount: '', method: '', reference: '' });   // no default method: staff say how it was paid
    const [stay, setStay] = useState({ unitId: '', checkIn: '', nights: 1, price: 'standard' as 'standard' | 'agreed' | 'keep', agreed: '' });
    const [guest, setGuest] = useState({ guestName: '', guestPhone: '', notes: '' });

    // fill = reset the forms from the booking: only when it opens or after this person saves. A live
    // update from someone else refreshes the figures but never wipes what is being typed.
    const load = useCallback(async (fill = false) => {
        const res = await fetch(`/api/ops/bookings/${bookingId}`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) { setError(json.error || 'Could not load booking'); return; }
        setData(json);
        if (!fill) return;
        const b = json.booking;
        setStay({ unitId: b.room_id || '', checkIn: b.check_in || '', nights: b.nights || 1, price: 'keep', agreed: '' });
        setGuest({ guestName: b.guest_name || '', guestPhone: b.guest_phone || '', notes: b.notes || '' });
        const balance = Math.max(Number(b.total_amount) - Number(json.paid || 0), 0);
        setPay(p => ({ ...p, amount: balance > 0 ? String(balance) : '', reference: '' }));
    }, [bookingId]);

    useEffect(() => { load(true); }, [load]);
    // someone else paid, checked in or changed this booking: show it here too
    useLiveUpdates(load);
    const payRequest = useRef('');
    const [receipt, setReceipt] = useState<{ path: string; name: string } | null>(null);
    // the booking as it was when a panel was opened, to spot a colleague's change before saving over it
    const filledFrom = useRef<Record<string, any>>({});

    const patch = async (payload: Record<string, unknown>): Promise<boolean> => {
        setBusy(true); setError(null);
        try {
            const res = await fetch(`/api/ops/bookings/${bookingId}`, {
                // the status this screen shows: if it changed meanwhile, the server refuses instead of overwriting
                method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedStatus: data?.booking?.status, ...payload }),
            });
            const json = await res.json();
            if (!res.ok) { setError(json.error || 'Failed'); return false; }
            await load(true);
            onChanged();
            return true;
        } catch {
            setError('Network error — check your connection and try again');
            return false;
        } finally {
            setBusy(false);
        }
    };

    const addPayment = async (force = false) => {
        const refund = pay.method === 'Refund';
        const amount = Number(pay.amount) * (refund ? -1 : 1);
        if (!Number(pay.amount) || Number(pay.amount) <= 0) { setError(refund ? 'Enter the amount given back' : 'Enter the amount received'); return; }
        if (!pay.method) { setError('Pick how it was paid'); return; }

        if (!payRequest.current) payRequest.current = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
        setBusy(true); setError(null);
        try {
            const res = await fetch(`/api/ops/bookings/${bookingId}/payments`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                // the same id on a retry: lost signal or a double tap never records the money twice
                body: JSON.stringify({ amount, method: pay.method, reference: pay.reference.trim() || null, receiptPath: receipt?.path || null, requestId: payRequest.current, force }),
            });
            const json = await res.json();
            if (!res.ok) {
                // "looks like a repeat" or "more than the balance": ask, then send again on purpose
                if (!force && ['duplicate', 'overpay'].includes(json.details?.warning)) {
                    setBusy(false);
                    if (confirm(json.error)) { payRequest.current = ''; return addPayment(true); }
                    return;
                }
                setError(json.error || 'Failed to record payment'); return;
            }
            payRequest.current = '';
            setReceipt(null);
            setPanel('none');
            await load(true);
            onChanged();
        } catch {
            setError('Network error — check your connection and try again');
        } finally {
            setBusy(false);
        }
    };

    const removePayment = async (paymentId: string) => {
        if (!confirm('Remove this payment?')) return;
        setBusy(true);
        try {
            await fetch(`/api/ops/bookings/${bookingId}/payments?paymentId=${paymentId}`, { method: 'DELETE' });
            await load();
            onChanged();
        } finally {
            setBusy(false);
        }
    };

    if (!data) {
        return (
            <Sheet title="Booking" onClose={onClose}>
                <p className="text-sm text-gray-500 py-6 text-center">{error || 'Loading…'}</p>
            </Sheet>
        );
    }

    const b = data.booking;
    const balance = balanceOf({ total_amount: b.total_amount, paid: data.paid });
    const owing = owes({ total_amount: b.total_amount, paid: data.paid, status: b.status });
    const canCheckIn = ['pending', 'confirmed', 'paid'].includes(b.status);
    const canCheckOut = b.status === 'checked_in';
    const closed = ['completed', 'cancelled', 'no_show', 'expired'].includes(b.status);
    // a transfer lock that ran out can still take the money: the server checks the room is still free
    const lapsedLock = b.status === 'expired' || (b.status === 'pending' && !!b.expires_at && new Date(b.expires_at).getTime() < serverNow());
    const canRefund = role === 'admin' || role === 'customer_rep';
    const overpaid = Number(data.paid) - Number(b.total_amount);
    const isTransferPay = /transfer|moniepoint|pos/i.test(pay.method);
    const stayNights = Math.max(Number(stay.nights) || 0, 0);
    const stayCheckOut = stay.checkIn ? shiftIso(stay.checkIn, stayNights) : '';
    const autoTotal = Math.round(Number(b.price_per_night || 0) * stayNights);
    const toggle = (p: Panel) => {
        if (panel === p) { setPanel('none'); return; }
        // open with the latest booking (a colleague may have changed it since this sheet opened)
        if (p === 'stay') setStay({ unitId: b.room_id || '', checkIn: b.check_in || '', nights: b.nights || 1, price: 'keep', agreed: '' });
        if (p === 'guest') setGuest({ guestName: b.guest_name || '', guestPhone: b.guest_phone || '', notes: b.notes || '' });
        if (p === 'pay') { payRequest.current = ''; setPay({ amount: balance > 0 ? String(balance) : '', method: '', reference: '' }); }
        filledFrom.current = { checkIn: b.check_in, checkOut: b.check_out, roomId: b.room_id, guestName: b.guest_name, guestPhone: b.guest_phone, notes: b.notes };
        setPanel(p);
    };

    const checkIn = () => {
        if (b.check_in > today) {
            const extra = Math.round((Date.parse(b.check_in) - Date.parse(today)) / 86_400_000);
            if (!confirm(`${b.guest_name} is arriving ${extra} night${extra === 1 ? '' : 's'} early. The stay will start today and ${naira(extra * Number(b.price_per_night || 0))} is added to the total (change it after if you agreed otherwise). Continue?`)) return;
        }
        patch({ status: 'checked_in' });
    };
    const checkOut = () => {
        if (owing && !confirm(`${b.guest_name} still owes ${naira(balance)}. Check out anyway?`)) return;
        if (b.check_out > today && !confirm(`${b.guest_name} is leaving before ${fmtDay(b.check_out)}. The room goes back on sale from tonight. The total stays ${naira(b.total_amount)}: change it under Extend stay first if you are giving money back.`)) return;
        patch({ status: 'completed' });
    };
    const saveStay = async () => {
        if (!stay.checkIn || stayNights < 1) { setError('Pick a check-in date and at least 1 night'); return; }
        const f = filledFrom.current;
        if (f.checkIn && (f.checkIn !== b.check_in || f.checkOut !== b.check_out || f.roomId !== b.room_id)) {
            setStay({ unitId: b.room_id || '', checkIn: b.check_in || '', nights: b.nights || 1, price: 'keep', agreed: '' });
            filledFrom.current = { ...f, checkIn: b.check_in, checkOut: b.check_out, roomId: b.room_id };
            setError('Someone else just changed this stay. The form now shows the latest dates: check and save again.');
            return;
        }
        // only what changed, so this never undoes someone else's edit
        const payload: Record<string, unknown> = {};
        if (stay.unitId !== b.room_id) payload.roomId = stay.unitId;
        if (stay.checkIn !== b.check_in) payload.checkIn = stay.checkIn;
        if (stayCheckOut !== b.check_out) payload.checkOut = stayCheckOut;
        if (stay.price === 'standard') payload.totalAmount = autoTotal;
        if (stay.price === 'agreed') {
            const t = Number(stay.agreed);
            if (!stay.agreed || !Number.isFinite(t) || t < 0) { setError('Type the new total the guest agreed to pay for the whole stay'); return; }
            payload.totalAmount = Math.round(t);
        }
        if (await patch(payload)) setPanel('none');
    };
    const saveGuest = async () => {
        // only the fields this person edited
        const f = filledFrom.current, payload: Record<string, unknown> = {};
        if (guest.guestName !== (f.guestName || '')) payload.guestName = guest.guestName;
        if (guest.guestPhone !== (f.guestPhone || '')) payload.guestPhone = guest.guestPhone || null;
        if (guest.notes !== (f.notes || '')) payload.notes = guest.notes || null;
        if (!Object.keys(payload).length) { setPanel('none'); return; }
        const ok = await patch(payload);
        if (ok) setPanel('none');
    };

    return (
        <Sheet
            title={b.guest_name}
            subtitle={`${b.property?.name || ''} · ${unitLabel(b.room)} · ${fmtDay(b.check_in)} → ${fmtDay(b.check_out)} · ${b.nights} night${b.nights === 1 ? '' : 's'}`}
            right={<StatusPill status={b.status} />}
            onClose={onClose}
        >
            {error && <p className="text-[13px] text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

            {/* money strip */}
            <div className="grid grid-cols-3 rounded-2xl border border-gray-200 divide-x divide-gray-200 text-center overflow-hidden">
                <div className="py-3">
                    <p className="text-[10.5px] uppercase tracking-wide text-gray-400 font-bold">Total</p>
                    <p className="font-bold text-[15px]">{naira(b.total_amount)}</p>
                </div>
                <div className="py-3">
                    <p className="text-[10.5px] uppercase tracking-wide text-gray-400 font-bold">Paid</p>
                    <p className="font-bold text-[15px] text-green-600">{naira(data.paid)}</p>
                </div>
                {overpaid > 1 ? (
                    <div className="py-3 bg-amber-50">
                        <p className="text-[10.5px] uppercase tracking-wide text-amber-700 font-bold">Refund due</p>
                        <p className="font-bold text-[15px] text-amber-700">{naira(overpaid)}</p>
                    </div>
                ) : (
                    <div className={`py-3 ${owing ? 'bg-red-50' : ''}`}>
                        <p className="text-[10.5px] uppercase tracking-wide text-gray-400 font-bold">Balance</p>
                        <p className={`font-bold text-[15px] ${owing ? 'text-red-600' : 'text-gray-500'}`}>{naira(balance)}</p>
                    </div>
                )}
            </div>

            <ContactButtons
                phone={b.guest_phone}
                name={b.guest_name}
                message={`Hello ${b.guest_name}, this is 9jaRooms about your stay (${fmtDay(b.check_in)} to ${fmtDay(b.check_out)}).${owing ? ` Outstanding balance: ${naira(balance)}.` : ''}`}
            />

            {/* an unpaid hold: chase the link or let the unit go */}
            {b.status === 'pending' && (
                <div className="rounded-2xl bg-purple-50 border border-purple-200 p-4 space-y-2">
                    <p className="text-[13px] text-purple-900 font-semibold">
                        Unit held · {holdCountdown(b) || 'no expiry'}. It frees itself if the guest does not pay.
                    </p>
                    {b.paystack_authorization_url && (
                        <a
                            href={waLink(b.guest_phone, `Hello ${b.guest_name}, this is 9jaRooms. Your payment link for ${unitLabel(b.room)} (${fmtDay(b.check_in)} to ${fmtDay(b.check_out)}, ${naira(b.total_amount)}): ${b.paystack_authorization_url}`) || `https://wa.me/?text=${encodeURIComponent(b.paystack_authorization_url)}`}
                            target="_blank" rel="noopener noreferrer"
                            className="h-12 w-full rounded-xl bg-[#25D366] text-white font-bold text-[15px] flex items-center justify-center gap-2"
                        >
                            <Share2 size={18} /> Send payment link again
                        </a>
                    )}
                    <BigButton tone="secondary" busy={busy} icon={<Unlock size={18} />}
                        onClick={() => { if (confirm(`Release ${unitLabel(b.room)}? The unit goes back on the website now.`)) patch({ status: 'cancelled' }); }}>
                        Release hold
                    </BigButton>
                </div>
            )}

            {/* the three things that happen every day */}
            <div className="space-y-2">
                {canCheckIn && (
                    <BigButton onClick={checkIn} busy={busy} icon={<LogIn size={18} />}>
                        Check in{b.check_in > today ? ' early' : ''}
                    </BigButton>
                )}
                {canCheckOut && (
                    <BigButton tone="dark" onClick={checkOut} busy={busy} icon={<LogOut size={18} />}>
                        Check out{owing ? ` · ${naira(balance)} owing` : ''}
                    </BigButton>
                )}
                {(owing || (lapsedLock && balance > 0)) && (!closed || lapsedLock) && (
                    <BigButton tone="amber" onClick={() => toggle('pay')} icon={<Banknote size={18} />}>
                        {lapsedLock ? 'Payment received (lock ran out)' : 'Record payment'}
                    </BigButton>
                )}
                {canRefund && Number(data.paid) > 0 && (overpaid > 1 || ['cancelled', 'no_show'].includes(b.status)) && (
                    <BigButton tone="secondary" onClick={() => { setPay({ amount: String(Math.max(overpaid, 0) || data.paid), method: 'Refund', reference: '' }); setPanel('pay'); }} icon={<Banknote size={18} />}>
                        Record a refund
                    </BigButton>
                )}
            </div>

            {panel === 'pay' && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-3">
                    {lapsedLock && <p className="text-[13px] text-amber-800">The lock ran out. Saving checks the room is still free; if another guest took it, you will be told before anything is recorded.</p>}
                    <Field label={pay.method === 'Refund' ? 'Amount given back (₦)' : 'Amount received (₦)'}>
                        <input type="number" inputMode="numeric" min={0} className={inputCls} value={pay.amount}
                            onChange={e => { payRequest.current = ''; setPay({ ...pay, amount: e.target.value }); }} autoFocus />
                    </Field>
                    <Field label="How was it paid?">
                        <Chips options={[...PAY_METHODS, ...(canRefund ? ['Refund'] : [])].map(m => ({ value: m, label: m }))} value={pay.method}
                            onChange={m => { payRequest.current = ''; setPay({ ...pay, method: m }); }} />
                    </Field>
                    {(isTransferPay || pay.method === 'Refund') && (
                        <Field label="Reference (optional)" hint={isTransferPay ? 'From the bank alert or POS slip, if you have it. It stops the same payment being recorded twice.' : undefined}>
                            <input className={inputCls} value={pay.reference} onChange={e => { payRequest.current = ''; setPay({ ...pay, reference: e.target.value }); }} autoComplete="off" />
                        </Field>
                    )}
                    <ReceiptPicker bookingId={bookingId} receipt={receipt} onChange={r => { payRequest.current = ''; setReceipt(r); }} />
                    <BigButton tone="amber" onClick={() => addPayment()} busy={busy}>Save payment</BigButton>
                </div>
            )}

            {!closed && (
                <>
                    <Row onClick={() => toggle('stay')} icon={<CalendarDays size={18} />} label="Extend stay or change unit" open={panel === 'stay'} />
                    {panel === 'stay' && (
                        <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4 space-y-3">
                            <Field label="Unit">
                                <select className={inputCls} value={stay.unitId} onChange={e => setStay({ ...stay, unitId: e.target.value })}>
                                    {data.units.map((u: any) => <option key={u.id} value={u.id}>{unitLabel(u)}</option>)}
                                </select>
                            </Field>
                            <StayPicker checkIn={stay.checkIn} nights={stayNights} onCheckIn={d => setStay({ ...stay, checkIn: d })} onNights={n => setStay({ ...stay, nights: n })} />
                            <Field label="Price for the whole stay">
                                <Chips value={stay.price} onChange={v => setStay({ ...stay, price: v as typeof stay.price })} options={[
                                    { value: 'standard', label: `Same rate ${naira(autoTotal)}` },
                                    { value: 'agreed', label: 'Agreed / discount' },
                                    { value: 'keep', label: `Keep ${naira(b.total_amount)}` },
                                ]} />
                            </Field>
                            {stay.price === 'agreed' && (
                                <Field label="New total for the whole stay (₦)" hint={`Standard would be ${naira(autoTotal)} (${naira(b.price_per_night)}/night × ${stayNights}). Already paid: ${naira(data.paid)}.`}>
                                    <input type="number" inputMode="numeric" min={0} className={inputCls} value={stay.agreed} placeholder={String(autoTotal)}
                                        onChange={e => setStay({ ...stay, agreed: e.target.value })} autoFocus />
                                </Field>
                            )}
                            <BigButton tone="dark" onClick={saveStay} busy={busy}>Save changes</BigButton>
                        </div>
                    )}
                </>
            )}

            {(role === 'admin' || role === 'customer_rep') && (data.history || []).length > 0 && (
                <details className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-[13px]">
                    <summary className="font-semibold text-gray-700 cursor-pointer">History · who changed what ({data.history!.length})</summary>
                    <ul className="mt-2 space-y-1.5 text-gray-600">
                        {data.history!.map((h, i) => (
                            <li key={i}><span className="text-gray-400">{new Date(h.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span> · <b>{h.who}</b> · {HISTORY_LABEL[h.action] || h.action.replace(/_/g, ' ')}{historyDetail(h)}</li>
                        ))}
                    </ul>
                </details>
            )}

            <Row onClick={() => toggle('guest')} icon={<Pencil size={18} />} label="Guest details & notes" open={panel === 'guest'} />
            {panel === 'guest' && (
                <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4 space-y-3">
                    <Field label="Guest name">
                        <input className={inputCls} value={guest.guestName} onChange={e => setGuest({ ...guest, guestName: e.target.value })} />
                    </Field>
                    <Field label="Phone / WhatsApp">
                        <input type="tel" inputMode="tel" className={inputCls} value={guest.guestPhone} onChange={e => setGuest({ ...guest, guestPhone: e.target.value })} />
                    </Field>
                    <Field label="Notes">
                        <textarea rows={3} className={inputCls} value={guest.notes} onChange={e => setGuest({ ...guest, notes: e.target.value })} />
                    </Field>
                    <BigButton tone="dark" onClick={saveGuest} busy={busy}>Save</BigButton>
                </div>
            )}
            {panel !== 'guest' && b.notes && <p className="text-[13px] text-gray-500 italic px-1">“{b.notes}”</p>}

            {(data.payments.length > 0 || b.status === 'paid') && (
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Payments</p>
                    <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200 overflow-hidden bg-white">
                        {b.status === 'paid' && data.payments.length === 0 && (
                            <li className="px-4 py-2.5 text-[13px] text-green-600 font-semibold">Paid online via Paystack · {naira(b.total_amount)}</li>
                        )}
                        {data.payments.map((p: any) => (
                            <li key={p.id} className="flex items-center justify-between px-4 py-2.5 text-[13px]">
                                <span>
                                    <b>{naira(p.amount)}</b>
                                    <span className="text-gray-400"> · {p.method || '—'} · {new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                                    {p.reference && <span className="block text-[11.5px] text-gray-400">Ref {p.reference}</span>}
                                    {p.receipt_path && <a href={receiptLink(p.receipt_path)} target="_blank" rel="noopener noreferrer" className="block text-[12px] font-semibold text-green-700 underline">View receipt</a>}
                                </span>
                                {role !== 'caretaker' && (
                                    <button type="button" onClick={() => removePayment(p.id)} className="p-2 -mr-2 text-gray-300 hover:text-red-600" aria-label="Remove payment">
                                        <Trash2 size={15} />
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {!closed && (
                <>
                    <Row onClick={() => toggle('more')} icon={<Ban size={18} />} label="No show / cancel" open={panel === 'more'} />
                    {panel === 'more' && (
                        <div className="space-y-2">
                            {b.status !== 'checked_in' && (
                                <BigButton tone="secondary" busy={busy} icon={<UserX size={18} />}
                                    onClick={() => { if (confirm(`Mark ${b.guest_name} as a no-show? The unit becomes free again.`)) patch({ status: 'no_show' }); }}>
                                    Mark as no show
                                </BigButton>
                            )}
                            <BigButton tone="danger" busy={busy} icon={<Ban size={18} />}
                                onClick={() => { if (confirm(`Cancel this booking for ${b.guest_name}?`)) patch({ status: 'cancelled' }); }}>
                                Cancel booking
                            </BigButton>
                        </div>
                    )}
                </>
            )}
        </Sheet>
    );
}

function Row({ onClick, icon, label, open }: { onClick: () => void; icon: ReactNode; label: string; open: boolean }) {
    return (
        <button type="button" onClick={onClick}
            className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white flex items-center gap-3 text-[14px] font-semibold text-gray-800 active:bg-gray-50">
            <span className="text-gray-500">{icon}</span>
            <span className="flex-1 text-left">{label}</span>
            {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>
    );
}
