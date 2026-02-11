import { createAuthClient } from '@/lib/supabase/auth';
import { createClient } from '@supabase/supabase-js';
import { Building2, CalendarDays, DollarSign, TrendingUp } from 'lucide-react';
import { redirect } from 'next/navigation';

function getServiceSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

export default async function OwnerOverview() {
    const authClient = await createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) redirect('/login');

    const supabase = getServiceSupabase();

    // Get owner record
    const { data: owner } = await supabase
        .from('owners')
        .select('id, name')
        .eq('user_id', user.id)
        .single();

    if (!owner) {
        return <div className="text-center py-20 text-gray-400">Owner profile not found</div>;
    }

    // Get owner's properties
    const { data: properties } = await supabase
        .from('properties')
        .select('id, name, area, price_per_night')
        .eq('owner_id', owner.id);

    const propertyIds = properties?.map((p: any) => p.id) || [];

    // Get bookings for owner's properties
    const { data: bookings } = propertyIds.length > 0
        ? await supabase
            .from('bookings')
            .select('*, property:properties(name), room:rooms(name)')
            .in('property_id', propertyIds)
            .order('created_at', { ascending: false })
        : { data: [] };

    const totalRevenue = bookings?.filter((b: any) => b.status === 'paid')
        .reduce((sum: number, b: any) => sum + Number(b.total_amount), 0) || 0;
    const paidBookings = bookings?.filter((b: any) => b.status === 'paid').length || 0;

    const formatPrice = (n: number) => new Intl.NumberFormat('en-NG').format(n);

    const stats = [
        { label: 'My Properties', value: properties?.length || 0, icon: Building2, color: 'bg-purple-50 text-purple-600' },
        { label: 'Total Bookings', value: bookings?.length || 0, icon: CalendarDays, color: 'bg-blue-50 text-blue-600' },
        { label: 'Paid Bookings', value: paidBookings, icon: TrendingUp, color: 'bg-green-50 text-green-600' },
        { label: 'Total Revenue', value: `₦${formatPrice(totalRevenue)}`, icon: DollarSign, color: 'bg-amber-50 text-amber-600' },
    ];

    const statusColors: Record<string, string> = {
        pending: 'bg-amber-50 text-amber-700',
        paid: 'bg-green-50 text-green-700',
        cancelled: 'bg-red-50 text-red-700',
        completed: 'bg-blue-50 text-blue-700',
        expired: 'bg-gray-100 text-gray-500',
    };

    return (
        <div className="page-enter">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Welcome, {owner.name}</h1>
                <p className="text-gray-500 mt-1">Your property portfolio overview</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {stats.map(stat => (
                    <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-5">
                        <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center mb-3`}>
                            <stat.icon size={20} />
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Recent Bookings */}
            <div className="bg-white rounded-xl border border-gray-100">
                <div className="p-5 border-b border-gray-50">
                    <h2 className="font-semibold text-gray-900">Recent Bookings</h2>
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-gray-500 border-b border-gray-50">
                                <th className="px-5 py-3 font-medium">Guest</th>
                                <th className="px-5 py-3 font-medium">Property</th>
                                <th className="px-5 py-3 font-medium">Dates</th>
                                <th className="px-5 py-3 font-medium">Amount</th>
                                <th className="px-5 py-3 font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bookings?.slice(0, 10).map((b: any) => (
                                <tr key={b.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                                    <td className="px-5 py-3">
                                        <p className="font-medium text-gray-900">{b.guest_name}</p>
                                        <p className="text-xs text-gray-400">{b.guest_email}</p>
                                    </td>
                                    <td className="px-5 py-3 text-gray-700">{b.property?.name}</td>
                                    <td className="px-5 py-3 text-gray-600">{b.check_in} → {b.check_out}</td>
                                    <td className="px-5 py-3 font-semibold text-gray-900">₦{formatPrice(b.total_amount)}</td>
                                    <td className="px-5 py-3">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[b.status] || 'bg-gray-100 text-gray-500'}`}>
                                            {b.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {(!bookings || bookings.length === 0) && (
                                <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">No bookings yet</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-gray-50">
                    {bookings?.slice(0, 10).map((b: any) => (
                        <div key={b.id} className="p-4 space-y-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-medium text-gray-900">{b.property?.name}</p>
                                    <p className="text-xs text-gray-500">{b.check_in} — {b.check_out}</p>
                                </div>
                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[b.status] || 'bg-gray-100 text-gray-500'}`}>
                                    {b.status}
                                </span>
                            </div>

                            <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                                <div>
                                    <p className="text-xs text-gray-500">Guest</p>
                                    <p className="text-sm font-medium text-gray-900">{b.guest_name}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-500">Amount</p>
                                    <p className="text-sm font-bold text-gray-900">₦{formatPrice(b.total_amount)}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                    {(!bookings || bookings.length === 0) && (
                        <div className="p-8 text-center text-gray-400">No bookings yet</div>
                    )}
                </div>
            </div>
        </div>
    );
}
