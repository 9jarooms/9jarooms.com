import { createClient } from '@supabase/supabase-js';

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

export default async function AdminBookingsPage() {
    const supabase = getSupabase();

    const { data: bookings } = await supabase
        .from('bookings')
        .select('*, property:properties(name, area), room:rooms(name), owner:properties(owner:owners(name))')
        .order('created_at', { ascending: false });

    const formatPrice = (n: number) => new Intl.NumberFormat('en-NG').format(n);

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
                <h1 className="text-2xl font-bold text-gray-900">All Bookings</h1>
                <p className="text-gray-500 mt-1">{bookings?.length || 0} bookings across all properties</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-100">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-gray-500 border-b border-gray-100">
                                <th className="px-5 py-3 font-medium">Guest</th>
                                <th className="px-5 py-3 font-medium">Property</th>
                                <th className="px-5 py-3 font-medium">Room</th>
                                <th className="px-5 py-3 font-medium">Check-in</th>
                                <th className="px-5 py-3 font-medium">Check-out</th>
                                <th className="px-5 py-3 font-medium">Nights</th>
                                <th className="px-5 py-3 font-medium">Amount</th>
                                <th className="px-5 py-3 font-medium">Status</th>
                                <th className="px-5 py-3 font-medium">Booked</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bookings?.map((b: any) => (
                                <tr key={b.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                                    <td className="px-5 py-3">
                                        <p className="font-medium text-gray-900">{b.guest_name}</p>
                                        <p className="text-xs text-gray-400">{b.guest_email}</p>
                                        {b.guest_phone && <p className="text-xs text-gray-400">{b.guest_phone}</p>}
                                    </td>
                                    <td className="px-5 py-3 text-gray-700">{b.property?.name}</td>
                                    <td className="px-5 py-3 text-gray-600">{b.room?.name}</td>
                                    <td className="px-5 py-3 text-gray-600">{b.check_in}</td>
                                    <td className="px-5 py-3 text-gray-600">{b.check_out}</td>
                                    <td className="px-5 py-3 text-gray-600">{b.nights}</td>
                                    <td className="px-5 py-3 font-semibold text-gray-900">₦{formatPrice(b.total_amount)}</td>
                                    <td className="px-5 py-3">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[b.status] || 'bg-gray-100 text-gray-500'}`}>
                                            {b.status}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-xs text-gray-400">
                                        {new Date(b.created_at).toLocaleDateString()}
                                    </td>
                                </tr>
                            ))}
                            {(!bookings || bookings.length === 0) && (
                                <tr><td colSpan={9} className="px-5 py-8 text-center text-gray-400">No bookings yet</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
