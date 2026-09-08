'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { LogIn, LogOut, Banknote, CalendarDays, Pencil, ChevronDown, ChevronUp, Trash2, Ban, UserX } from 'lucide-react';
import {
    Sheet, StatusPill, BigButton, Field, Stepper, Chips, ContactButtons, inputCls,
    naira, balanceOf, owes, fmtDay, shiftIso, unitLabel, type OpsRole,
} from './shared';

const PAY_METHODS = ['Cash', 'Bank Transfer', 'POS', 'Moniepoint', 'Other'];

interface Detail { booking: any; payments: any[]; paid: number; units: any[] }
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
    const [pay, setPay] = useState({ amount: '', method: 'Cash' });
    const [stay, setStay] = useState({ unitId: '', checkIn: '', nights: 1, autoPrice: true });
    const [guest, setGuest] = useState({ guestName: '', guestPhone: '', notes: '' });

    const load = useCallback(async () => {
        const res = await fetch(`/api/ops/bookings/${bookingId}`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) { setError(json.error || 'Could not load booking'); return; }
        setData(json);
        const b = json.booking;
        setStay({ unitId: b.room_id || '', checkIn: b.check_in || '', nights: b.nights || 1, autoPrice: true });
        setGuest({ guestName: b.guest_name || '', guestPhone: b.guest_phone || '', notes: b.notes || '' });
        const balance = Math.max(Number(b.total_amount) - Number(json.paid || 0), 0);
        setPay(p => ({ ...p, amount: balance > 0 ? String(balance) : '' }));
    }, [bookingId]);

    useEffect(() => { load(); }, [load]);

    const patch = async (payload: Record<string, unknown>): Promise<boolean> => {
        setBusy(true); setError(null);
        try {
            const res = await fetch(`/api/ops/bookings/${bookingId}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (!res.ok) { setError(json.error || 'Failed'); return false; }
            await load();
            onChanged();
            return true;
        } catch {
            setError('Network error — check your connection and try again');
            return false;
        } finally {
            setBusy(false);
        }
    };

    const addPayment = async () => {
        const amount = Number(pay.amount);
        if (!amount || amount <= 0) { setError('Enter the amount received'); return; }
        setBusy(true); setError(null);
        try {
            const res = await fetch(`/api/ops/bookings/${bookingId}/payments`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount, method: pay.method }),
            });
            const json = await res.json();
            if (!res.ok) { setError(json.error || 'Failed to record payment'); return; }
            setPanel('none');
            await load();
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
                <p className="text-sm text-stone-500 py-6 text-center">{error || 'Loading…'}</p>
            </Sheet>
        );
    }

    const b = data.booking;
    const balance = balanceOf({ total_amount: b.total_amount, paid: data.paid });
    const owing = owes({ total_amount: b.total_amount, paid: data.paid, status: b.status });
    const canCheckIn = ['pending', 'confirmed', 'paid'].includes(b.status);
    const canCheckOut = b.status === 'checked_in';
    const closed = ['completed', 'cancelled', 'no_show', 'expired'].includes(b.status);
    const stayNights = Math.max(Number(stay.nights) || 0, 0);
    const stayCheckOut = stay.checkIn ? shiftIso(stay.checkIn, stayNights) : '';
    const autoTotal = Math.round(Number(b.price_per_night || 0) * stayNights);
    const toggle = (p: Panel) => setPanel(panel === p ? 'none' : p);

    const checkIn = () => patch({ status: 'checked_in' });
    const checkOut = () => {
        if (owing && !confirm(`${b.guest_name} still owes ${naira(balance)}. Check out anyway?`)) return;
        patch({ status: 'completed' });
    };
    const saveStay = async () => {
        if (!stay.checkIn || stayNights < 1) { setError('Pick a check-in date and at least 1 night'); return; }
        const payload: Record<string, unknown> = { roomId: stay.unitId, checkIn: stay.checkIn, checkOut: stayCheckOut };
        if (stay.autoPrice) payload.totalAmount = autoTotal;
        if (await patch(payload)) setPanel('none');
    };
    const saveGuest = async () => {
        const ok = await patch({ guestName: guest.guestName, guestPhone: guest.guestPhone || null, notes: guest.notes || null });
        if (ok) setPanel('none');
    };

    return (
        <Sheet
            title={b.guest_name}
            subtitle={`${b.property?.name || ''} · ${unitLabel(b.room)} · ${fmtDay(b.check_in)} → ${fmtDay(b.check_out)} · ${b.nights} night${b.nights === 1 ? '' : 's'}`}
            right={<StatusPill status={b.status} />}
            onClose={onClose}
        >
            {error && <p className="text-[13px] text-[#c75146] bg-red-50 rounded-xl px-3 py-2">{error}</p>}

            {/* money strip */}
            <div className="grid grid-cols-3 rounded-2xl border border-stone-200 divide-x divide-stone-200 text-center overflow-hidden">
                <div className="py-3">
                    <p className="text-[10.5px] uppercase tracking-wide text-stone-400 font-bold">Total</p>
                    <p className="font-extrabold text-[15px]">{naira(b.total_amount)}</p>
                </div>
                <div className="py-3">
                    <p className="text-[10.5px] uppercase tracking-wide text-stone-400 font-bold">Paid</p>
                    <p className="font-extrabold text-[15px] text-[#008737]">{naira(data.paid)}</p>
                </div>
                <div className={`py-3 ${owing ? 'bg-red-50' : ''}`}>
                    <p className="text-[10.5px] uppercase tracking-wide text-stone-400 font-bold">Balance</p>
                    <p className={`font-extrabold text-[15px] ${owing ? 'text-[#c75146]' : 'text-stone-500'}`}>{naira(balance)}</p>
                </div>
            </div>

            <ContactButtons
                phone={b.guest_phone}
                name={b.guest_name}
                message={`Hello ${b.guest_name}, this is 9jaRooms about your stay (${fmtDay(b.check_in)} to ${fmtDay(b.check_out)}).${owing ? ` Outstanding balance: ${naira(balance)}.` : ''}`}
            />

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
                {owing && !closed && (
                    <BigButton tone="amber" onClick={() => toggle('pay')} icon={<Banknote size={18} />}>Record payment</BigButton>
                )}
            </div>

            {panel === 'pay' && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-3">
                    <Field label="Amount received (₦)">
                        <input type="number" inputMode="numeric" min={0} className={inputCls} value={pay.amount}
                            onChange={e => setPay({ ...pay, amount: e.target.value })} autoFocus />
                    </Field>
                    <Field label="How was it paid?">
                        <Chips options={PAY_METHODS.map(m => ({ value: m, label: m }))} value={pay.method} onChange={m => setPay({ ...pay, method: m })} />
                    </Field>
                    <BigButton tone="amber" onClick={addPayment} busy={busy}>Save payment</BigButton>
                </div>
            )}

            {!closed && (
                <>
                    <Row onClick={() => toggle('stay')} icon={<CalendarDays size={18} />} label="Extend stay or change unit" open={panel === 'stay'} />
                    {panel === 'stay' && (
                        <div className="rounded-2xl bg-stone-50 border border-stone-200 p-4 space-y-3">
                            <Field label="Unit">
                                <select className={inputCls} value={stay.unitId} onChange={e => setStay({ ...stay, unitId: e.target.value })}>
                                    {data.units.map((u: any) => <option key={u.id} value={u.id}>{unitLabel(u)}</option>)}
                                </select>
                            </Field>
                            <Field label="Check-in">
                                <input type="date" className={inputCls} value={stay.checkIn} onChange={e => setStay({ ...stay, checkIn: e.target.value })} />
                            </Field>
                            <Field label="Nights">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Stepper value={stayNights} onChange={n => setStay({ ...stay, nights: n })} />
                                    <button type="button" onClick={() => setStay(s => ({ ...s, nights: (Number(s.nights) || 0) + 7 }))}
                                        className="h-11 px-3 rounded-xl border border-stone-300 bg-white text-[13px] font-semibold">+7</button>
                                </div>
                            </Field>
                            <p className="text-[13px] text-stone-600">
                                Check-out <b>{stayCheckOut ? fmtDay(stayCheckOut) : '—'}</b>
                                {stay.autoPrice && stayNights > 0 && <> · new total <b>{naira(autoTotal)}</b></>}
                            </p>
                            <label className="flex items-center gap-2 text-[13px] text-stone-600">
                                <input type="checkbox" className="w-4 h-4" checked={stay.autoPrice} onChange={e => setStay({ ...stay, autoPrice: e.target.checked })} />
                                Recalculate price ({naira(b.price_per_night)}/night)
                            </label>
                            <BigButton tone="dark" onClick={saveStay} busy={busy}>Save changes</BigButton>
                        </div>
                    )}
                </>
            )}

            <Row onClick={() => toggle('guest')} icon={<Pencil size={18} />} label="Guest details & notes" open={panel === 'guest'} />
            {panel === 'guest' && (
                <div className="rounded-2xl bg-stone-50 border border-stone-200 p-4 space-y-3">
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
            {panel !== 'guest' && b.notes && <p className="text-[13px] text-stone-500 italic px-1">“{b.notes}”</p>}

            {(data.payments.length > 0 || b.status === 'paid') && (
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400 mb-1.5">Payments</p>
                    <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 overflow-hidden bg-white">
                        {b.status === 'paid' && data.payments.length === 0 && (
                            <li className="px-4 py-2.5 text-[13px] text-[#008737] font-semibold">Paid online via Paystack · {naira(b.total_amount)}</li>
                        )}
                        {data.payments.map((p: any) => (
                            <li key={p.id} className="flex items-center justify-between px-4 py-2.5 text-[13px]">
                                <span>
                                    <b>{naira(p.amount)}</b>
                                    <span className="text-stone-400"> · {p.method || '—'} · {new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                                </span>
                                {role !== 'caretaker' && (
                                    <button type="button" onClick={() => removePayment(p.id)} className="p-2 -mr-2 text-stone-300 hover:text-[#c75146]" aria-label="Remove payment">
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
            className="w-full h-12 px-4 rounded-xl border border-stone-200 bg-white flex items-center gap-3 text-[14px] font-semibold text-stone-800 active:bg-stone-50">
            <span className="text-stone-500">{icon}</span>
            <span className="flex-1 text-left">{label}</span>
            {open ? <ChevronUp size={16} className="text-stone-400" /> : <ChevronDown size={16} className="text-stone-400" />}
        </button>
    );
}
