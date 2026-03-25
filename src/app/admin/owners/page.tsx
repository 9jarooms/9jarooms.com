'use client';

import { useState, useEffect } from 'react';
import { Users, Plus, X, Pencil } from 'lucide-react';

interface Owner {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    user_id: string | null;
    paystack_subaccount_code: string | null;
    created_at: string;
}

export default function OwnersPage() {
    const [owners, setOwners] = useState<Owner[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', paystack_subaccount_code: '' });

    useEffect(() => { fetchOwners(); }, []);

    async function fetchOwners() {
        const res = await fetch('/api/admin/users?role=owner');
        const data = await res.json();
        setOwners(data.data || []);
        setLoading(false);
    }

    function handleEdit(owner: Owner) {
        setEditingId(owner.id);
        setForm({
            name: owner.name,
            email: owner.email,
            phone: owner.phone || '',
            password: '',
            paystack_subaccount_code: owner.paystack_subaccount_code || '',
        });
        setShowModal(true);
    }

    function handleCloseModal() {
        setShowModal(false);
        setEditingId(null);
        setForm({ name: '', email: '', phone: '', password: '', paystack_subaccount_code: '' });
        setError('');
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setError('');

        let res;
        if (editingId) {
            res = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingId,
                    role: 'owner',
                    name: form.name,
                    phone: form.phone || null,
                    paystack_subaccount_code: form.paystack_subaccount_code || null,
                }),
            });
        } else {
            res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: form.name, email: form.email, phone: form.phone, password: form.password, role: 'owner' }),
            });
        }

        const data = await res.json();
        if (data.error) {
            setError(data.error);
        } else {
            setSuccess(editingId ? 'Owner updated successfully' : 'Owner created successfully');
            handleCloseModal();
            fetchOwners();
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
                    <h1 className="text-2xl font-bold text-gray-900">Owners</h1>
                    <p className="text-gray-500 mt-1">Property owners with Paystack sub-accounts</p>
                </div>
                <button
                    onClick={() => { setEditingId(null); setForm({ name: '', email: '', phone: '', password: '', paystack_subaccount_code: '' }); setShowModal(true); }}
                    className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                    <Plus size={16} />
                    Add Owner
                </button>
            </div>

            {(error || success) && (
                <div className={`mb-4 px-4 py-3 rounded-xl text-sm ${error ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
                    {error || success}
                    <button onClick={() => { setError(''); setSuccess(''); }} className="ml-2 font-bold">×</button>
                </div>
            )}

            {/* Create/Edit Owner Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold">{editingId ? 'Edit Owner' : 'Create Owner'}</h2>
                            <button onClick={handleCloseModal}><X size={20} className="text-gray-400" /></button>
                        </div>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                                <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                                    disabled={!!editingId}
                                    className={`w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 ${editingId ? 'opacity-50 cursor-not-allowed' : ''}`} />
                                {editingId && <p className="text-xs text-gray-400 mt-1">Email cannot be changed after creation.</p>}
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
                            {/* Paystack section — shown in both create and edit */}
                            {editingId && (
                                <div className="border-t border-gray-100 pt-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Paystack Subaccount Code</label>
                                    <input type="text" value={form.paystack_subaccount_code} onChange={e => setForm({ ...form, paystack_subaccount_code: e.target.value })}
                                        placeholder="ACCT_xxxxxxxxx"
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500" />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Enter the Paystack subaccount code for payment splitting.
                                    </p>
                                </div>
                            )}
                            <button type="submit" disabled={saving}
                                className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                                {saving ? 'Saving...' : (editingId ? 'Save Changes' : 'Create Owner Account')}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Owners Table */}
            <div className="bg-white rounded-xl border border-gray-100">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[600px]">
                        <thead>
                            <tr className="text-left text-gray-500 border-b border-gray-100">
                                <th className="px-5 py-3 font-medium whitespace-nowrap">Name</th>
                                <th className="px-5 py-3 font-medium whitespace-nowrap">Email</th>
                                <th className="px-5 py-3 font-medium whitespace-nowrap">Phone</th>
                                <th className="px-5 py-3 font-medium whitespace-nowrap">Paystack</th>
                                <th className="px-5 py-3 font-medium whitespace-nowrap">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {owners.map(owner => (
                                <tr key={owner.id} className="border-b border-gray-50 last:border-0">
                                    <td className="px-5 py-3 font-medium text-gray-900 whitespace-nowrap">{owner.name}</td>
                                    <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{owner.email}</td>
                                    <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{owner.phone || '—'}</td>
                                    <td className="px-5 py-3 whitespace-nowrap">
                                        {owner.paystack_subaccount_code ? (
                                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
                                                {owner.paystack_subaccount_code}
                                            </span>
                                        ) : (
                                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                                                Not set
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3 whitespace-nowrap">
                                        <button onClick={() => handleEdit(owner)}
                                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                                            <Pencil size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {owners.length === 0 && (
                                <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">No owners yet. Click &quot;Add Owner&quot; to create one.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
