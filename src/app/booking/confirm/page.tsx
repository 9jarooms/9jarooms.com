'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, MapPin, Calendar, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function BookingConfirmPage() {
    return (
        <Suspense fallback={
            <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4 md:p-8">
                <div className="bg-white rounded-3xl p-12 text-center shadow-lg border border-gray-100 flex flex-col items-center justify-center min-h-[400px] w-full max-w-xl">
                    <Loader2 size={36} className="text-green-600 animate-spin" />
                </div>
            </main>
        }>
            <BookingConfirmContent />
        </Suspense>
    );
}

function BookingConfirmContent() {
    const searchParams = useSearchParams();
    const reference = searchParams.get('reference');

    const [status, setStatus] = useState<'loading' | 'success' | 'failed' | 'error'>('loading');
    const [booking, setBooking] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (!reference) {
            setStatus('error');
            setErrorMsg('No payment reference provided');
            return;
        }

        let isMounted = true;
        let pollCount = 0;
        const maxPolls = 10;

        const verifyBooking = async () => {
            try {
                const res = await fetch(`/api/bookings/verify?reference=${reference}`);
                const result = await res.json();

                if (!isMounted) return;

                if (res.ok && result.status === 'success') {
                    setBooking(result.booking);
                    setStatus('success');
                } else if (res.ok && result.status === 'pending') {
                    // Payment still processing at Paystack... poll again
                    pollCount++;
                    if (pollCount < maxPolls) {
                        setTimeout(verifyBooking, 2000); // Wait 2s before checking again
                    } else {
                        setStatus('failed');
                        setErrorMsg('Payment verification is taking too long. If you were charged, please contact support.');
                    }
                } else {
                    setStatus('error');
                    setErrorMsg(result.error || 'Failed to verify booking');
                }
            } catch (err: any) {
                if (!isMounted) return;
                console.error("Verification err:", err);
                setStatus('error');
                setErrorMsg('An error occurred while verifying your payment. Please contact support.');
            }
        };

        verifyBooking();

        return () => { isMounted = false; };
    }, [reference]);

    return (
        <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 md:p-8">
            <div className="mb-8 relative z-10">
                <Link href="/">
                    <img src="/logo.png" alt="9jaRooms" className="h-10 w-auto" />
                </Link>
            </div>
            <div className="max-w-xl w-full mx-auto">
                    {status === 'loading' && (
                        <div className="bg-white rounded-3xl p-12 text-center shadow-lg border border-gray-100 flex flex-col items-center justify-center min-h-[400px]">
                            <div className="relative mb-8">
                                <div className="absolute inset-0 bg-green-100 rounded-full blur-xl scale-150 animate-pulse"></div>
                                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center relative z-10">
                                    <Loader2 size={36} className="text-green-600 animate-spin" />
                                </div>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Confirming Payment</h2>
                            <p className="text-gray-500 max-w-sm mx-auto">Please wait while we securely verify your payment with Paystack mapping to your booking...</p>
                        </div>
                    )}

                    {status === 'success' && booking && (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in zoom-in duration-500">
                            <div className="bg-green-600 p-10 text-center text-white relative overflow-hidden">
                                <div className="absolute inset-0 bg-[url('/pattern.svg')] opacity-10"></div>
                                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-sm relative z-10">
                                    <CheckCircle size={40} className="text-white" />
                                </div>
                                <h1 className="text-3xl font-bold relative z-10">Booking Confirmed!</h1>
                                <p className="text-green-100 mt-2 relative z-10">Your payment was successful</p>
                            </div>

                            <div className="p-8 space-y-8">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 mb-4">What's Next?</h2>
                                    <p className="text-gray-600 mb-4">
                                        We've sent a confirmation email to <strong>{booking.guest_email}</strong> with all the details.
                                    </p>
                                    <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                                        <h3 className="font-semibold text-green-900 mb-2">Check-in Instructions</h3>
                                        <p className="text-green-800 text-sm leading-relaxed whitespace-pre-wrap">
                                            {booking.property?.check_in_instructions || 'Please contact the caretaker on arrival to get your keys.'}
                                        </p>
                                    </div>
                                </div>

                                <div className="border-t border-gray-100 pt-8">
                                    <h3 className="font-semibold text-gray-900 mb-4">Reservation Details</h3>
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
                                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm shrink-0">
                                                <MapPin className="text-gray-500" size={20} />
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">{booking.property?.name}</p>
                                                <p className="text-sm text-gray-500 mt-0.5">{booking.property?.address}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-start gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
                                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm shrink-0">
                                                <Calendar className="text-gray-500" size={20} />
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">
                                                    {new Date(booking.check_in).toLocaleDateString()} — {new Date(booking.check_out).toLocaleDateString()}
                                                </p>
                                                <div className="text-sm text-gray-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                                                    <span>Check-in: {booking.property?.check_in_time}</span>
                                                    <span>Check-out: {booking.property?.check_out_time}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-2">
                                    <Link href="/" className="flex-1 bg-gray-900 hover:bg-gray-800 text-white text-center py-3.5 rounded-xl font-medium transition-colors">
                                        Return Home
                                    </Link>
                                    <Link href="/properties" className="flex-1 bg-white hover:bg-gray-50 border border-gray-200 text-gray-900 text-center py-3.5 rounded-xl font-medium transition-colors">
                                        Book Another
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )}

                    {(status === 'failed' || status === 'error') && (
                        <div className="bg-white rounded-3xl p-12 text-center shadow-lg border border-red-100 flex flex-col items-center justify-center min-h-[400px]">
                            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <XCircle size={40} className="text-red-500" />
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-3">
                                {status === 'failed' ? 'Payment Failed' : 'Verification Issue'}
                            </h1>
                            <p className="text-gray-500 mb-8 max-w-sm mx-auto">{errorMsg}</p>
                            <Link href="/properties" className="bg-gray-900 text-white px-8 py-3 rounded-full font-medium hover:bg-gray-800 transition-colors">
                                Return to Properties
                            </Link>
                        </div>
                    )}
            </div>
        </main>
    );
}
