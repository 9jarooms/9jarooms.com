import type { createAdminClient } from '@/lib/supabase/server';

// The one place a booking claims its nights. Website, caretaker holds,
// stay moves and late payments all go through claimDates so the
// availability table's UNIQUE(room_id, date) is the referee for every
// channel at once.
//
// Insert-only: a cell that already belongs to another booking is left
// untouched (ON CONFLICT DO NOTHING), so two bookings racing for the same
// unit can never both come out looking valid — one wins the row, the other
// sees it in the verify step and backs off. Stale cells (expired holds and
// leftover 'available' rows) are cleared first so a guest who walked away
// cannot keep a unit blocked until the expiry cron runs.

type Db = ReturnType<typeof createAdminClient>;

// How long an unpaid hold (website checkout or a caretaker's WhatsApp hold)
// blocks the unit before it releases itself.
export const HOLD_MINUTES = 15;

export function holdExpiry(now = Date.now()) {
    return new Date(now + HOLD_MINUTES * 60 * 1000);
}

// Nights of a stay as YYYY-MM-DD strings, check-in through the night
// before check-out. Pure calendar arithmetic (UTC), so the result is the
// same on a laptop in any timezone as on the UTC server.
export function stayDates(checkIn: string, checkOut: string): string[] {
    const parse = (s: string) => {
        const [y, m, d] = s.slice(0, 10).split('-').map(Number);
        return Date.UTC(y, m - 1, d);
    };
    const dates: string[] = [];
    const end = parse(checkOut);
    for (let t = parse(checkIn); t < end; t += 86_400_000) {
        dates.push(new Date(t).toISOString().slice(0, 10));
    }
    return dates;
}

export interface ConflictCell { room_id: string; date: string; booking_id: string | null; status: string }

export async function claimDates(
    supabase: Db,
    roomIds: string[],
    dates: string[],
    status: 'held' | 'booked',
    bookingId: string,
): Promise<ConflictCell[]> {
    if (roomIds.length === 0 || dates.length === 0) return [];

    // 1. Clear cells nobody really holds any more.
    const { data: existing } = await supabase
        .from('availability')
        .select('id, room_id, date, status, booking_id, booking:bookings(status, expires_at)')
        .in('room_id', roomIds)
        .in('date', dates);

    const now = Date.now();
    const stale = ((existing || []) as unknown as Array<{
        id: string; status: string; booking_id: string | null;
        booking?: { status: string; expires_at: string | null } | null;
    }>).filter(cell => {
        if (cell.booking_id === bookingId) return false;
        if (cell.status === 'available') return true;
        if (cell.status !== 'held') return false;
        // a held cell is stale when its booking is gone, dead, or past its expiry
        if (!cell.booking) return true;
        if (['expired', 'cancelled', 'no_show'].includes(cell.booking.status)) return true;
        return !!cell.booking.expires_at && new Date(cell.booking.expires_at).getTime() < now;
    });
    if (stale.length > 0) {
        await supabase.from('availability').delete().in('id', stale.map(c => c.id));
    }

    // 2. Insert-only claim. Rows that already exist are left alone.
    const rows = roomIds.flatMap(room_id => dates.map(date => ({ room_id, date, status, booking_id: bookingId })));
    const { error } = await supabase
        .from('availability')
        .upsert(rows, { onConflict: 'room_id,date', ignoreDuplicates: true });
    if (error) throw new Error(`Could not claim dates: ${error.message}`);

    // 3. Verify every cell is ours. Anything else is a genuine conflict.
    const { data: verify } = await supabase
        .from('availability')
        .select('room_id, date, booking_id, status')
        .in('room_id', roomIds)
        .in('date', dates);

    return ((verify || []) as ConflictCell[]).filter(c => c.booking_id !== bookingId);
}

// Give back every cell a booking holds.
export async function releaseClaim(supabase: Db, bookingId: string) {
    await supabase.from('availability').delete().eq('booking_id', bookingId);
}

// Every physical room a booking occupies: the rooms recorded in
// booking_rooms (bundles) or, before that table was filled, room_id.
export async function roomsOfBooking(supabase: Db, booking: { id: string; room_id: string }): Promise<string[]> {
    const { data } = await supabase.from('booking_rooms').select('room_id').eq('booking_id', booking.id);
    const ids = (data || []).map(r => r.room_id as string);
    return ids.length > 0 ? ids : [booking.room_id];
}
