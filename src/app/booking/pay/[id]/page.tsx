import { createServerClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Clock, CreditCard, Shield, RefreshCw } from 'lucide-react';

interface Props {
    params: Promise<{ id: string }>;
}

export default async function BookingPayPage({ params }: Props) {
    const { id } = await params;
    const supabase = createServerClient();

    const { data: booking } = await supabase
        .from('bookings')
        .select('*, room:rooms(name), property:properties(name, address)')
        .eq('id', id)
        .single();

    if (!booking) notFound();

    if (booking.status === 'paid') {
        redirect(`/booking/confirm?reference=${booking.paystack_reference}`);
    }

    const formatPrice = (price: number) =>
        new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(price);

    // If paystack URL is missing, try to regenerate it
    const hasPaymentUrl = !!booking.paystack_authorization_url;

    return (
        <>
            <Header />
            <main className="min-h-screen bg-gray-50 pt-24 pb-12 px-4">
                <div className="max-w-2xl mx-auto">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        {/* Header */}
                        <div className="bg-green-50 p-8 text-center border-b border-green-100">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                                <CreditCard size={32} />
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900">Complete Your Booking</h1>
                            <p className="text-gray-500 mt-2">You're one step away from your stay</p>
                        </div>

                        {/* Details */}
                        <div className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div className="flex justify-between py-2 border-b border-gray-50">
                                    <span className="text-gray-500">Property</span>
                                    <span className="font-semibold text-gray-900">{(booking as any).property?.name}</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-gray-50">
                                    <span className="text-gray-500">Room</span>
                                    <span className="font-semibold text-gray-900">{(booking as any).room?.name}</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-gray-50">
                                    <span className="text-gray-500">Dates</span>
                                    <span className="font-semibold text-gray-900">
                                        {booking.check_in} — {booking.check_out} ({booking.nights} nights)
                                    </span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-gray-50">
                                    <span className="text-gray-500">Total Amount</span>
                                    <span className="font-bold text-green-600 text-lg">{formatPrice(booking.total_amount)}</span>
                                </div>
                            </div>

                            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3 text-sm text-amber-800">
                                <Clock className="shrink-0" size={20} />
                                <p>Please complete payment within 30 minutes to secure your reservation. This link expires soon.</p>
                            </div>

                            {hasPaymentUrl ? (
                                <a
                                    href={booking.paystack_authorization_url}
                                    className="block w-full bg-green-500 hover:bg-green-600 text-white text-center font-bold py-4 rounded-xl transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                                >
                                    Pay {formatPrice(booking.total_amount)} Now
                                </a>
                            ) : (
                                <div className="space-y-3">
                                    <div className="text-center text-red-600 bg-red-50 p-4 rounded-xl border border-red-100">
                                        <p className="font-medium mb-1">Payment link could not be generated</p>
                                        <p className="text-sm text-red-500">This is usually a temporary issue. Please try refreshing or contact support.</p>
                                    </div>
                                    <a
                                        href={`/booking/pay/${id}`}
                                        className="flex items-center justify-center gap-2 w-full bg-gray-900 hover:bg-gray-800 text-white text-center font-semibold py-3 rounded-xl transition-all"
                                    >
                                        <RefreshCw size={16} />
                                        Retry Payment
                                    </a>
                                </div>
                            )}

                            <div className="flex items-center justify-center gap-2 text-xs text-gray-400 mt-4">
                                <Shield size={12} />
                                <span>Secured by Paystack</span>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}
