'use client';

import { useState, useEffect } from 'react';
import { Users, Plus, X } from 'lucide-react';

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
    const [showCreate, setShowCreate] = useState(false);
    const [showPaystack, setShowPaystack] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Form state
    const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
    const [paystackForm, setPaystackForm] = useState({ code: '' });

    useEffect(() => { fetchOwners(); }, []);

    async function fetchOwners() {
        const res = await fetch('/api/admin/users?role=owner');
        const data = await res.json();
        setOwners(data.data || []);
        setLoading(false);
    }

    async function createOwner(e: React.FormEvent) {
        e.preventDefault();
        setCreating(true);
        setError('');

        const res = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...form, role: 'owner' }),
        });

        const data = await res.json();
        if (data.error) {
            setError(data.error);
        } else {
            setSuccess('Owner created successfully');
            setShowCreate(false);
            setForm({ name: '', email: '', phone: '', password: '' });
            fetchOwners();
        }
        setCreating(false);
    }

    function openPaystack(owner: Owner) {
        setShowPaystack(owner.id);
        setPaystackForm({ code: owner.paystack_subaccount_code || '' });
    }

    async function savePaystackCode(e: React.FormEvent) {
        e.preventDefault();
        setCreating(true);
        setError('');

        const res = await fetch('/api/admin/users', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                owner_id: showPaystack,
                paystack_subaccount_code: paystackForm.code,
            }),
        });

        const data = await res.json();
        if (data.error) {
            setError(data.error);
        } else {
            setSuccess('Paystack configuration saved');
            setShowPaystack(null);
            fetchOwners();
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
                    <h1 className="text-2xl font-bold text-gray-900">Owners</h1>
                    <p className="text-gray-500 mt-1">Property owners with Paystack sub-accounts</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
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

            {/* Create Owner Modal */}
            {showCreate && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold">Create Owner</h2>
                            <button onClick={() => setShowCreate(false)}><X size={20} className="text-gray-400" /></button>
                        </div>
                        <form onSubmit={createOwner} className="space-y-4">
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
                            <button type="submit" disabled={creating}
                                className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                                {creating ? 'Creating...' : 'Create Owner Account'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Paystack Subaccount Modal */}
            {showPaystack && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold">Paystack Configuration</h2>
                            <button onClick={() => setShowPaystack(null)}><X size={20} className="text-gray-400" /></button>
                        </div>
                        <form onSubmit={savePaystackCode} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Subaccount Code</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="ACCT_xxxxxxxxx"
                                    value={paystackForm.code}
                                    onChange={e => setPaystackForm({ ...paystackForm, code: e.target.value })}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Enter the Paystack subaccount code for this owner (e.g. ACCT_8f4s1...).
                                    This code will be used to split payments for their properties.
                                </p>
                            </div>
                            <button type="submit" disabled={creating}
                                className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                                {creating ? 'Saving...' : 'Save Configuration'}
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
                                        {!owner.paystack_subaccount_code && (
                                            <button onClick={() => openPaystack(owner)}
                                                className="text-xs text-red-500 hover:text-red-600 font-medium">
                                                Add Paystack
                                            </button>
                                        )}
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
