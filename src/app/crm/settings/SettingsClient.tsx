'use client';

import { useCallback, useEffect, useState } from 'react';
import { UserPlus, Trash2 } from 'lucide-react';

export default function SettingsClient() {
    const [staff, setStaff] = useState<any[]>([]);
    const [form, setForm] = useState({ name: '', email: '', password: '' });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ok, setOk] = useState<string | null>(null);

    const load = useCallback(async () => {
        const res = await fetch('/api/crm/staff');
        if (res.ok) setStaff((await res.json()).staff);
    }, []);

    useEffect(() => { load(); }, [load]);

    const createRep = async () => {
        setBusy(true); setError(null); setOk(null);
        const res = await fetch('/api/crm/staff', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        const json = await res.json();
        setBusy(false);
        if (!res.ok) { setError(json.error); return; }
        setOk(`Customer rep created: ${form.email}`);
        setForm({ name: '', email: '', password: '' });
        load();
    };

    const removeRep = async (userId: string) => {
        if (!confirm('Remove CRM access for this rep?')) return;
        await fetch(`/api/crm/staff?userId=${userId}`, { method: 'DELETE' });
        load();
    };

    return (
        <div className="p-6 max-w-3xl">
            <h1 className="text-xl font-bold text-stone-900 mb-4">Settings</h1>

            <div className="bg-white rounded-xl border border-stone-200 mb-5">
                <h2 className="px-5 py-3.5 text-sm font-bold text-stone-700 border-b border-stone-200">Team access</h2>
                <div className="px-5 py-4">
                    <ul className="divide-y divide-stone-100 mb-4">
                        {staff.map(s => (
                            <li key={s.userId} className="flex items-center justify-between py-2.5 text-sm">
                                <div>
                                    <span className="font-medium text-stone-800">{s.email}</span>
                                    <span className={`ml-2 px-2 py-0.5 rounded-full text-[11px] font-bold ${s.role === 'admin' ? 'bg-stone-800 text-white' : 'bg-[#7ed957]/20 text-[#02572a]'}`}>
                                        {s.role === 'admin' ? 'Admin' : 'Customer rep'}
                                    </span>
                                </div>
                                {s.role === 'customer_rep' && (
                                    <button onClick={() => removeRep(s.userId)} className="text-stone-300 hover:text-[#c75146]">
                                        <Trash2 size={15} />
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>

                    <h3 className="text-xs font-semibold text-stone-600 mb-2 flex items-center gap-1.5">
                        <UserPlus size={14} /> Create customer rep
                    </h3>
                    <p className="text-[11px] text-stone-400 mb-3">
                        Customer reps run the whole CRM: bookings, blocking dates, guests, properties and reports.
                        Caretakers and owners see their dashboards read-only.
                    </p>
                    {error && <p className="text-xs text-[#c75146] bg-red-50 rounded-md px-3 py-2 mb-2">{error}</p>}
                    {ok && <p className="text-xs text-[#02572a] bg-[#7ed957]/15 rounded-md px-3 py-2 mb-2">{ok}</p>}
                    <div className="grid grid-cols-3 gap-2">
                        <input placeholder="Name" className="border border-stone-300 rounded-md px-2.5 py-1.5 text-sm"
                            value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                        <input placeholder="Email" className="border border-stone-300 rounded-md px-2.5 py-1.5 text-sm"
                            value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                        <input placeholder="Password (min 8)" type="password" className="border border-stone-300 rounded-md px-2.5 py-1.5 text-sm"
                            value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                    </div>
                    <div className="flex justify-end mt-3">
                        <button
                            disabled={busy || !form.email || form.password.length < 8}
                            onClick={createRep}
                            className="px-4 py-2 rounded-md bg-[#008737] text-white text-sm font-semibold disabled:opacity-50">
                            {busy ? 'Creating…' : 'Create rep account'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-stone-200">
                <h2 className="px-5 py-3.5 text-sm font-bold text-stone-700 border-b border-stone-200">How roles work now</h2>
                <div className="px-5 py-4 text-sm text-stone-600 space-y-2">
                    <p><b className="text-stone-800">Customer reps</b> — full control: create/edit/cancel bookings, block dates, record payments, manage properties and listings.</p>
                    <p><b className="text-stone-800">Caretakers</b> — read-only dashboard of their assigned properties. They can no longer book or block dates.</p>
                    <p><b className="text-stone-800">Owners</b> — read-only overview of their own properties: bookings and numbers.</p>
                    <p><b className="text-stone-800">Admins</b> — everything reps can do, plus this settings page and the legacy admin panel.</p>
                </div>
            </div>
        </div>
    );
}
