import { NextRequest, NextResponse } from 'next/server';
import { requireCrm } from '@/lib/auth/require-crm';
import { addDays, format } from 'date-fns';
import { z } from 'zod';

const blockSchema = z.object({
    roomId: z.string().uuid(),
    from: z.string(),
    to: z.string(), // exclusive
    status: z.enum(['cleaning', 'maintenance', 'available']),
});

// Block (or clear) a range of dates on a unit for cleaning/maintenance.
export async function POST(request: NextRequest) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.adminClient!;

    const parsed = blockSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    const { roomId, from, to, status } = parsed.data;

    const dates: string[] = [];
    let current = new Date(from);
    const end = new Date(to);
    while (current < end) {
        dates.push(format(current, 'yyyy-MM-dd'));
        current = addDays(current, 1);
    }
    if (dates.length === 0) return NextResponse.json({ error: 'Empty date range' }, { status: 400 });

    // Never overwrite dates a booking holds
    const { data: existing } = await supabase
        .from('availability')
        .select('date, booking_id, status')
        .eq('room_id', roomId)
        .in('date', dates);

    const bookedDates = (existing || []).filter(r => r.booking_id).map(r => r.date);
    if (bookedDates.length > 0 && status !== 'available') {
        return NextResponse.json(
            { error: `Dates with bookings cannot be blocked: ${bookedDates.join(', ')}` },
            { status: 409 }
        );
    }

    if (status === 'available') {
        // clear manual blocks only — booking-held rows stay
        const { error } = await supabase
            .from('availability')
            .delete()
            .eq('room_id', roomId)
            .in('date', dates)
            .is('booking_id', null);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
        const { error } = await supabase.from('availability').upsert(
            dates.map(date => ({ room_id: roomId, date, status, booking_id: null })),
            { onConflict: 'room_id,date' }
        );
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, dates: dates.length });
}
