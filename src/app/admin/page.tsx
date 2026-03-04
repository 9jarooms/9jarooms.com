import { createClient } from '@supabase/supabase-js';
import { Building2, CalendarDays, Users, UserCog, DollarSign, TrendingUp, BarChart3, PieChart, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import Link from 'next/link';

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

// Source label + color map
const SOURCE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    website: { label: 'Website', color: '#16a34a', bg: 'bg-green-50 text-green-700' },
    operator: { label: 'Call Operator', color: '#2563eb', bg: 'bg-blue-50 text-blue-700' },
    whatsapp: { label: 'WhatsApp', color: '#059669', bg: 'bg-emerald-50 text-emerald-700' },
    caretaker: { label: 'Caretaker', color: '#7c3aed', bg: 'bg-purple-50 text-purple-700' },
    maintenance: { label: 'Maintenance', color: '#d97706', bg: 'bg-amber-50 text-amber-700' },
};

export default async function AdminOverview() {
    const supabase = getSupabase();

    // Fetch all data in parallel
    const [
        { count: propertyCount },
        { count: ownerCount },
        { count: caretakerCount },
        { data: allBookings },
        { data: recentBookings },
        { data: properties },
    ] = await Promise.all([
        supabase.from('properties').select('*', { count: 'exact', head: true }),
        supabase.from('owners').select('*', { count: 'exact', head: true }),
        supabase.from('caretakers').select('*', { count: 'exact', head: true }),
        supabase.from('bookings').select('id, total_amount, status, booking_source, notes, created_at, property_id, check_in, check_out, nights'),
        supabase.from('bookings')
            .select('*, property:properties(name), room:rooms(name)')
            .order('created_at', { ascending: false })
            .limit(10),
        supabase.from('properties').select('id, name').eq('is_active', true),
    ]);

    const bookings = allBookings || [];

    // === CORE STATS ===
    const totalRevenue = bookings.filter(b => b.status === 'paid')
        .reduce((sum, b) => sum + Number(b.total_amount), 0);
    const totalBookings = bookings.length;
    const paidBookings = bookings.filter(b => b.status === 'paid').length;
    const pendingBookings = bookings.filter(b => b.status === 'pending').length;
    const cancelledBookings = bookings.filter(b => b.status === 'cancelled').length;

    // === SOURCE BREAKDOWN (infer from notes if booking_source not set) ===
    const getSource = (b: any): string => {
        if (b.booking_source) return b.booking_source;
        // Infer from notes for legacy bookings
        if (b.notes?.includes('Maintenance')) return 'maintenance';
        if (b.notes?.includes('Manual Booking')) return 'caretaker';
        return 'website';
    };

    const sourceBreakdown: Record<string, { count: number; revenue: number; paid: number }> = {};
    bookings.forEach(b => {
        const src = getSource(b);
        if (!sourceBreakdown[src]) sourceBreakdown[src] = { count: 0, revenue: 0, paid: 0 };
        sourceBreakdown[src].count++;
        if (b.status === 'paid') {
            sourceBreakdown[src].revenue += Number(b.total_amount);
            sourceBreakdown[src].paid++;
        }
    });

    // Sort sources by count descending
    const sortedSources = Object.entries(sourceBreakdown)
        .sort(([, a], [, b]) => b.count - a.count);

    // === MONTHLY TREND (last 6 months) ===
    const monthlyData: Record<string, { bookings: number; revenue: number }> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthlyData[key] = { bookings: 0, revenue: 0 };
    }

    bookings.forEach(b => {
        if (!b.created_at) return;
        const key = b.created_at.substring(0, 7); // 'YYYY-MM'
        if (monthlyData[key]) {
            monthlyData[key].bookings++;
            if (b.status === 'paid') monthlyData[key].revenue += Number(b.total_amount);
        }
    });

    const monthLabels = Object.keys(monthlyData);
    const monthValues = Object.values(monthlyData);
    const maxMonthlyBookings = Math.max(...monthValues.map(m => m.bookings), 1);
    const maxMonthlyRevenue = Math.max(...monthValues.map(m => m.revenue), 1);

    // === CONVERSION RATE ===
    const totalCreated = bookings.filter(b => b.status !== 'cancelled' || b.status === 'paid').length;
    const conversionRate = totalCreated > 0 ? Math.round((paidBookings / totalCreated) * 100) : 0;

    // === AVG BOOKING VALUE ===
    const avgBookingValue = paidBookings > 0 ? Math.round(totalRevenue / paidBookings) : 0;

    // === AVG STAY LENGTH ===
    const paidWithNights = bookings.filter(b => b.status === 'paid' && b.nights);
    const avgStayLength = paidWithNights.length > 0
        ? (paidWithNights.reduce((sum, b) => sum + Number(b.nights), 0) / paidWithNights.length).toFixed(1)
        : '0';

    // === TOP PROPERTIES BY REVENUE ===
    const propertyRevenue: Record<string, { name: string; revenue: number; bookings: number }> = {};
    bookings.filter(b => b.status === 'paid').forEach(b => {
        const pid = b.property_id;
        if (!propertyRevenue[pid]) {
            const prop = properties?.find(p => p.id === pid);
            propertyRevenue[pid] = { name: prop?.name || 'Unknown', revenue: 0, bookings: 0 };
        }
        propertyRevenue[pid].revenue += Number(b.total_amount);
        propertyRevenue[pid].bookings++;
    });

    const topProperties = Object.values(propertyRevenue)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

    // === MONTH OVER MONTH CHANGE ===
    const currentMonthKey = monthLabels[monthLabels.length - 1];
    const prevMonthKey = monthLabels[monthLabels.length - 2];
    const currentMonthRev = monthlyData[currentMonthKey]?.revenue || 0;
    const prevMonthRev = monthlyData[prevMonthKey]?.revenue || 0;
    const revenueChange = prevMonthRev > 0 ? Math.round(((currentMonthRev - prevMonthRev) / prevMonthRev) * 100) : 0;

    const formatPrice = (price: number) => new Intl.NumberFormat('en-NG').format(price);
    const formatMonth = (key: string) => {
        const [y, m] = key.split('-');
        return new Date(Number(y), Number(m) - 1).toLocaleDateString('en', { month: 'short' });
    };

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
        confirmed: 'bg-emerald-50 text-emerald-700',
    };

    return (
        <div className="page-enter overflow-x-hidden">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Admin Overview</h1>
                <p className="text-gray-500 mt-1">Platform-wide statistics and recent activity</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4 mb-6 sm:mb-8">
                {stats.map((stat) => (
                    <Link
                        key={stat.label}
                        href={stat.href}
                        className="bg-white rounded-xl border border-gray-100 p-3 sm:p-4 hover:shadow-md transition-shadow"
                    >
                        <div className={`w-8 h-8 sm:w-10 sm:h-10 ${stat.color} rounded-lg flex items-center justify-center mb-2 sm:mb-3`}>
                            <stat.icon size={16} className="sm:hidden" />
                            <stat.icon size={20} className="hidden sm:block" />
                        </div>
                        <p className="text-base sm:text-2xl font-bold text-gray-900 truncate">{stat.value}</p>
                        <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 truncate">{stat.label}</p>
                    </Link>
                ))}
            </div>

            {/* ===== CRM ANALYTICS SECTION ===== */}
            <div className="mb-8">
                <div className="flex items-center gap-2 mb-5">
                    <BarChart3 size={20} className="text-gray-400" />
                    <h2 className="text-lg font-bold text-gray-900">Analytics</h2>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
                    {/* Conversion Rate */}
                    <div className="bg-white rounded-xl border border-gray-100 p-3 sm:p-5">
                        <p className="text-[10px] sm:text-xs text-gray-500 mb-1">Conversion Rate</p>
                        <p className="text-xl sm:text-3xl font-bold text-gray-900">{conversionRate}%</p>
                        <p className="text-[10px] text-gray-400 hidden sm:block">booked → paid</p>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 sm:h-2 mt-2 sm:mt-3">
                            <div
                                className="bg-green-500 h-1.5 sm:h-2 rounded-full transition-all"
                                style={{ width: `${conversionRate}%` }}
                            />
                        </div>
                    </div>

                    {/* Avg Booking Value */}
                    <div className="bg-white rounded-xl border border-gray-100 p-3 sm:p-5">
                        <p className="text-[10px] sm:text-xs text-gray-500 mb-1">Avg Value</p>
                        <p className="text-lg sm:text-3xl font-bold text-gray-900 truncate">₦{formatPrice(avgBookingValue)}</p>
                        <p className="text-[10px] text-gray-400 mt-1 hidden sm:block">per paid booking</p>
                    </div>

                    {/* Avg Stay */}
                    <div className="bg-white rounded-xl border border-gray-100 p-3 sm:p-5">
                        <p className="text-[10px] sm:text-xs text-gray-500 mb-1">Avg Stay</p>
                        <p className="text-xl sm:text-3xl font-bold text-gray-900">{avgStayLength}<span className="text-sm text-gray-400 ml-1">nights</span></p>
                    </div>

                    {/* Month over Month */}
                    <div className="bg-white rounded-xl border border-gray-100 p-3 sm:p-5">
                        <p className="text-[10px] sm:text-xs text-gray-500 mb-1">vs Last Month</p>
                        <div className="flex items-end gap-1 sm:gap-2">
                            <p className="text-xl sm:text-3xl font-bold text-gray-900">
                                {revenueChange > 0 ? '+' : ''}{revenueChange}%
                            </p>
                            {revenueChange > 0 ? (
                                <ArrowUpRight size={16} className="text-green-500 mb-0.5" />
                            ) : revenueChange < 0 ? (
                                <ArrowDownRight size={16} className="text-red-500 mb-0.5" />
                            ) : (
                                <Minus size={16} className="text-gray-400 mb-0.5" />
                            )}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1 truncate">
                            ₦{formatPrice(currentMonthRev)}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
                    {/* Booking Source Breakdown */}
                    <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <PieChart size={16} className="text-gray-400" />
                            <h3 className="font-semibold text-gray-900 text-sm">Booking Sources</h3>
                        </div>

                        {sortedSources.length > 0 ? (
                            <div className="space-y-3">
                                {sortedSources.map(([src, data]) => {
                                    const config = SOURCE_CONFIG[src] || { label: src, color: '#6b7280', bg: 'bg-gray-50 text-gray-700' };
                                    const pct = totalBookings > 0 ? Math.round((data.count / totalBookings) * 100) : 0;
                                    return (
                                        <div key={src}>
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: config.color }} />
                                                    <span className="text-sm font-medium text-gray-700">{config.label}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs text-gray-400">{data.count} bookings</span>
                                                    <span className="text-sm font-bold text-gray-900">{pct}%</span>
                                                </div>
                                            </div>
                                            <div className="w-full bg-gray-100 rounded-full h-2">
                                                <div
                                                    className="h-2 rounded-full transition-all"
                                                    style={{ width: `${pct}%`, backgroundColor: config.color }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-400 text-center py-6">No booking data yet</p>
                        )}

                        {/* Revenue by Source */}
                        {sortedSources.length > 0 && (
                            <div className="mt-5 pt-4 border-t border-gray-50">
                                <p className="text-xs text-gray-500 mb-3">Revenue by Source</p>
                                <div className="flex flex-wrap gap-2">
                                    {sortedSources.filter(([, d]) => d.revenue > 0).map(([src, data]) => {
                                        const config = SOURCE_CONFIG[src] || { label: src, bg: 'bg-gray-50 text-gray-700' };
                                        return (
                                            <div key={src} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${config.bg}`}>
                                                {config.label}: ₦{formatPrice(data.revenue)}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Monthly Trend */}
                    <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <BarChart3 size={16} className="text-gray-400" />
                            <h3 className="font-semibold text-gray-900 text-sm">Monthly Trend</h3>
                        </div>

                        {/* Bar Chart */}
                        <div className="flex items-end gap-2 h-32 mb-2">
                            {monthLabels.map((key, i) => {
                                const val = monthValues[i];
                                const heightPct = maxMonthlyBookings > 0 ? (val.bookings / maxMonthlyBookings) * 100 : 0;
                                return (
                                    <div key={key} className="flex-1 flex flex-col items-center gap-1">
                                        <span className="text-[10px] font-bold text-gray-700">{val.bookings}</span>
                                        <div className="w-full relative" style={{ height: '100px' }}>
                                            <div
                                                className="absolute bottom-0 w-full bg-green-100 rounded-t-md transition-all"
                                                style={{ height: `${Math.max(heightPct, 4)}%` }}
                                            >
                                                <div
                                                    className="absolute bottom-0 w-full bg-green-500 rounded-t-md"
                                                    style={{
                                                        height: val.bookings > 0 ? `${(val.revenue > 0 ? (val.revenue / (val.bookings * (avgBookingValue || 1))) * 100 : 0)}%` : '0%',
                                                        maxHeight: '100%'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <span className="text-[10px] text-gray-400">{formatMonth(key)}</span>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400">
                            <div className="flex items-center gap-1">
                                <div className="w-2.5 h-2.5 rounded bg-green-100" />
                                <span>Total Bookings</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-2.5 h-2.5 rounded bg-green-500" />
                                <span>Paid</span>
                            </div>
                        </div>

                        {/* Monthly Revenue */}
                        <div className="mt-4 pt-3 border-t border-gray-50">
                            <p className="text-xs text-gray-500 mb-2">Monthly Revenue</p>
                            <div className="flex items-end gap-2 h-16">
                                {monthLabels.map((key, i) => {
                                    const val = monthValues[i];
                                    const heightPct = maxMonthlyRevenue > 0 ? (val.revenue / maxMonthlyRevenue) * 100 : 0;
                                    return (
                                        <div key={key} className="flex-1 flex flex-col items-center gap-1">
                                            <div className="w-full" style={{ height: '40px', position: 'relative' }}>
                                                <div
                                                    className="absolute bottom-0 w-full bg-emerald-400 rounded-t-sm transition-all"
                                                    style={{ height: `${Math.max(heightPct, 3)}%` }}
                                                />
                                            </div>
                                            <span className="text-[9px] text-gray-400">₦{val.revenue > 0 ? formatPrice(Math.round(val.revenue / 1000)) + 'k' : '0'}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Top Properties + Status Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                    {/* Top Properties */}
                    <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5">
                        <h3 className="font-semibold text-gray-900 text-sm mb-4">Top Properties by Revenue</h3>
                        {topProperties.length > 0 ? (
                            <div className="space-y-3">
                                {topProperties.map((prop, i) => {
                                    const pct = totalRevenue > 0 ? Math.round((prop.revenue / totalRevenue) * 100) : 0;
                                    return (
                                        <div key={i} className="flex items-center gap-3">
                                            <span className="w-5 h-5 bg-gray-100 rounded-md flex items-center justify-center text-[10px] font-bold text-gray-500">
                                                {i + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-sm font-medium text-gray-800 truncate">{prop.name}</span>
                                                    <span className="text-sm font-bold text-gray-900 ml-2">₦{formatPrice(prop.revenue)}</span>
                                                </div>
                                                <div className="w-full bg-gray-100 rounded-full h-1.5">
                                                    <div
                                                        className="bg-green-500 h-1.5 rounded-full transition-all"
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                                <p className="text-[10px] text-gray-400 mt-0.5">{prop.bookings} bookings • {pct}% of revenue</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-400 text-center py-6">No revenue data yet</p>
                        )}
                    </div>

                    {/* Status Breakdown */}
                    <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5">
                        <h3 className="font-semibold text-gray-900 text-sm mb-4">Booking Status Overview</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-green-50 rounded-lg p-3">
                                <p className="text-2xl font-bold text-green-700">{paidBookings}</p>
                                <p className="text-xs text-green-600">Paid</p>
                            </div>
                            <div className="bg-amber-50 rounded-lg p-3">
                                <p className="text-2xl font-bold text-amber-700">{pendingBookings}</p>
                                <p className="text-xs text-amber-600">Pending</p>
                            </div>
                            <div className="bg-red-50 rounded-lg p-3">
                                <p className="text-2xl font-bold text-red-700">{cancelledBookings}</p>
                                <p className="text-xs text-red-600">Cancelled</p>
                            </div>
                            <div className="bg-blue-50 rounded-lg p-3">
                                <p className="text-2xl font-bold text-blue-700">{bookings.filter(b => b.status === 'confirmed').length}</p>
                                <p className="text-xs text-blue-600">Confirmed</p>
                            </div>
                        </div>

                        {/* Status distribution bar */}
                        {totalBookings > 0 && (
                            <div className="mt-4">
                                <div className="flex rounded-full overflow-hidden h-3">
                                    <div className="bg-green-500 transition-all" style={{ width: `${(paidBookings / totalBookings) * 100}%` }} />
                                    <div className="bg-amber-400 transition-all" style={{ width: `${(pendingBookings / totalBookings) * 100}%` }} />
                                    <div className="bg-red-400 transition-all" style={{ width: `${(cancelledBookings / totalBookings) * 100}%` }} />
                                    <div className="bg-blue-400 transition-all" style={{ width: `${(bookings.filter(b => b.status === 'confirmed').length / totalBookings) * 100}%` }} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Bookings */}
            <div className="bg-white rounded-xl border border-gray-100">
                <div className="p-5 border-b border-gray-50 flex items-center justify-between">
                    <h2 className="font-semibold text-gray-900">Recent Bookings</h2>
                    <Link href="/admin/bookings" className="text-xs text-green-600 hover:text-green-700 font-medium">View All →</Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[800px]">
                        <thead>
                            <tr className="text-left text-gray-500 border-b border-gray-50">
                                <th className="px-5 py-3 font-medium whitespace-nowrap">Guest</th>
                                <th className="px-5 py-3 font-medium whitespace-nowrap">Property</th>
                                <th className="px-5 py-3 font-medium whitespace-nowrap">Dates</th>
                                <th className="px-5 py-3 font-medium whitespace-nowrap">Amount</th>
                                <th className="px-5 py-3 font-medium whitespace-nowrap">Source</th>
                                <th className="px-5 py-3 font-medium whitespace-nowrap">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentBookings?.map((booking: any) => {
                                const src = getSource(booking);
                                const srcConfig = SOURCE_CONFIG[src] || { label: src, bg: 'bg-gray-50 text-gray-700' };
                                return (
                                    <tr key={booking.id} className="border-b border-gray-50 last:border-0">
                                        <td className="px-5 py-3 whitespace-nowrap">
                                            <p className="font-medium text-gray-900">{booking.guest_name}</p>
                                            <p className="text-gray-400 text-xs">{booking.guest_email}</p>
                                        </td>
                                        <td className="px-5 py-3 whitespace-nowrap">
                                            <p className="text-gray-700">{booking.property?.name}</p>
                                            <p className="text-gray-400 text-xs">{booking.room?.name}</p>
                                        </td>
                                        <td className="px-5 py-3 text-gray-600 whitespace-nowrap">
                                            {booking.check_in} → {booking.check_out}
                                        </td>
                                        <td className="px-5 py-3 font-semibold text-gray-900 whitespace-nowrap">
                                            ₦{formatPrice(booking.total_amount)}
                                        </td>
                                        <td className="px-5 py-3 whitespace-nowrap">
                                            <span className={`px-2 py-1 rounded-md text-[10px] font-medium ${srcConfig.bg}`}>
                                                {srcConfig.label}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 whitespace-nowrap">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[booking.status] || 'bg-gray-100 text-gray-500'}`}>
                                                {booking.status}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                            {(!recentBookings || recentBookings.length === 0) && (
                                <tr>
                                    <td colSpan={6} className="px-5 py-8 text-center text-gray-400">
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
