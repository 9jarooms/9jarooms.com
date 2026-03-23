'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('loading');
        setMessage('');

        try {
            const supabase = createClient();
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });

            if (error) throw error;
            
            setStatus('success');
            setMessage('Check your email for the password reset link. It might take a minute to arrive.');
        } catch (err: any) {
            setStatus('error');
            setMessage(err.message || 'An error occurred while trying to send the reset link.');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <Link href="/" className="block">
                        <img src="/WHITE.jpg" alt="9jaRooms" className="h-[4.5rem] w-auto object-contain" />
                    </Link>
                </div>
            </header>

            <main className="flex-1 flex items-center justify-center px-4 pt-32 pb-12">
                <div className="w-full max-w-[400px]">
                    <div className="mb-8">
                        <Link href="/login" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
                            <ArrowLeft size={16} /> Back to login
                        </Link>
                    </div>

                    <div className="text-center mb-10">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Mail size={28} />
                        </div>
                        <h1 className="text-3xl font-serif text-gray-900 mb-3">Forgot Password?</h1>
                        <p className="text-gray-500 font-light">No worries, we'll send you reset instructions.</p>
                    </div>

                    <div className="bg-white rounded-3xl shadow-xl shadow-gray-100/50 border border-gray-100 p-8 relative overflow-hidden">
                        {status === 'success' ? (
                            <div className="text-center">
                                <CheckCircle2 size={48} className="text-green-500 mx-auto mb-4" />
                                <h3 className="text-lg font-bold text-gray-900 mb-2">Email Sent</h3>
                                <p className="text-sm text-gray-600 mb-6">{message}</p>
                                <button
                                    onClick={() => setStatus('idle')}
                                    className="text-sm font-medium text-green-600 hover:text-green-700"
                                >
                                    Didn't receive it? Try again
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleReset} className="space-y-6">
                                {status === 'error' && (
                                    <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">
                                        {message}
                                    </div>
                                )}

                                <div>
                                    <label className="text-sm font-medium text-gray-700 ml-1 mb-2 block">Email Address</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all font-medium text-gray-900 placeholder-gray-400"
                                        placeholder="Enter your email"
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={status === 'loading' || !email}
                                    className="w-full py-4 bg-green-500 hover:bg-green-600 disabled:opacity-70 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all"
                                >
                                    {status === 'loading' ? 'Sending...' : 'Reset Password'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
