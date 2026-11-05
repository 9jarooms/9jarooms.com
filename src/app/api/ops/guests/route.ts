import { NextRequest, NextResponse } from 'next/server';
import { requireOps } from '@/lib/auth/require-ops';

// Guests we have hosted before, for the name/phone boxes in New booking: type part of a name or a
// number and pick them instead of typing everything again. Built from past bookings (newest first).
export async function GET(request: NextRequest) {
    const auth = await requireOps();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const q = (new URL(request.url).searchParams.get('q') || '').trim().replace(/[%_,()]/g, '');
    if (q.length < 2) return NextResponse.json({ guests: [] });

    const digits = q.replace(/\D/g, '');
    const filters = [`guest_name.ilike.%${q}%`];
    if (digits.length >= 3) filters.push(`guest_phone.ilike.%${digits.slice(-10)}%`);
    const { data } = await auth.adminClient.from('bookings')
        .select('guest_name, guest_phone, guest_email, check_in')
        .or(filters.join(','))
        .not('status', 'in', '(expired)')
        .neq('booking_source', 'maintenance')
        .order('check_in', { ascending: false })
        .limit(80);

    // one entry per person (same phone, or same name when there is no phone), with their stay count
    const seen = new Map<string, { name: string; phone: string | null; email: string | null; stays: number; last: string }>();
    for (const b of data || []) {
        const key = (b.guest_phone || '').replace(/\D/g, '').slice(-10) || b.guest_name.trim().toLowerCase();
        const g = seen.get(key);
        if (g) g.stays++;
        else seen.set(key, { name: b.guest_name.trim(), phone: b.guest_phone, email: b.guest_email, stays: 1, last: b.check_in });
    }
    return NextResponse.json({ guests: [...seen.values()].slice(0, 8) });
}
