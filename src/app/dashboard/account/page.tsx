'use client';

import { useState, useEffect } from 'react';
import { Mail, User, Phone, Lock, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Profile = {
    name: string;
    username: string | null;
    email: string | null;
    phone: string | null;
    role: string;
};

function Alert({ type, message }: { type: 'success' | 'error'; message: string }) {
    return (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border ${
            type === 'success'
                ? 'text-green-700 bg-green-50 border-green-100'
                : 'text-red-600 bg-red-50 border-red-100'
        }`}>
            {type === 'success' && <CheckCircle size={15} />}
            {message}
        </div>
    );
}

export default function AccountPage() {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [contactSaving, setContactSaving] = useState(false);
    const [contactMsg, setContactMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [pwSaving, setPwSaving] = useState(false);
    const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        fetch('/api/user/profile')
            .then(r => r.json())
            .then((data: Profile) => {
                setProfile(data);
                setEmail(data.email || '');
                setPhone(data.phone || '');
            });
    }, []);

    async function handleContactSave(e: React.FormEvent) {
        e.preventDefault();
        setContactSaving(true);
        setContactMsg(null);
        const res = await fetch('/api/user/profile', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.trim(), phone: phone.trim() }),
        });
        const data = await res.json();
        if (data.error) {
            setContactMsg({ type: 'error', text: data.error });
        } else {
            setContactMsg({ type: 'success', text: 'Contact details saved.' });
            setProfile(p => p ? { ...p, email: email.trim() || null, phone: phone.trim() || null } : p);
        }
        setContactSaving(false);
    }

    async function handlePasswordChange(e: React.FormEvent) {
        e.preventDefault();
        setPwMsg(null);

        if (newPassword.length < 8) {
            setPwMsg({ type: 'error', text: 'New password must be at least 8 characters.' });
            return;
        }
        if (newPassword !== confirmPassword) {
            setPwMsg({ type: 'error', text: 'Passwords do not match.' });
            return;
        }

        setPwSaving(true);
        const supabase = createClient();

        // Verify current password by re-authenticating
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) {
            setPwMsg({ type: 'error', text: 'Unable to verify identity.' });
            setPwSaving(false);
            return;
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: currentPassword,
        });

        if (signInError) {
            setPwMsg({ type: 'error', text: 'Current password is incorrect.' });
            setPwSaving(false);
            return;
        }

        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) {
            setPwMsg({ type: 'error', text: error.message });
        } else {
            setPwMsg({ type: 'success', text: 'Password updated successfully.' });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        }
        setPwSaving(false);
    }

    if (!profile) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-gray-200 border-t-green-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="page-enter max-w-lg space-y-6">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">My Account</h1>
                <p className="text-gray-500 mt-1">Manage your profile and login details.</p>
            </div>

            {/* Profile Info (read-only) */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
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

            {/* Contact Details */}
            <div className="bg-white rounded-2xl border border-gray-100">
                <div className="p-6 border-b border-gray-50">
                    <h2 className="font-semibold text-gray-900">Contact Details</h2>
                    <p className="text-sm text-gray-400 mt-0.5">Used for booking confirmation emails and WhatsApp alerts.</p>
                </div>
                <form onSubmit={handleContactSave} className="p-6 space-y-4">
                    {contactMsg && <Alert type={contactMsg.type} message={contactMsg.text} />}

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                            <Mail size={12} /> Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                            <Phone size={12} /> WhatsApp Number
                        </label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            placeholder="e.g. 08012345678"
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                        />
                        <p className="text-xs text-gray-400">This number receives WhatsApp notifications when a booking is made at your property.</p>
                    </div>

                    <button
                        type="submit"
                        disabled={contactSaving}
                        className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                    >
                        {contactSaving ? 'Saving...' : 'Save Contact Details'}
                    </button>
                </form>
            </div>

            {/* Change Password */}
            <div className="bg-white rounded-2xl border border-gray-100">
                <div className="p-6 border-b border-gray-50">
                    <h2 className="font-semibold text-gray-900">Change Password</h2>
                    <p className="text-sm text-gray-400 mt-0.5">Must be at least 8 characters.</p>
                </div>
                <form onSubmit={handlePasswordChange} className="p-6 space-y-4">
                    {pwMsg && <Alert type={pwMsg.type} message={pwMsg.text} />}

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                            <Lock size={12} /> Current Password
                        </label>
                        <div className="relative">
                            <input
                                type={showCurrent ? 'text' : 'password'}
                                value={currentPassword}
                                onChange={e => setCurrentPassword(e.target.value)}
                                placeholder="Enter current password"
                                required
                                className="w-full px-4 py-2.5 pr-10 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                            />
                            <button type="button" onClick={() => setShowCurrent(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">New Password</label>
                        <div className="relative">
                            <input
                                type={showNew ? 'text' : 'password'}
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                placeholder="New password"
                                required
                                className="w-full px-4 py-2.5 pr-10 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                            />
                            <button type="button" onClick={() => setShowNew(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Confirm New Password</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            placeholder="Repeat new password"
                            required
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={pwSaving}
                        className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                    >
                        {pwSaving ? 'Updating...' : 'Update Password'}
                    </button>
                </form>
            </div>
        </div>
    );
}
