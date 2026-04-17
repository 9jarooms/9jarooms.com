'use client';

import { useState, useEffect } from 'react';
import { Plus, X, UserCog, Pencil } from 'lucide-react';

interface Caretaker {
    id: string;
    name: string;
    username: string | null;
    email: string | null;
    phone: string | null;
    created_at: string;
}

export default function CaretakersPage() {
    const [caretakers, setCaretakers] = useState<Caretaker[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [form, setForm] = useState({ name: '', username: '', email: '', phone: '', password: '' });

    useEffect(() => { fetchCaretakers(); }, []);

    async function fetchCaretakers() {
        const res = await fetch('/api/admin/users?role=caretaker');
        const data = await res.json();
        setCaretakers(data.data || []);
        setLoading(false);
    }

    function handleEdit(ct: Caretaker) {
        setEditingId(ct.id);
        setForm({ name: ct.name, username: ct.username || '', email: ct.email || '', phone: ct.phone || '', password: '' });
        setShowModal(true);
    }

    function handleCloseModal() {
        setShowModal(false);
        setEditingId(null);
        setForm({ name: '', username: '', email: '', phone: '', password: '' });
        setError('');
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setError('');

        let res;
        if (editingId) {
            // Update existing
            res = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingId,
                    role: 'caretaker',
                    name: form.name,
                    email: form.email,
                    phone: form.phone || null,
                }),
            });
        } else {
            // Create new
            res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: form.username,
                    email: form.email || undefined,
                    name: form.name,
                    phone: form.phone || undefined,
                    password: form.password,
                    role: 'caretaker',
                }),
            });
        }

        const data = await res.json();
        if (data.error) {
            setError(data.error);
        } else {
            setSuccess(editingId ? 'Caretaker updated successfully' : 'Caretaker created successfully');
            handleCloseModal();
            fetchCaretakers();
        }
        setSaving(false);
    }

    if (loading) {
        return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-3 border-gray-200 border-t-red-500 rounded-full animate-spin" /></div>;
    }

    return (
        <div className="page-enter">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Caretakers</h1>
                    <p className="text-gray-500 mt-1">Property managers who handle bookings and availability</p>
                </div>
                <button
                    onClick={() => { setEditingId(null); setForm({ name: '', username: '', email: '', phone: '', password: '' }); setShowModal(true); }}
                    className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                    <Plus size={16} />
                    Add Caretaker
                </button>
            </div>

            {(error || success) && (
                <div className={`mb-4 px-4 py-3 rounded-xl text-sm ${error ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
                    {error || success}
                    <button onClick={() => { setError(''); setSuccess(''); }} className="ml-2 font-bold">×</button>
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold">{editingId ? 'Edit Caretaker' : 'Create Caretaker'}</h2>
                            <button onClick={handleCloseModal}><X size={20} className="text-gray-400" /></button>
                        </div>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                                <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
                            </div>
                            {!editingId && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                                    <input type="text" required value={form.username}
                                        onChange={e => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                                        placeholder="e.g. john_caretaker"
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
                                    <p className="text-xs text-gray-400 mt-1">Used to log in. Letters, numbers, _ and - only.</p>
                                </div>
                            )}
                            {editingId && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                                    <input type="text" value={form.username} disabled
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm opacity-50 cursor-not-allowed" />
                                    <p className="text-xs text-gray-400 mt-1">Username cannot be changed.</p>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Email <span className="text-gray-400 font-normal">(optional)</span>
                                </label>
                                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                                    placeholder="For password reset and notifications"
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500" placeholder="+234..." />
                            </div>
                            {!editingId && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                                    <input type="password" required minLength={6} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
                                </div>
                            )}
                            {!editingId && <p className="text-xs text-gray-400">They log in with their username and password.</p>}
                            <button type="submit" disabled={saving}
                                className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                                {saving ? 'Saving...' : (editingId ? 'Save Changes' : 'Create Caretaker Account')}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Caretakers Table */}
            <div className="bg-white rounded-xl border border-gray-100">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[500px]">
                        <thead>
                            <tr className="text-left text-gray-500 border-b border-gray-100">
                                <th className="px-5 py-3 font-medium whitespace-nowrap">Name</th>
                                <th className="px-5 py-3 font-medium whitespace-nowrap">Username</th>
                                <th className="px-5 py-3 font-medium whitespace-nowrap">Email</th>
                                <th className="px-5 py-3 font-medium whitespace-nowrap">Phone</th>
                                <th className="px-5 py-3 font-medium whitespace-nowrap">Joined</th>
                                <th className="px-5 py-3 font-medium whitespace-nowrap">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {caretakers.map(ct => (
                                <tr key={ct.id} className="border-b border-gray-50 last:border-0">
                                    <td className="px-5 py-3 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 text-sm font-bold">
                                                {ct.name[0]}
                                            </div>
                                            <span className="font-medium text-gray-900">{ct.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3 whitespace-nowrap">
                                        <span className="font-mono text-sm text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                                            {ct.username || '—'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap text-sm">{ct.email || <span className="text-gray-300">not set</span>}</td>
                                    <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{ct.phone || '—'}</td>
                                    <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">
                                        {new Date(ct.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-5 py-3 whitespace-nowrap">
                                        <button onClick={() => handleEdit(ct)}
                                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                                            <Pencil size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {caretakers.length === 0 && (
                                <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">No caretakers yet. Click &quot;Add Caretaker&quot; to create one.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
