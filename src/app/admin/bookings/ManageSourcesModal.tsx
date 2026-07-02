'use client';

import { useState } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import { CrmSource } from './types';
import { Overlay } from './BookingFormModal';

const SWATCHES = ['#2563eb', '#16a34a', '#7c3aed', '#d97706', '#dc2626', '#0891b2', '#db2777', '#6b7280'];

export default function ManageSourcesModal({
    sources, onClose, onChanged,
}: {
    sources: CrmSource[];
    onClose: () => void;
    onChanged: () => void;
}) {
    const [busy, setBusy] = useState(false);
    const [newLabel, setNewLabel] = useState('');
    const [newColor, setNewColor] = useState(SWATCHES[0]);
    const [error, setError] = useState('');

    async function call(url: string, method: string, body?: Record<string, unknown>) {
        setError('');
        setBusy(true);
        const res = await fetch(url, {
            method,
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined,
        });
        setBusy(false);
        if (!res.ok) { setError((await res.json()).error || 'Failed'); return false; }
        onChanged();
        return true;
    }

    async function add() {
        if (!newLabel.trim()) return;
        const ok = await call('/api/admin/crm/sources', 'POST', { label: newLabel.trim(), color: newColor, sort_order: sources.length + 1 });
        if (ok) setNewLabel('');
    }

    return (
        <Overlay title="Manage Sources" onClose={onClose}>
            <p className="text-xs text-gray-500 mb-4">Edit the options in the booking “Source” dropdown. Renaming a source updates it everywhere.</p>

            <div className="space-y-2 mb-5">
                {sources.map((s) => <SourceRow key={s.id} source={s} busy={busy} onSave={(body) => call(`/api/admin/crm/sources/${s.id}`, 'PATCH', body)} onDelete={() => { if (confirm(`Delete “${s.label}”? Bookings tagged with it become untagged.`)) call(`/api/admin/crm/sources/${s.id}`, 'DELETE'); }} />)}
                {sources.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No sources yet.</p>}
            </div>

            <div className="border-t border-gray-100 pt-4">
                <span className="block text-xs font-medium text-gray-500 mb-2">Add a source</span>
                <div className="flex items-center gap-2">
                    <ColorPicker value={newColor} onChange={setNewColor} />
                    <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()}
                        placeholder="e.g. Booking.com" className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                    <button onClick={add} disabled={busy || !newLabel.trim()} className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50">
                        <Plus size={16} /> Add
                    </button>
                </div>
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-3">{error}</p>}
        </Overlay>
    );
}

function SourceRow({ source, busy, onSave, onDelete }: { source: CrmSource; busy: boolean; onSave: (body: Record<string, unknown>) => void; onDelete: () => void }) {
    const [label, setLabel] = useState(source.label);
    const [color, setColor] = useState(source.color || '#6b7280');
    const dirty = label !== source.label || color !== (source.color || '#6b7280');

    return (
        <div className="flex items-center gap-2">
            <ColorPicker value={color} onChange={setColor} />
            <input value={label} onChange={(e) => setLabel(e.target.value)} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            <button title="Save" onClick={() => onSave({ label, color })} disabled={busy || !dirty || !label.trim()}
                className="p-2 rounded-lg text-green-600 hover:bg-green-50 disabled:opacity-30"><Check size={16} /></button>
            <button title="Delete" onClick={onDelete} disabled={busy} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={16} /></button>
        </div>
    );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative">
            <button type="button" onClick={() => setOpen((o) => !o)} className="w-8 h-8 rounded-lg border border-gray-200" style={{ backgroundColor: value }} title="Colour" />
            {open && (
                <div className="absolute z-10 top-9 left-0 bg-white border border-gray-200 rounded-lg p-2 grid grid-cols-4 gap-1 shadow-lg">
                    {SWATCHES.map((c) => (
                        <button key={c} type="button" onClick={() => { onChange(c); setOpen(false); }} className="w-6 h-6 rounded-md border border-gray-100" style={{ backgroundColor: c }} />
                    ))}
                </div>
            )}
        </div>
    );
}
