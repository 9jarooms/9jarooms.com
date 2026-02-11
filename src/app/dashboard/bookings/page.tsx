import { createAuthClient } from '@/lib/supabase/auth';

export default async function BookingsPage() {
    const supabase = await createAuthClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Get properties for this caretaker
    const { data: properties } = await supabase
        .from('properties')
        .select('id')
        .eq('caretaker_id', user.id);

    const propertyIds = properties?.map((p) => p.id) || [];

    const { data: bookings } = await supabase
        .from('bookings')
        .select('*, property:properties(name), room:rooms(name)')
        .in('property_id', propertyIds)
        .eq('status', 'paid')
        .order('check_in', { ascending: false }) // Sort by Check-in not created_at? Or created_at is fine.
        .limit(50);

    return (
        <>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
                <p className="text-gray-500 text-sm mt-1">Confirmed bookings for your properties</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-100">
                                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">Guest</th>
                                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">Property</th>
                                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">Dates</th>
                                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {bookings && bookings.length > 0 ? (
                                bookings.map((booking) => (
                                    <tr key={booking.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-5 py-4">
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{booking.guest_name}</p>
                                                <p className="text-xs text-gray-400">{booking.guest_email}</p>
                                                {booking.guest_phone && (
                                                    <p className="text-xs text-gray-400">{booking.guest_phone}</p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <p className="text-sm text-gray-900">{(booking as any).property?.name}</p>
                                            <p className="text-xs text-gray-400">{(booking as any).room?.name}</p>
                                        </td>
                                        <td className="px-5 py-4">
                                            <p className="text-sm text-gray-900">{booking.check_in}</p>
                                            <p className="text-xs text-gray-400">→ {booking.check_out} ({booking.nights} nights)</p>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={`badge badge-${booking.status}`}>{booking.status}</span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="px-5 py-16 text-center text-gray-400 text-sm">
                                        No bookings yet
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
