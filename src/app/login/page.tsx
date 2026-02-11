'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const supabase = createClient();
            // Get user role and redirect accordingly
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError || !data.session) {
                setError(authError?.message || 'Login failed');
                setLoading(false);
                return;
            }

            const accessToken = data.session.access_token;
            console.log('Login Debug - Auth Success, Token:', accessToken.substring(0, 10) + '...');

            // Get user role via secure API (bypasses RLS issues)
            // Explicitly pass token to avoid cookie race conditions
            const roleResponse = await fetch('/api/auth/role', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            if (!roleResponse.ok) {
                const errText = await roleResponse.text();
                console.error('Role API Error:', errText);
                // Fallback: If API fails, try to proceed as guest or show error
                // helpful debugging
                if (roleResponse.status === 401) {
                    setError('Session invalid, please try again');
                    setLoading(false);
                    return;
                }
                // Default to dashboard if role fetch fails but auth succeeded?
                // Safer to show error or default.
                console.warn('Defaulting to dashboard due to role fetch failure');
                router.push('/dashboard');
                return;
            }

            const roleData = await roleResponse.json();
            const role = roleData.role;
            console.log('Login Debug - Resolved Role:', role);

            switch (role) {
                case 'admin':
                    console.log('Login Debug - Redirecting to /admin');
                    router.refresh();
                    router.push('/admin');
                    break;
                case 'owner':
                    console.log('Login Debug - Redirecting to /owner');
                    // Force hard navigation to ensure cookies are sent
                    window.location.href = '/owner';
                    break;
                case 'caretaker':
                    console.log('Login Debug - Redirecting to /dashboard');
                    router.refresh();
                    router.push('/dashboard');
                    break;
                default:
                    console.log('Login Debug - No role matched, redirecting to /dashboard');
                    router.push('/dashboard');
            }
        } catch (err) {
            console.error('Login Debug - Exception:', err);
            setError('An unexpected error occurred');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="max-w-md w-full page-enter">
                {/* Brand */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">
                        9ja<span className="text-green-500">Rooms</span>
                    </h1>
                    <p className="text-gray-500 mt-2">Sign in to your account</p>
                </div>

                {/* Login Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                    <form onSubmit={handleLogin} className="space-y-5">
                        {error && (
                            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-colors"
                                placeholder="you@example.com"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-colors"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Signing in...
                                </span>
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center text-xs text-gray-400 mt-6">
                    Contact your admin for account access
                </p>
            </div>
        </div>
    );
}
