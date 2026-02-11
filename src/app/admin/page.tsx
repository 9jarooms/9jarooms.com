import { createClient } from '@supabase/supabase-js';
import { Building2, CalendarDays, Users, UserCog, DollarSign, TrendingUp } from 'lucide-react';
import Link from 'next/link';

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

export default async function AdminOverview() {
    const supabase = getSupabase();

    // Fetch all stats in parallel
    const [
        { count: propertyCount },
        { count: ownerCount },
        { count: caretakerCount },
        { data: bookings },
        { data: recentBookings },
    ] = await Promise.all([
        supabase.from('properties').select('*', { count: 'exact', head: true }),
        supabase.from('owners').select('*', { count: 'exact', head: true }),
        supabase.from('caretakers').select('*', { count: 'exact', head: true }),
        supabase.from('bookings').select('total_amount, status'),
        supabase.from('bookings')
            .select('*, property:properties(name), room:rooms(name)')
            .order('created_at', { ascending: false })
            .limit(10),
    ]);

    const totalRevenue = bookings?.filter((b: any) => b.status === 'paid')
        .reduce((sum: number, b: any) => sum + Number(b.total_amount), 0) || 0;
    const totalBookings = bookings?.length || 0;
    const paidBookings = bookings?.filter((b: any) => b.status === 'paid').length || 0;

    const formatPrice = (price: number) => new Intl.NumberFormat('en-NG').format(price);

    const stats = [
        { label: 'Properties', value: propertyCount || 0, icon: Building2, color: 'bg-blue-50 text-blue-600', href: '/admin/properties' },
        { label: 'Owners', value: ownerCount || 0, icon: Users, color: 'bg-purple-50 text-purple-600', href: '/admin/owners' },
        { label: 'Caretakers', value: caretakerCount || 0, icon: UserCog, color: 'bg-emerald-50 text-emerald-600', href: '/admin/caretakers' },
        { label: 'Total Bookings', value: totalBookings, icon: CalendarDays, color: 'bg-amber-50 text-amber-600', href: '/admin/bookings' },
        { label: 'Paid Bookings', value: paidBookings, icon: TrendingUp, color: 'bg-green-50 text-green-600', href: '/admin/bookings' },
        { label: 'Total Revenue', value: `₦${formatPrice(totalRevenue)}`, icon: DollarSign, color: 'bg-red-50 text-red-600', href: '/admin/bookings' },
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
                <h1 className="text-2xl font-bold text-gray-900">Admin Overview</h1>
                <p className="text-gray-500 mt-1">Platform-wide statistics and recent activity</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                {stats.map((stat) => (
                    <Link
                        key={stat.label}
                        href={stat.href}
                        className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow"
                    >
                        <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center mb-3`}>
                            <stat.icon size={20} />
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
                    </Link>
                ))}
            </div>

            {/* Recent Bookings */}
            <div className="bg-white rounded-xl border border-gray-100">
                <div className="p-5 border-b border-gray-50">
                    <h2 className="font-semibold text-gray-900">Recent Bookings</h2>
                </div>
                <div className="overflow-x-auto">
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
                            {recentBookings?.map((booking: any) => (
                                <tr key={booking.id} className="border-b border-gray-50 last:border-0">
                                    <td className="px-5 py-3">
                                        <p className="font-medium text-gray-900">{booking.guest_name}</p>
                                        <p className="text-gray-400 text-xs">{booking.guest_email}</p>
                                    </td>
                                    <td className="px-5 py-3">
                                        <p className="text-gray-700">{booking.property?.name}</p>
                                        <p className="text-gray-400 text-xs">{booking.room?.name}</p>
                                    </td>
                                    <td className="px-5 py-3 text-gray-600">
                                        {booking.check_in} → {booking.check_out}
                                    </td>
                                    <td className="px-5 py-3 font-semibold text-gray-900">
                                        ₦{formatPrice(booking.total_amount)}
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[booking.status] || 'bg-gray-100 text-gray-500'}`}>
                                            {booking.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {(!recentBookings || recentBookings.length === 0) && (
                                <tr>
                                    <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                                        No bookings yet
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
