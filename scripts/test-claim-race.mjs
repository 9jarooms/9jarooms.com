// Proves the "same second" guarantee against the real database: N bookings
// race for the same unit and dates far in the future; exactly one must end
// up owning every night, the rest must see conflicts. Everything it creates
// is deleted afterwards.
//
//   node --env-file=.env.local scripts/test-claim-race.mjs
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// same logic as src/lib/booking/hold.ts (plain JS so the script needs no build)
async function claimDates(roomIds, dates, status, bookingId) {
    const { data: existing } = await supabase
        .from('availability')
        .select('id, status, booking_id, booking:bookings(status, expires_at)')
        .in('room_id', roomIds).in('date', dates);
    const now = Date.now();
    const stale = (existing || []).filter(c => {
        if (c.booking_id === bookingId) return false;
        if (c.status === 'available') return true;
        if (c.status !== 'held') return false;
        if (!c.booking) return true;
        if (['expired', 'cancelled', 'no_show'].includes(c.booking.status)) return true;
        return !!c.booking.expires_at && new Date(c.booking.expires_at).getTime() < now;
    });
    if (stale.length) await supabase.from('availability').delete().in('id', stale.map(c => c.id));
    const rows = roomIds.flatMap(room_id => dates.map(date => ({ room_id, date, status, booking_id: bookingId })));
    const { error } = await supabase.from('availability').upsert(rows, { onConflict: 'room_id,date', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    const { data: verify } = await supabase.from('availability').select('room_id, date, booking_id, status').in('room_id', roomIds).in('date', dates);
    return (verify || []).filter(c => c.booking_id !== bookingId);
}

const RACERS = 6;
const dates = ['2031-03-01', '2031-03-02', '2031-03-03'];

const { data: room } = await supabase.from('rooms').select('id, property_id, unit_code').eq('is_active', true).limit(1).single();
console.log(`unit ${room.unit_code} (${room.id}) · ${RACERS} racers · ${dates.length} nights`);

// make sure nothing is on those cells before we start
await supabase.from('availability').delete().eq('room_id', room.id).in('date', dates);

const bookingIds = [];
try {
    for (let i = 0; i < RACERS; i++) {
        const { data: b, error } = await supabase.from('bookings').insert({
            room_id: room.id, property_id: room.property_id,
            guest_name: `RACE TEST ${i}`, guest_email: `race${i}@test.invalid`,
            check_in: dates[0], check_out: '2031-03-04', nights: dates.length,
            price_per_night: 1, total_amount: 3, status: 'pending', booking_source: 'race_test',
            expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        }).select('id').single();
        if (error) throw new Error(error.message);
        bookingIds.push(b.id);
    }

    const results = await Promise.all(bookingIds.map(id => claimDates([room.id], dates, 'held', id)));
    const winners = results.map((c, i) => ({ i, won: c.length === 0 })).filter(r => r.won);
    console.log(results.map((c, i) => `booking ${i}: ${c.length === 0 ? 'WON' : `lost (${c.length} cells taken)`}`).join('\n'));

    const { data: cells } = await supabase.from('availability').select('date, booking_id').eq('room_id', room.id).in('date', dates);
    const owners = new Set((cells || []).map(c => c.booking_id));
    const ok = winners.length === 1 && cells.length === dates.length && owners.size === 1 && owners.has(bookingIds[winners[0].i]);
    console.log(ok ? `\nPASS: exactly one winner, all ${dates.length} nights belong to it` : `\nFAIL: winners=${winners.length} cells=${cells.length} owners=${owners.size}`);

    // late payment on a loser after an expired winner: the loser must be
    // able to reclaim once the winner's hold has expired
    const winnerId = bookingIds[winners[0].i];
    await supabase.from('bookings').update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq('id', winnerId);
    const loserId = bookingIds.find(id => id !== winnerId);
    const late = await claimDates([room.id], dates, 'booked', loserId);
    console.log(late.length === 0 ? 'PASS: expired hold was cleared and re-claimed' : 'FAIL: expired hold still blocks');
    if (!ok || late.length) process.exitCode = 1;
} finally {
    await supabase.from('availability').delete().eq('room_id', room.id).in('date', dates);
    if (bookingIds.length) {
        await supabase.from('booking_rooms').delete().in('booking_id', bookingIds);
        await supabase.from('bookings').delete().in('id', bookingIds);
    }
    console.log('cleaned up');
}
