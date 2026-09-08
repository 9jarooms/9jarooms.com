'use client';

import { useState } from 'react';
import { Plus, Sparkles, Wrench, Check, ExternalLink } from 'lucide-react';
import {
    Sheet, BigButton, KindPill, StatusPill,
    naira, balanceOf, owes, relDay, unitLabel, shiftIso, fmtDay,
    type OpsUnit, type UnitState, type OpsBlock,
} from './shared';

// One physical unit: who is in it, or what to do with it if it's empty.
export default function UnitSheet({ unit, typeName, state, today, blocks, onClose, onOpenBooking, onNewBooking, onBlock, onChanged }: {
    unit: OpsUnit; typeName: string | null; state: UnitState; today: string; blocks: OpsBlock[];
    onClose: () => void;
    onOpenBooking: (id: string) => void;
    onNewBooking: () => void;
    onBlock: (status: 'cleaning' | 'maintenance') => void;
    onChanged: () => void;
}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const b = state.booking;

    // contiguous run of blocked days starting today (exclusive end)
    let runEnd = today;
    while (blocks.some(k => k.room_id === unit.id && k.date === runEnd)) runEnd = shiftIso(runEnd, 1);

    const post = async (payload: Record<string, unknown>) => {
        setBusy(true); setError(null);
        try {
            const res = await fetch('/api/ops/blocks', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (!res.ok) { setError(json.error || 'Failed'); return; }
            onChanged();
            onClose();
        } catch {
            setError('Network error — check your connection and try again');
        } finally {
            setBusy(false);
        }
    };
    const cleanToday = () => post({ roomId: unit.id, from: today, to: shiftIso(today, 1), status: 'cleaning' });
    const clearBlock = () => post({ roomId: unit.id, from: today, to: runEnd, status: 'available' });

    return (
        <Sheet title={unitLabel(unit)} subtitle={typeName || undefined} right={<KindPill kind={state.kind} />} onClose={onClose}>
            {error && <p className="text-[13px] text-[#c75146] bg-red-50 rounded-xl px-3 py-2">{error}</p>}

            {b && (
                <div className="rounded-2xl border border-stone-200 p-4">
                    <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-stone-900">{b.guest_name}</p>
                        <StatusPill status={b.status} />
                    </div>
                    <p className="text-[13px] text-stone-500 mt-0.5">
                        {relDay(b.check_in, today)} → {relDay(b.check_out, today)} · {b.nights} night{b.nights === 1 ? '' : 's'}
                    </p>
                    <p className="text-[13px] mt-1">
                        {naira(b.total_amount)}
                        {owes(b) && <span className="font-bold text-[#c75146]"> · {naira(balanceOf(b))} owing</span>}
                    </p>
                    <BigButton className="mt-3" onClick={() => onOpenBooking(b.id)} icon={<ExternalLink size={17} />}>Open booking</BigButton>
                </div>
            )}

            {state.kind === 'free' && (
                <div className="space-y-2">
                    <BigButton onClick={onNewBooking} icon={<Plus size={18} />}>New booking on {unitLabel(unit)}</BigButton>
                    <BigButton tone="secondary" onClick={cleanToday} busy={busy} icon={<Sparkles size={18} />}>Block for cleaning today</BigButton>
                    <BigButton tone="secondary" onClick={() => onBlock('maintenance')} icon={<Wrench size={18} />}>Block for maintenance…</BigButton>
                </div>
            )}

            {(state.kind === 'cleaning' || state.kind === 'maintenance') && (
                <div className="space-y-2">
                    <p className="text-[13px] text-stone-600">
                        Blocked for <b>{state.kind}</b>
                        {runEnd !== shiftIso(today, 1) ? <> until <b>{fmtDay(shiftIso(runEnd, -1))}</b></> : ' today'}.
                    </p>
                    <BigButton onClick={clearBlock} busy={busy} icon={<Check size={18} />}>Mark as ready</BigButton>
                    <BigButton tone="secondary" onClick={() => onBlock(state.kind === 'cleaning' ? 'cleaning' : 'maintenance')} icon={<Wrench size={18} />}>Change block dates…</BigButton>
                </div>
            )}
        </Sheet>
    );
}
