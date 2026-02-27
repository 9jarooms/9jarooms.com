import { createServerClient } from '@/lib/supabase/server';
import { verifyPayment } from '@/lib/paystack';
import { inngest } from '@/lib/inngest/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { CheckCircle, MapPin, Calendar, Users, XCircle } from 'lucide-react';
import Link from 'next/link';

interface Props {
    searchParams: Promise<{ reference?: string }>;
}

export default async function BookingConfirmPage({ searchParams }: Props) {
    const { reference } = await searchParams;
    const supabase = createServerClient();
    let status = 'loading';
    let booking = null;
    let error = '';

    if (!reference) {
        status = 'error';
        error = 'No payment reference provided';
    } else {
        try {
            // 1. Verify with Paystack
            console.log(`[Confirm] Verifying payment reference: ${reference}`);
            const verification = await verifyPayment(reference);
            console.log(`[Confirm] Paystack verification result:`, JSON.stringify(verification.data?.status));

            if (verification.status && verification.data.status === 'success') {
                status = 'success';

                // 2. Find Booking
                const { data: existingBooking, error: dbError } = await supabase
                    .from('bookings')
                    .select('*, property:properties(*), room:rooms(*)')
                    .eq('paystack_reference', reference)
                    .single();

                if (dbError) {
                    console.error(`[Confirm] DB error finding booking:`, dbError);
                }

                if (existingBooking) {
                    booking = existingBooking;

                    // 3. Update DB if not already paid
                    if (existingBooking.status !== 'paid') {
                        await supabase
                            .from('bookings')
                            .update({ status: 'paid', expires_at: null })
                            .eq('id', existingBooking.id);

                        await supabase
                            .from('availability')
                            .update({ status: 'booked' })
                            .eq('booking_id', existingBooking.id);

                        console.log(`[Confirm] Booking ${existingBooking.id} marked as paid, dates blocked`);

                        // 4. Trigger Post-Payment Workflow (Emails, Notifications) via Inngest
                        // This is best-effort — if it fails, the booking is still confirmed
                        try {
                            await inngest.send({
                                name: 'payment/confirmed',
                                data: {
                                    reference: reference,
                                    amount: verification.data.amount,
                                    paystackData: verification.data,
                                },
                            });
                            console.log(`[Confirm] Inngest payment/confirmed event sent`);
                        } catch (inngestErr: any) {
                            console.error('[Confirm] Inngest event failed (non-blocking):', inngestErr?.message);
                            // Non-blocking: booking is already confirmed, emails can be sent later
                        }
                    }
                } else {
                    status = 'error';
                    error = 'Booking record not found for this reference.';
                }
            } else {
                console.log(`[Confirm] Payment not successful. Paystack status: ${verification.data?.status}`);
                status = 'failed';
                error = `Payment was not completed. Status: ${verification.data?.status || 'unknown'}`;
            }
        } catch (err: any) {
            console.error('[Confirm] Verification error:', err?.message || err);
            status = 'error';
            error = `Failed to verify payment. Please contact support. (${err?.message || 'Unknown error'})`;
        }
    }

    return (
        <>
            <Header />
            <main className="min-h-screen bg-gray-50 pt-24 pb-12 px-4">
                <div className="max-w-2xl mx-auto">
                    {status === 'success' && booking ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="bg-green-600 p-10 text-center text-white">
                                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-sm">
                                    <CheckCircle size={40} className="text-white" />
                                </div>
                                <h1 className="text-3xl font-bold">Booking Confirmed!</h1>
                                <p className="text-green-100 mt-2">Your payment was successful</p>
                            </div>

                            <div className="p-8 space-y-8">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 mb-4">What's Next?</h2>
                                    <p className="text-gray-600 mb-4">
                                        We've sent a confirmation email to <strong>{booking.guest_email}</strong> with all the details.
                                    </p>
                                    <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                                        <h3 className="font-semibold text-green-900 mb-2">Check-in Instructions</h3>
                                        <p className="text-green-800 text-sm leading-relaxed">
                                            {(booking as any).property.check_in_instructions || 'Please contact the caretaker on arrival.'}
                                        </p>
                                    </div>
                                </div>

                                <div className="border-t border-gray-100 pt-8">
                                    <h3 className="font-semibold text-gray-900 mb-4">Reservation Details</h3>
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-3">
                                            <MapPin className="text-gray-400 mt-1" size={20} />
                                            <div>
                                                <p className="font-medium text-gray-900">{(booking as any).property.name}</p>
                                                <p className="text-sm text-gray-500">{(booking as any).property.address}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <Calendar className="text-gray-400 mt-1" size={20} />
                                            <div>
                                                <p className="font-medium text-gray-900">
                                                    {booking.check_in}  —  {booking.check_out}
                                                </p>
                                                <p className="text-sm text-gray-500">
                                                    Check-in: {(booking as any).property.check_in_time} | Check-out: {(booking as any).property.check_out_time}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <Link href="/" className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 text-center py-3 rounded-xl font-medium transition-colors">
                                        Back to Home
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <XCircle size={40} className="text-red-500" />
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">
                                {status === 'failed' ? 'Payment Failed' : 'Something went wrong'}
                            </h1>
                            <p className="text-gray-500 mb-8">{error}</p>
                            <Link href="/" className="text-green-600 font-medium hover:underline">
                                Return to Properties
                            </Link>
                        </div>
                    )}
                </div>
            </main>
            <Footer />
        </>
    );
}
