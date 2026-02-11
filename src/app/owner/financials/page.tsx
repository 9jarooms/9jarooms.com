import { createAuthClient } from '@/lib/supabase/auth';
import { createClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';

function getServiceSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

export default async function OwnerFinancialsPage() {
    const authClient = await createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) redirect('/login');

    const supabase = getServiceSupabase();

    const { data: owner } = await supabase
        .from('owners')
        .select('id, name, paystack_subaccount_code')
        .eq('user_id', user.id)
        .single();

    if (!owner) return <div className="text-center py-20 text-gray-400">Owner profile not found</div>;

    // Get properties
    const { data: properties } = await supabase
        .from('properties')
        .select('id, name')
        .eq('owner_id', owner.id);

    const propertyIds = properties?.map((p: any) => p.id) || [];

    // Get all bookings for financial calculations
    const { data: bookings } = propertyIds.length > 0
        ? await supabase
            .from('bookings')
            .select('total_amount, status, property_id, created_at')
            .in('property_id', propertyIds)
        : { data: [] };

    const paidBookings = bookings?.filter((b: any) => b.status === 'paid') || [];
    const totalRevenue = paidBookings.reduce((sum: number, b: any) => sum + Number(b.total_amount), 0);
    const platformFee = totalRevenue * 0.10; // 10% platform fee
    const ownerPayout = totalRevenue - platformFee;

    // Revenue per property
    const revenueByProperty = properties?.map((prop: any) => {
        const propBookings = paidBookings.filter((b: any) => b.property_id === prop.id);
        const revenue = propBookings.reduce((sum: number, b: any) => sum + Number(b.total_amount), 0);
        return { name: prop.name, revenue, bookings: propBookings.length };
    }) || [];

    // Monthly breakdown (last 6 months)
    const monthlyRevenue: { month: string; revenue: number; bookings: number }[] = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthStr = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        const monthBookings = paidBookings.filter((b: any) => {
            const bd = new Date(b.created_at);
            return bd.getMonth() === d.getMonth() && bd.getFullYear() === d.getFullYear();
        });
        monthlyRevenue.push({
            month: monthStr,
            revenue: monthBookings.reduce((sum: number, b: any) => sum + Number(b.total_amount), 0),
            bookings: monthBookings.length,
        });
    }

    const formatPrice = (n: number) => new Intl.NumberFormat('en-NG').format(n);

    return (
        <div className="page-enter">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Financials</h1>
                <p className="text-gray-500 mt-1">Revenue breakdown and payout summary</p>
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center text-green-600">
                            <DollarSign size={20} />
                        </div>
                        <p className="text-sm text-gray-500">Total Revenue</p>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">₦{formatPrice(totalRevenue)}</p>
                    <p className="text-xs text-gray-400 mt-1">{paidBookings.length} paid bookings</p>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center text-red-600">
                            <ArrowDownRight size={20} />
                        </div>
                        <p className="text-sm text-gray-500">Platform Fee (10%)</p>
                    </div>
                    <p className="text-3xl font-bold text-red-600">-₦{formatPrice(platformFee)}</p>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600">
                            <ArrowUpRight size={20} />
                        </div>
                        <p className="text-sm text-gray-500">Your Payout</p>
                    </div>
                    <p className="text-3xl font-bold text-purple-600">₦{formatPrice(ownerPayout)}</p>
                    {owner.paystack_subaccount_code && (
                        <p className="text-xs text-gray-400 mt-1">Paystack: {owner.paystack_subaccount_code}</p>
                    )}
                </div>
            </div>

            {/* Revenue by Property */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white rounded-xl border border-gray-100">
                    <div className="p-5 border-b border-gray-50">
                        <h2 className="font-semibold text-gray-900">Revenue by Property</h2>
                    </div>
                    <div className="p-5 space-y-3">
                        {revenueByProperty.map(prop => (
                            <div key={prop.name} className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-gray-900 text-sm">{prop.name}</p>
                                    <p className="text-xs text-gray-400">{prop.bookings} bookings</p>
                                </div>
                                <p className="font-semibold text-gray-900">₦{formatPrice(prop.revenue)}</p>
                            </div>
                        ))}
                        {revenueByProperty.length === 0 && (
                            <p className="text-center text-gray-400 py-4">No revenue data</p>
                        )}
                    </div>
                </div>

                {/* Monthly Breakdown */}
                <div className="bg-white rounded-xl border border-gray-100">
                    <div className="p-5 border-b border-gray-50">
                        <h2 className="font-semibold text-gray-900">Monthly Revenue</h2>
                    </div>
                    <div className="p-5 space-y-3">
                        {monthlyRevenue.map(m => (
                            <div key={m.month} className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-gray-900 text-sm">{m.month}</p>
                                    <p className="text-xs text-gray-400">{m.bookings} bookings</p>
                                </div>
                                <p className={`font-semibold ${m.revenue > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                    {m.revenue > 0 ? `₦${formatPrice(m.revenue)}` : '—'}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
