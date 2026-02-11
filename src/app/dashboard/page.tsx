import { createAuthClient } from '@/lib/supabase/auth';
import { Building2, CalendarDays, Users, Clock } from 'lucide-react';
import Link from 'next/link';

export default async function DashboardOverview() {
    const supabase = await createAuthClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    // Get properties for this caretaker
    const { data: properties } = await supabase
        .from('properties')
        .select('id, name')
        .eq('caretaker_id', user.id);

    const propertyIds = properties?.map((p) => p.id) || [];

    // Get upcoming bookings
    const { data: bookings } = await supabase
        .from('bookings')
        .select('*, property:properties(name), room:rooms(name)')
        .in('property_id', propertyIds)
        .in('status', ['paid'])
        .gte('check_in', new Date().toISOString().split('T')[0])
        .order('check_in', { ascending: true })
        .limit(5);

    // Stats
    const totalProperties = properties?.length || 0;

    const { count: activeBookings } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .in('property_id', propertyIds)
        .eq('status', 'paid')
        .lte('check_in', new Date().toISOString().split('T')[0])
        .gte('check_out', new Date().toISOString().split('T')[0]);

    const { count: upcomingCount } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .in('property_id', propertyIds)
        .in('status', ['paid'])
        .gt('check_in', new Date().toISOString().split('T')[0]);

    const formatPrice = (price: number) =>
        new Intl.NumberFormat('en-NG').format(price);

    return (
        <>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-500 text-sm mt-1">Welcome back. Here's what's happening with your properties.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                            <Building2 size={20} className="text-green-600" />
                        </div>
                        <span className="text-sm text-gray-500">Properties</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{totalProperties}</p>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                            <Users size={20} className="text-blue-600" />
                        </div>
                        <span className="text-sm text-gray-500">Currently Occupied</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{activeBookings || 0}</p>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                            <CalendarDays size={20} className="text-amber-600" />
                        </div>
                        <span className="text-sm text-gray-500">Upcoming</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{upcomingCount || 0}</p>
                </div>
            </div>

            {/* Upcoming Bookings */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-gray-50">
                    <h2 className="font-semibold text-gray-900">Upcoming Bookings</h2>
                    <Link href="/dashboard/bookings" className="text-sm text-green-600 hover:text-green-700">View All →</Link>
                </div>

                {bookings && bookings.length > 0 ? (
                    <div className="divide-y divide-gray-50">
                        {bookings.map((booking) => (
                            <div key={booking.id} className="flex items-center gap-4 p-5 hover:bg-gray-50/50 transition-colors">
                                <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-green-600 font-semibold text-sm">
                                    {(booking.guest_name || 'G').charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-900 text-sm">{booking.guest_name}</p>
                                    <p className="text-xs text-gray-500">
                                        {(booking as any).property?.name} • {(booking as any).room?.name}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-medium text-gray-900">{booking.check_in} → {booking.check_out}</p>
                                    <span className={`badge badge-${booking.status}`}>{booking.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-10 text-center text-gray-400 text-sm">
                        No upcoming bookings
                    </div>
                )}
            </div>
        </>
    );
}
