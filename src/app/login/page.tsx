'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
    const router = useRouter();
    const [loginId, setLoginId] = useState(''); // email or username
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // If the input contains @ it's treated as an email; otherwise it's a username
    // and we resolve it to the internal auth email ({username}@9jarooms.internal)
    const resolveAuthEmail = (input: string) =>
        input.includes('@') ? input : `${input.toLowerCase()}@9jarooms.internal`;

    const redirectBasedOnRole = async (accessToken: string) => {
        try {
            const roleResponse = await fetch('/api/auth/role', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            if (!roleResponse.ok) {
                const errText = await roleResponse.text();
                console.error('Role API Error:', errText);
                if (roleResponse.status === 401) {
                    setError('Session invalid, please try again');
                    setLoading(false);
                    return;
                }
                console.warn('Defaulting to dashboard due to role fetch failure');
                router.push('/dashboard');
                return;
            }

            const roleData = await roleResponse.json();
            const role = roleData.role;
            console.log('Login Debug - Resolved Role:', role);

            switch (role) {
                case 'admin':
                    router.refresh();
                    router.push('/admin');
                    break;
                case 'owner':
                    window.location.href = '/owner';
                    break;
                case 'caretaker':
                    router.refresh();
                    router.push('/dashboard');
                    break;
                case 'call_operator':
                    router.refresh();
                    router.push('/operator');
                    break;
                default:
                    router.push('/account'); // default to customer dashboard
            }
        } catch (err) {
            console.error('Redirect Error:', err);
            router.push('/account');
        }
    };

    // Automatically check for an existing session (useful for password resets / email verification links)
    useEffect(() => {
        let mounted = true;
        const supabase = createClient();
        
        const checkInitialSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session && mounted) {
                redirectBasedOnRole(session.access_token);
            }
        };
        checkInitialSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session && mounted) {
                redirectBasedOnRole(session.access_token);
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const supabase = createClient();
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email: resolveAuthEmail(loginId),
                password,
            });

            if (authError || !data.session) {
                setError(authError?.message || 'Login failed');
                setLoading(false);
                return;
            }

            console.log('Login Debug - Auth Success');
            await redirectBasedOnRole(data.session.access_token);
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
                        <img src="/WHITE.jpg" alt="9jaRooms" className="h-[4.5rem] w-auto object-contain" />
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
                                <label className="text-sm font-medium text-gray-700 ml-1">Email or Username</label>
                                <input
                                    type="text"
                                    value={loginId}
                                    onChange={(e) => setLoginId(e.target.value)}
                                    className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all font-medium text-gray-900 placeholder-gray-400"
                                    placeholder="Username or email address"
                                    autoComplete="username"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between ml-1">
                                    <label className="text-sm font-medium text-gray-700">Password</label>
                                    <a href="/forgot-password" className="text-xs text-green-600 hover:text-green-700 font-medium transition-colors">
                                        Forgot password?
                                    </a>
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

                            <p className="text-center text-sm text-gray-600 mt-4">
                                Don't have an account? <a href="/sign-up" className="text-green-600 font-medium hover:underline">Sign up</a>
                            </p>
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
