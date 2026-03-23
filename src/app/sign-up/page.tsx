'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SignUpPage() {
    const router = useRouter();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const supabase = createClient();
            
            // 1. Sign up user
            const { data, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: `${window.location.origin}/login`,
                    data: {
                        name: `${firstName.trim()} ${lastName.trim()}`,
                        first_name: firstName.trim(),
                        last_name: lastName.trim(),
                        phone,
                    }
                }
            });

            if (authError) {
                setError(authError.message);
                setLoading(false);
                return;
            }

            // If email confirmation is enabled, session will be null
            if (data.user && !data.session) {
                setIsSuccess(true);
                setLoading(false);
                return;
            }

            // By default, they have no role in `user_roles`. 
            // They are just customers.
            
            router.push('/account'); // Redirect to customer dashboard
            
        } catch (err) {
            console.error('Sign Up Error:', err);
            setError('An unexpected error occurred during sign up.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
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
                        <h1 className="text-3xl font-serif text-gray-900 mb-3">Create an Account</h1>
                        <p className="text-gray-500 font-light">Join 9jaRooms to book and manage your stays easily.</p>
                    </div>

                    {isSuccess ? (
                        <div className="bg-white rounded-3xl shadow-xl shadow-gray-100/50 border border-green-100 p-8 md:p-10 text-center">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-3">Check your email</h2>
                            <p className="text-gray-600 mb-8">
                                We've sent a verification link to <span className="font-medium text-gray-900">{email}</span>. Please click the link to confirm your account and sign in.
                            </p>
                            <a 
                                href="/login" 
                                className="inline-block w-full py-4 bg-gray-900 hover:bg-black text-white font-semibold rounded-xl transition-all"
                            >
                                Return to Login
                            </a>
                        </div>
                    ) : (
                        <div className="bg-white rounded-3xl shadow-xl shadow-gray-100/50 border border-gray-100 p-8 md:p-10 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl opacity-50 -ml-10 -mt-10 pointer-events-none" />

                            <form onSubmit={handleSignUp} className="space-y-6 relative z-10">
                            {error && (
                                <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100 flex items-start gap-2">
                                    <div className="mt-0.5 min-w-[4px] h-[14px] bg-red-500 rounded-full" />
                                    {error}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 ml-1">First Name</label>
                                    <input
                                        type="text"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-gray-900 placeholder-gray-400"
                                        placeholder="John"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 ml-1">Last Name</label>
                                    <input
                                        type="text"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-gray-900 placeholder-gray-400"
                                        placeholder="Doe"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 ml-1">Email Address</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-gray-900 placeholder-gray-400"
                                    placeholder="name@example.com"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 ml-1">WhatsApp Phone Number</label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-gray-900 placeholder-gray-400"
                                    placeholder="+234..."
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 ml-1">Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-gray-900 placeholder-gray-400"
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 bg-gray-900 hover:bg-black text-white font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-gray-900/10 disabled:opacity-70 disabled:cursor-not-allowed transform active:scale-[0.98]"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    </span>
                                ) : (
                                    'Create Account'
                                )}
                            </button>
                            
                            <p className="text-center text-sm text-gray-600 mt-4">
                                Already have an account? <a href="/login" className="text-blue-600 font-medium hover:underline">Log in</a>
                            </p>
                        </form>
                    </div>
                    )}

                    <p className="text-center text-xs text-gray-400 mt-8 font-light">
                        By creating an account, you agree to our <a href="#" className="underline hover:text-gray-600">Terms</a> and <a href="#" className="underline hover:text-gray-600">Privacy Policy</a>.
                    </p>
                </div>
            </main>
        </div>
    );
}
