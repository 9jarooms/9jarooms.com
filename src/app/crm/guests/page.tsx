import { createAdminClient } from '@/lib/supabase/server';
import { MessageCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

function naira(n: number) {
    return '₦' + Number(n || 0).toLocaleString('en-NG');
}

function waHref(phone: string) {
    let digits = phone.replace(/[^0-9]/g, '');
    if (digits.startsWith('0')) digits = '234' + digits.slice(1);
    return `https://wa.me/${digits}`;
}

// Guest CRM — aggregated from bookings, no manual data entry.
export default async function GuestsPage() {
    const supabase = createAdminClient();
    const { data: bookings } = await supabase
        .from('bookings')
        .select('guest_name, guest_phone, guest_email, nights, total_amount, status, check_in')
        .not('status', 'in', '("cancelled","expired","pending")')
        .order('check_in', { ascending: false });

    const guests = new Map<string, {
        name: string; phone: string | null; email: string | null;
        stays: number; nights: number; spend: number; lastStay: string;
    }>();

    for (const b of bookings || []) {
        const key = (b.guest_phone || b.guest_email || b.guest_name).toLowerCase().trim();
        const g = guests.get(key);
        if (g) {
            g.stays += 1;
            g.nights += b.nights || 0;
            g.spend += Number(b.total_amount) || 0;
            if (b.check_in > g.lastStay) g.lastStay = b.check_in;
            if (!g.phone && b.guest_phone) g.phone = b.guest_phone;
            if (!g.email && b.guest_email) g.email = b.guest_email;
        } else {
            guests.set(key, {
                name: b.guest_name,
                phone: b.guest_phone,
                email: b.guest_email,
                stays: 1,
                nights: b.nights || 0,
                spend: Number(b.total_amount) || 0,
                lastStay: b.check_in,
            });
        }
    }

    const rows = [...guests.values()].sort((a, b) => b.spend - a.spend);

    return (
        <div className="p-4 sm:p-6">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-4">
                <h1 className="text-[22px] sm:text-[26px] font-extrabold tracking-tight text-stone-900">Guests</h1>
                <p className="text-sm text-stone-400">{rows.length} guests · built automatically from bookings</p>
            </div>

            {/* Mobile: cards */}
            <div className="md:hidden space-y-2.5">
                {rows.map((g, i) => (
                    <div key={i} className="bg-white rounded-xl border border-stone-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-3.5">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="font-semibold text-stone-900 truncate">
                                    {g.name}
                                    {g.stays > 1 && <span className="ml-2 px-2 py-0.5 rounded-full bg-[#7ed957]/20 text-[#02572a] text-[10.5px] font-bold align-middle">Repeat</span>}
                                </p>
                                <p className="text-[12px] text-stone-400 truncate">{g.phone || g.email || '—'}</p>
                            </div>
                            {g.phone && (
                                <a href={waHref(g.phone)} target="_blank" rel="noopener noreferrer"
                                   className="shrink-0 inline-flex items-center gap-1 text-[#25D366] text-[12px] font-semibold">
                                    <MessageCircle size={14} /> WhatsApp
                                </a>
                            )}
                        </div>
                        <div className="flex items-center justify-between mt-2.5 text-[12.5px] text-stone-500">
                            <span>{g.stays} stay{g.stays === 1 ? '' : 's'} · {g.nights} nights</span>
                            <span className="font-bold text-stone-800">{naira(g.spend)}</span>
                        </div>
                    </div>
                ))}
                {rows.length === 0 && <p className="text-center text-stone-400 py-10">Guests appear here once bookings come in.</p>}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block bg-white rounded-2xl border border-stone-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs text-stone-500 border-b border-stone-200">
                            <th className="px-4 py-2.5 font-semibold">Guest</th>
                            <th className="px-4 py-2.5 font-semibold">Contact</th>
                            <th className="px-4 py-2.5 font-semibold text-right">Stays</th>
                            <th className="px-4 py-2.5 font-semibold text-right">Nights</th>
                            <th className="px-4 py-2.5 font-semibold text-right">Total spend</th>
                            <th className="px-4 py-2.5 font-semibold">Last stay</th>
                            <th className="px-4 py-2.5 font-semibold"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                        {rows.map((g, i) => (
                            <tr key={i} className="hover:bg-stone-50">
                                <td className="px-4 py-2.5">
                                    <span className="font-medium text-stone-800">{g.name}</span>
                                    {g.stays > 1 && (
                                        <span className="ml-2 px-2 py-0.5 rounded-full bg-[#7ed957]/20 text-[#02572a] text-[11px] font-bold">Repeat</span>
                                    )}
                                </td>
                                <td className="px-4 py-2.5 text-stone-500">{g.phone || g.email || '—'}</td>
                                <td className="px-4 py-2.5 text-right">{g.stays}</td>
                                <td className="px-4 py-2.5 text-right">{g.nights}</td>
                                <td className="px-4 py-2.5 text-right font-medium">{naira(g.spend)}</td>
                                <td className="px-4 py-2.5 text-stone-500">{g.lastStay}</td>
                                <td className="px-4 py-2.5">
                                    {g.phone && (
                                        <a href={waHref(g.phone)} target="_blank" rel="noopener noreferrer"
                                           className="inline-flex items-center gap-1 text-[#25D366] text-xs font-semibold">
                                            <MessageCircle size={13} /> WhatsApp
                                        </a>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr><td colSpan={7} className="px-4 py-10 text-center text-stone-400">Guests appear here automatically once bookings come in.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
