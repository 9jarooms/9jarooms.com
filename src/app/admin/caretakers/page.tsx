'use client';

import { useState, useEffect } from 'react';
import { Plus, X, UserCog } from 'lucide-react';

interface Caretaker {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    created_at: string;
}

export default function CaretakersPage() {
    const [caretakers, setCaretakers] = useState<Caretaker[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });

    useEffect(() => { fetchCaretakers(); }, []);

    async function fetchCaretakers() {
        const res = await fetch('/api/admin/users?role=caretaker');
        const data = await res.json();
        setCaretakers(data.data || []);
        setLoading(false);
    }

    async function createCaretaker(e: React.FormEvent) {
        e.preventDefault();
        setCreating(true);
        setError('');

        const res = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...form, role: 'caretaker' }),
        });

        const data = await res.json();
        if (data.error) {
            setError(data.error);
        } else {
            setSuccess('Caretaker created successfully');
            setShowCreate(false);
            setForm({ name: '', email: '', phone: '', password: '' });
            fetchCaretakers();
        }
        setCreating(false);
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
                    onClick={() => setShowCreate(true)}
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

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold">Create Caretaker</h2>
                            <button onClick={() => setShowCreate(false)}><X size={20} className="text-gray-400" /></button>
                        </div>
                        <form onSubmit={createCaretaker} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                                <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500" placeholder="+234..." />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                                <input type="password" required minLength={6} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
                            </div>
                            <p className="text-xs text-gray-400">This creates a login account. The caretaker can sign in and manage assigned properties.</p>
                            <button type="submit" disabled={creating}
                                className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                                {creating ? 'Creating...' : 'Create Caretaker Account'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Caretakers Table */}
            <div className="bg-white rounded-xl border border-gray-100">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-gray-500 border-b border-gray-100">
                                <th className="px-5 py-3 font-medium">Name</th>
                                <th className="px-5 py-3 font-medium">Email</th>
                                <th className="px-5 py-3 font-medium">Phone</th>
                                <th className="px-5 py-3 font-medium">Joined</th>
                            </tr>
                        </thead>
                        <tbody>
                            {caretakers.map(ct => (
                                <tr key={ct.id} className="border-b border-gray-50 last:border-0">
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 text-sm font-bold">
                                                {ct.name[0]}
                                            </div>
                                            <span className="font-medium text-gray-900">{ct.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3 text-gray-600">{ct.email}</td>
                                    <td className="px-5 py-3 text-gray-600">{ct.phone || '—'}</td>
                                    <td className="px-5 py-3 text-gray-400 text-xs">
                                        {new Date(ct.created_at).toLocaleDateString()}
                                    </td>
                                </tr>
                            ))}
                            {caretakers.length === 0 && (
                                <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400">No caretakers yet. Click &quot;Add Caretaker&quot; to create one.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
