'use client';

import { useState } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import { CrmProperty } from './types';
import { Overlay } from './BookingFormModal';

export default function ManagePropertiesModal({
    properties, onClose, onChanged,
}: {
    properties: CrmProperty[];
    onClose: () => void;
    onChanged: () => void;
}) {
    const [busy, setBusy] = useState(false);
    const [newName, setNewName] = useState('');
    const [newRooms, setNewRooms] = useState('');
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
        if (!newName.trim()) return;
        const ok = await call('/api/admin/crm/properties', 'POST', { name: newName.trim(), total_rooms: Number(newRooms) || 0, sort_order: properties.length + 1 });
        if (ok) { setNewName(''); setNewRooms(''); }
    }

    return (
        <Overlay title="Manage Properties" onClose={onClose}>
            <p className="text-xs text-gray-500 mb-4">Your properties and their total rooms. Occupancy (“18 of 24”) is measured against the total here.</p>

            <div className="space-y-2 mb-5">
                <div className="flex items-center gap-2 px-1 text-[11px] font-medium text-gray-400">
                    <span className="flex-1">Property name</span><span className="w-24 text-center">Total rooms</span><span className="w-20" />
                </div>
                {properties.map((p) => <PropertyRow key={p.id} property={p} busy={busy}
                    onSave={(body) => call(`/api/admin/crm/properties/${p.id}`, 'PATCH', body)}
                    onDelete={() => { if (confirm(`Delete “${p.name}”? Bookings on it become unassigned.`)) call(`/api/admin/crm/properties/${p.id}`, 'DELETE'); }} />)}
                {properties.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No properties yet.</p>}
            </div>

            <div className="border-t border-gray-100 pt-4">
                <span className="block text-xs font-medium text-gray-500 mb-2">Add a property</span>
                <div className="flex items-center gap-2">
                    <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Kaura Apartments"
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                    <input type="number" min={0} value={newRooms} onChange={(e) => setNewRooms(e.target.value)} placeholder="24"
                        className="w-24 px-3 py-2 text-sm border border-gray-200 rounded-lg text-center" />
                    <button onClick={add} disabled={busy || !newName.trim()} className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50">
                        <Plus size={16} /> Add
                    </button>
                </div>
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-3">{error}</p>}
        </Overlay>
    );
}

function PropertyRow({ property, busy, onSave, onDelete }: { property: CrmProperty; busy: boolean; onSave: (body: Record<string, unknown>) => void; onDelete: () => void }) {
    const [name, setName] = useState(property.name);
    const [rooms, setRooms] = useState(String(property.total_rooms));
    const dirty = name !== property.name || Number(rooms) !== property.total_rooms;

    return (
        <div className="flex items-center gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            <input type="number" min={0} value={rooms} onChange={(e) => setRooms(e.target.value)} className="w-24 px-3 py-2 text-sm border border-gray-200 rounded-lg text-center" />
            <button title="Save" onClick={() => onSave({ name, total_rooms: Number(rooms) || 0 })} disabled={busy || !dirty || !name.trim()}
                className="p-2 rounded-lg text-green-600 hover:bg-green-50 disabled:opacity-30"><Check size={16} /></button>
            <button title="Delete" onClick={onDelete} disabled={busy} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={16} /></button>
        </div>
    );
}
