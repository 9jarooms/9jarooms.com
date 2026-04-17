'use client';

import { useState, useEffect } from 'react';
import { Mail, User, CheckCircle } from 'lucide-react';

export default function OwnerAccountPage() {
    const [profile, setProfile] = useState<{ name: string; username: string | null; email: string | null } | null>(null);
    const [email, setEmail] = useState('');
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        fetch('/api/user/profile')
            .then(r => r.json())
            .then(data => {
                setProfile(data);
                setEmail(data.email || '');
            });
    }, []);

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');
        const res = await fetch('/api/user/profile', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.trim() }),
        });
        const data = await res.json();
        if (data.error) {
            setError(data.error);
        } else {
            setSuccess('Email saved successfully.');
            setProfile(p => p ? { ...p, email: email.trim() || null } : p);
        }
        setSaving(false);
    }

    if (!profile) {
        return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-gray-200 border-t-green-500 rounded-full animate-spin" /></div>;
    }

    return (
        <div className="page-enter max-w-lg">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">My Account</h1>
                <p className="text-gray-500 mt-1">Manage your profile and login details.</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
                {/* Read-only info */}
                <div className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500">
                            <User size={18} />
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 mb-0.5">Full Name</p>
                            <p className="font-medium text-gray-900">{profile.name}</p>
                        </div>
                    </div>
                    {profile.username && (
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500 font-mono text-sm font-bold">@</div>
                            <div>
                                <p className="text-xs text-gray-400 mb-0.5">Username</p>
                                <p className="font-mono font-medium text-gray-900">{profile.username}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Editable email */}
                <form onSubmit={handleSave} className="p-6 space-y-4">
                    <div className="flex items-start gap-3 mb-2">
                        <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-green-600 mt-0.5">
                            <Mail size={18} />
                        </div>
                        <div>
                            <p className="font-medium text-gray-900">Recovery Email</p>
                            <p className="text-sm text-gray-400">Used for password reset. Not required to log in.</p>
                        </div>
                    </div>

                    {success && (
                        <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-100 px-4 py-2.5 rounded-xl text-sm">
                            <CheckCircle size={15} /> {success}
                        </div>
                    )}
                    {error && (
                        <div className="px-4 py-2.5 rounded-xl text-sm bg-red-50 text-red-600 border border-red-100">{error}</div>
                    )}

                    <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                    />

                    <button type="submit" disabled={saving}
                        className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50">
                        {saving ? 'Saving...' : 'Save Email'}
                    </button>
                </form>
            </div>
        </div>
    );
}
