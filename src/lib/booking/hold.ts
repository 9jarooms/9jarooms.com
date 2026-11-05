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
        // a plain "available" row with no booking is leftover data
        if (!cell.booking_id) return cell.status === 'available';
        // a booking's night is only stale when the booking is gone or dead, or it is an unpaid hold
        // past its expiry. A booked night of a live booking is never touched, whatever its status says.
        if (!cell.booking) return true;
        if (['expired', 'cancelled', 'no_show'].includes(cell.booking.status)) return true;
        // an overdue unpaid hold: only its still-"held" nights (a payment being confirmed turns them
        // to "booked" first, and those are never taken from it)
        return cell.status === 'held' && cell.booking.status === 'pending' && !!cell.booking.expires_at && new Date(cell.booking.expires_at).getTime() < now;
    });
    if (stale.length > 0) {
        const held = stale.filter(c => c.status === 'held').map(c => c.id);
        const other = stale.filter(c => c.status !== 'held').map(c => c.id);
        // re-checked at delete time: a hold confirmed a moment ago is "booked" now and is left alone
        if (held.length) await supabase.from('availability').delete().in('id', held).eq('status', 'held');
        if (other.length) await supabase.from('availability').delete().in('id', other);   // no booking, or a dead one
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

    const cells = (verify || []) as ConflictCell[];
    const conflicts = cells.filter(c => c.booking_id !== bookingId);
    // every requested room-night must exist and be ours: one deleted mid-claim is a clash too
    const have = new Set(cells.filter(c => c.booking_id === bookingId).map(c => `${c.room_id}|${c.date}`));
    for (const room_id of roomIds) for (const date of dates) {
        if (!have.has(`${room_id}|${date}`) && !conflicts.some(c => c.room_id === room_id && c.date === date)) {
            conflicts.push({ room_id, date, booking_id: null, status: 'missing' });
        }
    }
    return conflicts;
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

// Move a booking onto a set of rooms × nights without ever letting go of what it already holds.
// New nights are claimed first; only when every one is ours are the nights it no longer needs given
// back. On a clash, the nights claimed in this call are dropped again and the booking is exactly as
// it was. Used for stay moves/extensions, confirming a hold, late payments and restoring bookings.
export async function reclaim(
    supabase: Db,
    bookingId: string,
    roomIds: string[],
    dates: string[],
    status: 'held' | 'booked',
): Promise<ConflictCell[]> {
    const { data: before } = await supabase.from('availability').select('id').eq('booking_id', bookingId);
    const had = new Set((before || []).map(c => c.id as string));

    const conflicts = await claimDates(supabase, roomIds, dates, status, bookingId);
    const { data: now } = await supabase.from('availability').select('id, room_id, date').eq('booking_id', bookingId);
    const mine = (now || []) as { id: string; room_id: string; date: string }[];

    if (conflicts.length > 0) {
        const added = mine.filter(c => !had.has(c.id)).map(c => c.id);
        if (added.length) await supabase.from('availability').delete().in('id', added);
        return conflicts;
    }
    const want = new Set(roomIds.flatMap(r => dates.map(d => `${r}|${d}`)));
    await supabase.from('availability').update({ status }).eq('booking_id', bookingId).neq('status', status);
    const { data: after } = await supabase.from('availability').select('id, room_id, date').eq('booking_id', bookingId);
    const have = new Set((after || []).map(c => `${c.room_id}|${c.date}`));
    const lost = [...want].filter(k => !have.has(k));
    if (lost.length) {
        const added = (after || []).filter(c => !had.has(c.id)).map(c => c.id);
        if (added.length) await supabase.from('availability').delete().in('id', added);
        const [room_id, date] = lost[0].split('|');
        return [{ room_id, date, booking_id: null, status: 'missing' }];
    }
    const extra = (after || []).filter(c => !want.has(`${c.room_id}|${c.date}`)).map(c => c.id);
    if (extra.length) await supabase.from('availability').delete().in('id', extra);
    return [];
}

// Today's date in Lagos (UTC+1, no daylight saving), never the phone's clock
export function lagosToday() {
    return new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);
}

// Rooms with a guest still checked in after their check-out date: they are in the room tonight, so
// nobody else can be put there tonight (the stay has no nights past check-out in the table).
export async function overstayRooms(supabase: Db, roomIds?: string[]): Promise<Set<string>> {
    let q = supabase.from('bookings').select('room_id, id').eq('status', 'checked_in').lte('check_out', lagosToday());
    if (roomIds) q = q.in('room_id', roomIds);
    const { data } = await q;
    const ids = new Set<string>();
    for (const b of data || []) for (const r of await roomsOfBooking(supabase, b as { id: string; room_id: string })) ids.add(r);
    return ids;
}
