import type { createAdminClient } from '@/lib/supabase/server';

// ONE way to take, move and release unit-nights, used by every surface:
// the public site (Paystack), the caretakers' Today screen, the CRM and
// payment confirmation. The `availability` table has UNIQUE(room_id, date),
// so inserting with ON CONFLICT DO NOTHING is the arbiter: whoever lands a
// cell first owns it, and a later writer can never overwrite it. The old
// code upserted (= overwrite) and then "verified", which could never detect
// the loser, so two bookings taken in the same seconds — a walk-in on the
// phone and a guest paying online — would both believe they had the unit.

type Db = ReturnType<typeof createAdminClient>;

export type CellStatus = 'held' | 'booked';

export interface Cell {
    room_id: string;
    date: string;
    status: string;
    booking_id: string | null;
}

export interface ClaimResult {
    ok: boolean;
    // cells that belong to someone else (another booking, or a cleaning /
    // maintenance block). Empty when ok.
    conflicts: Cell[];
}

// Hold on unpaid online bookings before they expire.
export const HOLD_MINUTES = 30;

// Nigeria is UTC+1 all year; the server runs in UTC. Pure string arithmetic.
export function lagosToday(now = new Date()): string {
    return new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function dateRange(checkIn: string, checkOut: string): string[] {
    const [y1, m1, d1] = checkIn.split('-').map(Number);
    const [y2, m2, d2] = checkOut.split('-').map(Number);
    const out: string[] = [];
    let t = Date.UTC(y1, m1 - 1, d1);
    const end = Date.UTC(y2, m2 - 1, d2);
    while (t < end) {
        out.push(new Date(t).toISOString().slice(0, 10));
        t += 86_400_000;
    }
    return out;
}

// Unpaid online bookings whose hold has lapsed: mark them expired and give
// their cells back. Nothing in production runs the old Inngest cron, so
// this is called inline at the start of every claim (one cheap query when
// there is nothing to do) and daily from /api/cron/expire-holds.
export async function releaseExpiredHolds(db: Db, now = new Date()): Promise<string[]> {
    const { data, error } = await db
        .from('bookings')
        .select('id')
        .eq('status', 'pending')
        .lt('expires_at', now.toISOString());
    if (error) throw new Error(`releaseExpiredHolds: ${error.message}`);
    const ids = (data || []).map(b => b.id as string);
    if (ids.length === 0) return [];

    await db.from('availability').delete().in('booking_id', ids).eq('status', 'held');
    await db.from('bookings').update({ status: 'expired' }).in('id', ids).eq('status', 'pending');
    return ids;
}

// Take every (room, date) cell for `bookingId`. Cells the booking already
// owns count as taken. Never overwrites: a cell owned by anything else is
// reported as a conflict and the caller decides what to roll back.
export async function claimDates(
    db: Db,
    roomIds: string[],
    dates: string[],
    bookingId: string,
    status: CellStatus,
): Promise<ClaimResult> {
    if (roomIds.length === 0 || dates.length === 0) return { ok: true, conflicts: [] };

    await releaseExpiredHolds(db);

    // Owner-dashboard rows explicitly set to 'available' carry no claim;
    // clear them so our insert can land on those cells.
    await db.from('availability')
        .delete()
        .in('room_id', roomIds)
        .in('date', dates)
        .eq('status', 'available');

    const rows = roomIds.flatMap(room_id => dates.map(date => ({ room_id, date, status, booking_id: bookingId })));
    const { error } = await db
        .from('availability')
        .upsert(rows, { onConflict: 'room_id,date', ignoreDuplicates: true });
    if (error) throw new Error(`claimDates: ${error.message}`);

    const { data: cells, error: readError } = await db
        .from('availability')
        .select('room_id, date, status, booking_id')
        .in('room_id', roomIds)
        .in('date', dates);
    if (readError) throw new Error(`claimDates verify: ${readError.message}`);

    const conflicts = ((cells || []) as Cell[]).filter(c => c.booking_id !== bookingId);

    // A booking that was held (unpaid) and is now solid upgrades its cells.
    if (status === 'booked') {
        await db.from('availability')
            .update({ status: 'booked' })
            .eq('booking_id', bookingId)
            .eq('status', 'held');
    }

    return { ok: conflicts.length === 0, conflicts };
}

// Give back every cell the booking holds (cancel / no-show / lost race).
export async function releaseAllDates(db: Db, bookingId: string): Promise<void> {
    const { error } = await db.from('availability').delete().eq('booking_id', bookingId);
    if (error) throw new Error(`releaseAllDates: ${error.message}`);
}

// Early check-out: the unit is sellable again from today.
export async function releaseDatesFrom(db: Db, bookingId: string, fromDate: string): Promise<void> {
    const { error } = await db.from('availability').delete().eq('booking_id', bookingId).gte('date', fromDate);
    if (error) throw new Error(`releaseDatesFrom: ${error.message}`);
}

export interface MoveResult extends ClaimResult {
    conflictDate?: string;
}

// Move or resize a stay: claim the new range first, and only when every
// cell is ours give the old cells back. On a conflict, the cells this call
// newly took are returned, so the booking is exactly where it started.
export async function moveBookingDates(
    db: Db,
    bookingId: string,
    oldRoomId: string | null,
    newRoomId: string,
    newDates: string[],
    status: CellStatus,
): Promise<MoveResult> {
    const { data: before } = await db
        .from('availability')
        .select('room_id, date')
        .eq('booking_id', bookingId);
    const owned = new Set(((before || []) as { room_id: string; date: string }[]).map(c => `${c.room_id}|${c.date}`));

    const result = await claimDates(db, [newRoomId], newDates, bookingId, status);
    if (!result.ok) {
        const fresh = newDates.filter(d => !owned.has(`${newRoomId}|${d}`));
        if (fresh.length > 0) {
            await db.from('availability').delete().eq('booking_id', bookingId).eq('room_id', newRoomId).in('date', fresh);
        }
        const first = [...result.conflicts].sort((a, b) => a.date.localeCompare(b.date))[0];
        return { ...result, conflictDate: first?.date };
    }

    // Release what is outside the new stay: the old unit entirely (when the
    // unit changed) and the trimmed dates on the new unit.
    if (oldRoomId && oldRoomId !== newRoomId) {
        await db.from('availability').delete().eq('booking_id', bookingId).eq('room_id', oldRoomId);
    }
    if (newDates.length > 0) {
        const first = newDates[0];
        const last = newDates[newDates.length - 1];
        await db.from('availability')
            .delete()
            .eq('booking_id', bookingId)
            .eq('room_id', newRoomId)
            .or(`date.lt.${first},date.gt.${last}`);
    }
    return result;
}

export function describeConflict(conflicts: Cell[]): string {
    const first = [...conflicts].sort((a, b) => a.date.localeCompare(b.date))[0];
    if (!first) return 'Unit is not free for those dates';
    const what = first.booking_id ? 'already has a booking' : `is blocked for ${first.status}`;
    return `Unit ${what} on ${first.date}`;
}
