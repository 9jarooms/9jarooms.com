'use client';

import { useCallback, useEffect, useState } from 'react';
import { UserPlus, Trash2, KeyRound, Landmark } from 'lucide-react';

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', customer_rep: 'Customer rep', caretaker: 'Caretaker' };

export default function SettingsClient() {
    const [staff, setStaff] = useState<any[]>([]);
    const [form, setForm] = useState({ name: '', username: '', password: '', role: 'customer_rep' });
    const [myRole, setMyRole] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ok, setOk] = useState<string | null>(null);

    const load = useCallback(async () => {
        const res = await fetch('/api/crm/staff');
        if (res.ok) { const j = await res.json(); setStaff(j.staff); setMyRole(j.myRole); }
    }, []);

    useEffect(() => { load(); }, [load]);

    // bank account for transfer payments (quoted when a room is locked for a transfer)
    const [bank, setBank] = useState({ bankName: '', accountNumber: '', accountName: '' });
    const [bankMsg, setBankMsg] = useState<string | null>(null);
    useEffect(() => {
        fetch('/api/crm/bank').then(r => r.json()).then(j => { if (j.bank) setBank(j.bank); }).catch(() => {});
    }, []);
    const saveBank = async () => {
        setBankMsg(null);
        const res = await fetch('/api/crm/bank', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bank) });
        const j = await res.json();
        setBankMsg(res.ok ? 'Saved. Staff now quote this account when they lock a room for a transfer.' : j.error || 'Could not save');
    };

    const createRep = async () => {
        setBusy(true); setError(null); setOk(null);
        const res = await fetch('/api/crm/staff', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        const json = await res.json();
        setBusy(false);
        if (!res.ok) { setError(json.error); return; }
        setOk(`${ROLE_LABEL[form.role]} account created. They sign in with the username "${json.username}" and the password you set.`);
        setForm({ name: '', username: '', password: '', role: form.role });
        load();
    };

    const resetPassword = async (userId: string, who: string) => {
        const password = prompt(`New password for ${who} (at least 8 characters):`);
        if (!password) return;
        setError(null); setOk(null);
        const res = await fetch('/api/crm/staff', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, password }) });
        const json = await res.json();
        if (!res.ok) { setError(json.error || 'Could not reset'); return; }
        setOk(`Password changed for ${who}.`);
    };

    const removeRep = async (userId: string, role: string, email: string) => {
        if (!confirm(`Remove ${ROLE_LABEL[role]} access for ${email}?`)) return;
        const res = await fetch(`/api/crm/staff?userId=${userId}&role=${role}`, { method: 'DELETE' });
        if (!res.ok) { setError((await res.json()).error || 'Could not remove'); return; }
        load();
    };

    return (
        <div className="p-4 sm:p-6 max-w-3xl">
            <h1 className="text-[22px] sm:text-[26px] font-extrabold tracking-tight text-stone-900 mb-4">Settings</h1>

            <div className="bg-white rounded-2xl border border-stone-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)] mb-5">
                <h2 className="px-5 py-3.5 text-sm font-bold text-stone-700 border-b border-stone-200">Team access</h2>
                <div className="px-5 py-4">
                    <ul className="divide-y divide-stone-100 mb-4">
                        {staff.map(s => (
                            <li key={s.userId} className="flex items-center justify-between py-2.5 text-sm">
                                <div>
                                    <span className="font-medium text-stone-800">{s.name || s.username || s.email}</span>
                                    <span className="ml-1.5 text-stone-400">{s.username ? `@${s.username}` : s.email}</span>
                                    <span className={`ml-2 px-2 py-0.5 rounded-full text-[11px] font-bold ${s.role === 'admin' ? 'bg-stone-800 text-white' : s.role === 'caretaker' ? 'bg-amber-100 text-amber-800' : 'bg-[#7ed957]/20 text-[#02572a]'}`}>
                                        {ROLE_LABEL[s.role] || s.role}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    {myRole === 'admin' && (
                                        <button onClick={() => resetPassword(s.userId, s.username || s.email)} aria-label="Set a new password" title="Set a new password" className="text-stone-300 hover:text-stone-700">
                                            <KeyRound size={15} />
                                        </button>
                                    )}
                                    <button onClick={() => removeRep(s.userId, s.role, s.username || s.email)} aria-label="Remove access" title="Remove access" className="text-stone-300 hover:text-[#c75146]">
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>

                    <h3 className="text-xs font-semibold text-stone-600 mb-2 flex items-center gap-1.5">
                        <UserPlus size={14} /> Add a team member
                    </h3>
                    <p className="text-[11px] text-stone-400 mb-3">
                        Pick a username and a password, then send both to the person. They sign in at 9jarooms.com/login with the username (no email needed).
                        Every booking they take is tracked to their username for their 1.5% commission.
                    </p>
                    {error && <p className="text-xs text-[#c75146] bg-red-50 rounded-md px-3 py-2 mb-2">{error}</p>}
                    {ok && <p className="text-xs text-[#02572a] bg-[#7ed957]/15 rounded-md px-3 py-2 mb-2">{ok}</p>}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <select className="border border-stone-300 rounded-md px-2.5 py-2 text-sm bg-white" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                            <option value="customer_rep">Customer rep</option>
                            <option value="caretaker">Caretaker</option>
                            <option value="admin">Admin</option>
                        </select>
                        <input placeholder="Name" className="border border-stone-300 rounded-md px-2.5 py-2 text-sm"
                            value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                        <input placeholder="Username e.g. umma" autoCapitalize="none" autoCorrect="off" className="border border-stone-300 rounded-md px-2.5 py-2 text-sm"
                            value={form.username} onChange={e => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s+/g, '') })} />
                        <input placeholder="Password (min 8)" type="password" className="border border-stone-300 rounded-md px-2.5 py-2 text-sm"
                            value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                    </div>
                    <div className="flex justify-end mt-3">
                        <button
                            disabled={busy || form.username.length < 3 || form.password.length < 8}
                            onClick={createRep}
                            className="px-4 py-2 rounded-md bg-[#008737] text-white text-sm font-semibold disabled:opacity-50">
                            {busy ? 'Creating…' : `Create ${ROLE_LABEL[form.role].toLowerCase()} account`}
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-stone-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)] mb-5">
                <h2 className="px-5 py-3.5 text-sm font-bold text-stone-700 border-b border-stone-200 flex items-center gap-1.5"><Landmark size={15} /> Bank account for transfers</h2>
                <div className="px-5 py-4">
                    <p className="text-[11px] text-stone-400 mb-3">When staff lock a room for a guest paying by transfer, the WhatsApp message gives this account.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input placeholder="Bank e.g. GTBank" disabled={myRole !== 'admin'} className="border border-stone-300 rounded-md px-2.5 py-2 text-sm" value={bank.bankName} onChange={e => setBank({ ...bank, bankName: e.target.value })} />
                        <input placeholder="Account number" inputMode="numeric" disabled={myRole !== 'admin'} className="border border-stone-300 rounded-md px-2.5 py-2 text-sm" value={bank.accountNumber} onChange={e => setBank({ ...bank, accountNumber: e.target.value.replace(/\D/g, '').slice(0, 10) })} />
                        <input placeholder="Account name" disabled={myRole !== 'admin'} className="border border-stone-300 rounded-md px-2.5 py-2 text-sm" value={bank.accountName} onChange={e => setBank({ ...bank, accountName: e.target.value })} />
                    </div>
                    {bankMsg && <p className="text-xs text-stone-600 mt-2">{bankMsg}</p>}
                    {myRole === 'admin' && (
                        <div className="flex justify-end mt-3">
                            <button onClick={saveBank} className="px-4 py-2 rounded-md bg-[#008737] text-white text-sm font-semibold">Save bank account</button>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-stone-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                <h2 className="px-5 py-3.5 text-sm font-bold text-stone-700 border-b border-stone-200">How roles work now</h2>
                <div className="px-5 py-4 text-sm text-stone-600 space-y-2">
                    <p><b className="text-stone-800">Customer reps</b> — full control: create/edit/cancel bookings, block dates, record payments, manage properties, rooms, prices, photos and the daily log. Phone app on a phone, this console on a computer.</p>
                    <p><b className="text-stone-800">Caretakers</b> — the Today screen for every 9jaRooms property: check guests in and out, record cash/transfer payments, take walk-in bookings, extend stays and block units for cleaning or maintenance. They can also group rooms and set prices and photos.</p>
                    <p><b className="text-stone-800">Owners</b> — read-only overview of their own properties: bookings and numbers.</p>
                    <p><b className="text-stone-800">Admins</b> — everything reps can do, plus adding or removing admins, resetting passwords, and verifying and paying commission.</p>
                    <p><b className="text-stone-800">Commission</b> — 1.5% of the whole stay on every booking a person takes in the app, counted once it is paid in full. Capped at ₦200,000 a month; ₦500,000+ in a month pays a special ₦300,000. Only bookings an admin verifies are paid, on the last day of the month.</p>
                </div>
            </div>
        </div>
    );
}
