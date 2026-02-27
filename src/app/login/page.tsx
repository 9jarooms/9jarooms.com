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
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header for navigation clarity */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <a href="/" className="block">
                        <img src="/logo.png" alt="9jaRooms" className="h-12 w-auto object-contain" />
                    </a>
                </div>
            </header>

            <main className="flex-1 flex items-center justify-center px-4 pt-32 pb-12 page-enter">
                <div className="w-full max-w-[400px]">

                    <div className="text-center mb-10">
                        <h1 className="text-3xl font-serif text-gray-900 mb-3">Welcome Back</h1>
                        <p className="text-gray-500 font-light">Sign in to manage your bookings and properties.</p>
                    </div>

                    <div className="bg-white rounded-3xl shadow-xl shadow-gray-100/50 border border-gray-100 p-8 md:p-10 relative overflow-hidden">
                        {/* Decorative background blob */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-full blur-3xl opacity-50 -mr-10 -mt-10 pointer-events-none" />

                        <form onSubmit={handleLogin} className="space-y-6 relative z-10">
                            {error && (
                                <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100 flex items-start gap-2">
                                    <div className="mt-0.5 min-w-[4px] h-[14px] bg-red-500 rounded-full" />
                                    {error}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 ml-1">Email Address</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all font-medium text-gray-900 placeholder-gray-400"
                                    placeholder="name@example.com"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between ml-1">
                                    <label className="text-sm font-medium text-gray-700">Password</label>
                                    <button type="button" className="text-xs text-green-600 hover:text-green-700 font-medium transition-colors">
                                        Forgot password?
                                    </button>
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all font-medium text-gray-900 placeholder-gray-400"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-green-900/10 disabled:opacity-70 disabled:cursor-not-allowed transform active:scale-[0.98]"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    </span>
                                ) : (
                                    'Sign In'
                                )}
                            </button>
                        </form>
                    </div>

                    <p className="text-center text-xs text-gray-400 mt-8 font-light">
                        By signing in, you agree to our <a href="#" className="underline hover:text-gray-600">Terms</a> and <a href="#" className="underline hover:text-gray-600">Privacy Policy</a>.
                    </p>
                </div>
            </main>
        </div>
    );
}
