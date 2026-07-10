import { createAdminClient } from '@/lib/supabase/server';
import ReportGenerator from './ReportGenerator';

export const dynamic = 'force-dynamic';

function naira(n: number) {
    return '₦' + Math.round(Number(n || 0)).toLocaleString('en-NG');
}

// Reports: today / this month, occupancy, outstanding, by source & property.
export default async function ReportsPage() {
    const supabase = createAdminClient();

    const today = new Date().toISOString().slice(0, 10);
    const monthStart = today.slice(0, 8) + '01';
    const monthEndDate = new Date(new Date(monthStart + 'T00:00:00').getFullYear(), new Date(monthStart + 'T00:00:00').getMonth() + 1, 1);
    const monthEnd = monthEndDate.toISOString().slice(0, 10);
    const daysInMonth = monthEndDate.getDate() === 1 ? new Date(+monthEndDate - 86400000).getDate() : 30;

    const LIVE = ['confirmed', 'paid', 'checked_in', 'completed'];

    const { data: activeProps } = await supabase
        .from('properties')
        .select('id, name, area')
        .eq('is_deleted', false)
        .eq('is_active', true)
        .order('name');

    const [{ data: monthBookings }, { data: arrivals }, { data: departures }, { data: inHouse }, { data: units }, { data: payments }] = await Promise.all([
        supabase.from('bookings')
            .select('id, total_amount, nights, status, booking_source, check_in, check_out, property_id, property:properties(name)')
            .in('status', LIVE)
            .lt('check_in', monthEnd)
            .gt('check_out', monthStart),
        supabase.from('bookings').select('id').in('status', LIVE).eq('check_in', today),
        supabase.from('bookings').select('id').in('status', LIVE).eq('check_out', today),
        supabase.from('bookings').select('id').in('status', LIVE).lte('check_in', today).gt('check_out', today),
        supabase.from('rooms').select('id, property:properties!inner(is_deleted, is_active)').eq('is_active', true).eq('property.is_deleted', false).eq('property.is_active', true),
        supabase.from('booking_payments').select('booking_id, amount'),
    ]);

    const paidBy: Record<string, number> = {};
    for (const p of payments || []) paidBy[p.booking_id] = (paidBy[p.booking_id] || 0) + Number(p.amount);

    const bookings = monthBookings || [];
    let revenue = 0, soldNights = 0, outstanding = 0;
    const bySource: Record<string, number> = {};
    const byProperty: Record<string, { name: string; revenue: number; nights: number }> = {};

    for (const b of bookings) {
        const total = Number(b.total_amount) || 0;
        revenue += total;
        soldNights += b.nights || 0;
        const paid = b.status === 'paid' ? total : (paidBy[b.id] || 0);
        if (!['completed'].includes(b.status)) outstanding += Math.max(total - paid, 0);
        const src = (b.booking_source || 'unknown').replace('_', ' ');
        bySource[src] = (bySource[src] || 0) + total;
        const prop: any = b.property;
        const key = b.property_id || 'unknown';
        if (!byProperty[key]) byProperty[key] = { name: prop?.name || 'Unknown', revenue: 0, nights: 0 };
        byProperty[key].revenue += total;
        byProperty[key].nights += b.nights || 0;
    }

    const unitCount = (units || []).length;
    const availableNights = unitCount * daysInMonth;
    const occupancy = availableNights > 0 ? Math.round((soldNights / availableNights) * 1000) / 10 : 0;
    const adr = soldNights > 0 ? revenue / soldNights : 0;

    const cards = [
        { label: 'Revenue this month', value: naira(revenue) },
        { label: 'Bookings this month', value: String(bookings.length) },
        { label: 'Occupancy this month', value: `${occupancy}%` },
        { label: 'Average nightly rate', value: naira(adr) },
        { label: 'Outstanding balance', value: naira(outstanding), alert: outstanding > 0 },
        { label: 'In-house guests today', value: String((inHouse || []).length) },
        { label: 'Arrivals today', value: String((arrivals || []).length) },
        { label: 'Departures today', value: String((departures || []).length) },
    ];

    const sourceRows = Object.entries(bySource).sort((a, b) => b[1] - a[1]);
    const propertyRows = Object.values(byProperty).sort((a, b) => b.revenue - a.revenue);

    return (
        <div className="p-4 sm:p-6">
            <h1 className="text-[22px] sm:text-[26px] font-extrabold tracking-tight text-stone-900 mb-4">Reports</h1>

            <ReportGenerator properties={activeProps || []} />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 mb-6">
                {cards.map(c => (
                    <div key={c.label} className="bg-white rounded-2xl border border-stone-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)] px-4 py-3.5">
                        <p className="text-[11px] uppercase tracking-wide text-stone-400">{c.label}</p>
                        <p className={`text-xl font-bold mt-1 ${c.alert ? 'text-[#c75146]' : 'text-stone-900'}`}>{c.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-stone-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                    <h2 className="px-4 py-3 text-sm font-bold text-stone-700 border-b border-stone-200">Revenue by source (this month)</h2>
                    <table className="w-full text-sm">
                        <tbody className="divide-y divide-stone-100">
                            {sourceRows.map(([src, amt]) => (
                                <tr key={src}>
                                    <td className="px-4 py-2 capitalize text-stone-600">{src}</td>
                                    <td className="px-4 py-2 text-right font-medium">{naira(amt)}</td>
                                </tr>
                            ))}
                            {sourceRows.length === 0 && <tr><td className="px-4 py-6 text-stone-400" colSpan={2}>No bookings this month yet.</td></tr>}
                        </tbody>
                    </table>
                </div>

                <div className="bg-white rounded-2xl border border-stone-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                    <h2 className="px-4 py-3 text-sm font-bold text-stone-700 border-b border-stone-200">Revenue by property (this month)</h2>
                    <table className="w-full text-sm">
                        <tbody className="divide-y divide-stone-100">
                            {propertyRows.map(p => (
                                <tr key={p.name}>
                                    <td className="px-4 py-2 text-stone-600">{p.name}</td>
                                    <td className="px-4 py-2 text-right text-stone-400">{p.nights} nights</td>
                                    <td className="px-4 py-2 text-right font-medium">{naira(p.revenue)}</td>
                                </tr>
                            ))}
                            {propertyRows.length === 0 && <tr><td className="px-4 py-6 text-stone-400" colSpan={3}>No bookings this month yet.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
