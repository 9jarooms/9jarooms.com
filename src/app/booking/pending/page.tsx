import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Clock, Mail, ArrowRight } from 'lucide-react';

interface Props {
    searchParams: Promise<{ email?: string }>;
}

export default async function BookingPendingPage({ searchParams }: Props) {
    const { email } = await searchParams;

    return (
        <>
            <Header />
            <main className="pt-20 page-enter">
                <div className="max-w-lg mx-auto px-4 py-20 text-center">
                    {/* Animated clock */}
                    <div className="w-20 h-20 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Clock size={36} className="text-amber-500" />
                    </div>

                    <h1 className="text-2xl font-bold text-gray-900">Booking Created!</h1>
                    <p className="text-gray-500 mt-3 leading-relaxed">
                        We're generating your payment link. You'll receive it in your email shortly.
                    </p>

                    {email && (
                        <div className="mt-6 p-4 bg-gray-50 rounded-xl flex items-center gap-3">
                            <Mail size={18} className="text-gray-400" />
                            <span className="text-sm text-gray-600">Payment link sent to <strong>{email}</strong></span>
                        </div>
                    )}

                    {/* 30-min warning */}
                    <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-700">
                        <p className="font-semibold mb-1">⏰ 30-Minute Payment Window</p>
                        <p>Complete your payment within 30 minutes. After that, the booking will expire and you'll need to start over.</p>
                    </div>

                    <div className="mt-8 flex flex-col gap-3">
                        <a
                            href="/"
                            className="inline-flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                        >
                            <ArrowRight size={16} />
                            Back to Properties
                        </a>
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}
