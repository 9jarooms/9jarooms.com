import { notFound } from 'next/navigation';
import { PAYSTACK_MOCK } from '@/lib/paystack';
import { createAdminClient } from '@/lib/supabase/server';
import { ShieldCheck } from 'lucide-react';

// Stand-in for the Paystack checkout page while PAYSTACK_MOCK=1 (local
// demos and tests only). "Pay" sends the guest to /booking/confirm, which
// verifies through the mocked verifyPayment and confirms the booking the
// normal way. 404 in production.
export const dynamic = 'force-dynamic';

export default async function MockPayPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
    if (!PAYSTACK_MOCK) notFound();
    const { ref } = await searchParams;
    if (!ref) notFound();

    const supabase = createAdminClient();
    const { data: booking } = await supabase
        .from('bookings')
        .select('guest_name, total_amount, nights, check_in, check_out, property:properties(name), room:rooms(unit_code, name)')
        .eq('paystack_reference', ref)
        .maybeSingle();
    if (!booking) notFound();
    const b = booking as unknown as { guest_name: string; total_amount: number; nights: number; check_in: string; check_out: string; property?: { name: string } | null; room?: { unit_code: string | null; name: string } | null };
    const naira = '₦' + Math.round(Number(b.total_amount)).toLocaleString('en-NG');

    return (
        <main className="min-h-screen bg-[#0a1f44] text-white flex items-center justify-center px-4">
            <div className="w-full max-w-sm bg-white text-gray-900 rounded-2xl shadow-2xl overflow-hidden">
                <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between">
                    <span className="font-bold text-[#0a1f44] tracking-tight text-lg">Paystack <span className="text-xs font-semibold text-amber-600 align-middle ml-1 px-1.5 py-0.5 bg-amber-50 rounded">TEST</span></span>
                    <span className="text-xs text-gray-400">9jaRooms</span>
                </div>
                <div className="px-6 py-5 space-y-1">
                    <p className="text-sm text-gray-500">{b.property?.name} · {b.room?.unit_code || b.room?.name}</p>
                    <p className="text-sm text-gray-500">{b.check_in} → {b.check_out} · {b.nights} night{b.nights === 1 ? '' : 's'}</p>
                    <p className="text-3xl font-bold tabular-nums pt-2">{naira}</p>
                    <p className="text-sm text-gray-500">for {b.guest_name}</p>
                </div>
                <div className="px-6 pb-6">
                    <a href={`/booking/confirm?reference=${encodeURIComponent(ref)}`}
                        className="block w-full text-center bg-[#09a5db] hover:bg-[#0894c5] text-white font-semibold py-3.5 rounded-xl transition-colors">
                        Pay {naira}
                    </a>
                    <p className="mt-3 text-[11px] text-gray-400 flex items-center justify-center gap-1"><ShieldCheck size={12} /> Simulated payment · no money moves</p>
                </div>
            </div>
        </main>
    );
}
