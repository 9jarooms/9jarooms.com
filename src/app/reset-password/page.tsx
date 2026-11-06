'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

// Where the "forgot password" email lands. The link signs the person in for this one job; after
// saving, every session on every device ends and they sign in again with the new password.
export default function ResetPasswordPage() {
    const [state, setState] = useState<'checking' | 'ready' | 'invalid' | 'saving' | 'done'>('checking');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        const supabase = createClient();
        const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
            if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) setState(s => s === 'checking' || s === 'invalid' ? 'ready' : s);
        });
        // no session a few seconds after opening: the link was old, already used, or opened elsewhere
        const t = setTimeout(async () => {
            const { data } = await supabase.auth.getSession();
            setState(s => s === 'checking' ? (data.session ? 'ready' : 'invalid') : s);
        }, 3000);
        return () => { clearTimeout(t); sub.subscription.unsubscribe(); };
    }, []);

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length < 10) { setError('Password must be at least 10 characters.'); return; }
        setState('saving'); setError('');
        const supabase = createClient();
        const { error: err } = await supabase.auth.updateUser({ password });
        if (err) { setError(err.message); setState('ready'); return; }
        await supabase.auth.signOut({ scope: 'global' });
        setState('done');
    };

    return (
        <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-[400px] bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-4">Set a new password</h1>
                {state === 'checking' && <p className="text-sm text-gray-500">Checking your link…</p>}
                {state === 'invalid' && (
                    <p className="text-sm text-gray-600">This link has expired or was already used. <Link href="/forgot-password" className="text-green-700 font-semibold">Ask for a new one</Link>.</p>
                )}
                {state === 'done' && (
                    <p className="text-sm text-gray-600">Your password is changed. <a href="/login" className="text-green-700 font-semibold">Sign in</a> with the new one.</p>
                )}
                {(state === 'ready' || state === 'saving') && (
                    <form onSubmit={save} className="space-y-4">
                        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                        <input type="password" autoComplete="new-password" required minLength={10} value={password} onChange={e => setPassword(e.target.value)}
                            placeholder="At least 10 characters" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900" />
                        <button disabled={state === 'saving'} className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl disabled:opacity-60">
                            {state === 'saving' ? 'Saving…' : 'Save new password'}
                        </button>
                    </form>
                )}
            </div>
        </main>
    );
}
