import { describe, it, expect, beforeEach } from 'vitest';
import { claimDates, moveBookingDates, releaseExpiredHolds, releaseDatesFrom, dateRange, lagosToday } from './claim';

// In-memory stand-in for the two tables the claim engine touches, with the
// same semantics as Postgres for what matters here: UNIQUE(room_id, date)
// on availability and ON CONFLICT DO NOTHING for ignoreDuplicates upserts.
type Row = Record<string, any>;
class FakeDb {
    tables: Record<string, Row[]> = { availability: [], bookings: [] };
    from(table: string) {
        const db = this;
        const filters: ((r: Row) => boolean)[] = [];
        let op: 'select' | 'insert' | 'update' | 'delete' = 'select';
        let payload: any = null;
        let upsertOpts: any = null;
        const builder: any = {
            select() { return builder; },
            insert(rows: Row | Row[]) { op = 'insert'; payload = Array.isArray(rows) ? rows : [rows]; return builder; },
            upsert(rows: Row[], opts: any) { op = 'insert'; payload = rows; upsertOpts = opts; return builder; },
            update(patch: Row) { op = 'update'; payload = patch; return builder; },
            delete() { op = 'delete'; return builder; },
            eq(c: string, v: any) { filters.push(r => r[c] === v); return builder; },
            neq(c: string, v: any) { filters.push(r => r[c] !== v); return builder; },
            in(c: string, vs: any[]) { filters.push(r => vs.includes(r[c])); return builder; },
            lt(c: string, v: any) { filters.push(r => r[c] != null && r[c] < v); return builder; },
            gte(c: string, v: any) { filters.push(r => r[c] >= v); return builder; },
            or(expr: string) {
                const parts = expr.split(',').map(p => p.split('.'));
                filters.push(r => parts.some(([c, o, v]) => (o === 'lt' ? r[c] < v : o === 'gt' ? r[c] > v : o === 'gte' ? r[c] >= v : r[c] === v)));
                return builder;
            },
            then(resolve: (v: any) => void) {
                const rows = db.tables[table];
                const match = (r: Row) => filters.every(f => f(r));
                if (op === 'select') return resolve({ data: rows.filter(match).map(r => ({ ...r })), error: null });
                if (op === 'delete') { db.tables[table] = rows.filter(r => !match(r)); return resolve({ data: null, error: null }); }
                if (op === 'update') { for (const r of rows) if (match(r)) Object.assign(r, payload); return resolve({ data: null, error: null }); }
                // insert / upsert
                for (const row of payload) {
                    const clash = table === 'availability' ? rows.find(r => r.room_id === row.room_id && r.date === row.date) : null;
                    if (clash) {
                        if (upsertOpts?.ignoreDuplicates) continue;            // DO NOTHING
                        if (upsertOpts) { Object.assign(clash, row); continue; } // DO UPDATE (merge)
                        return resolve({ data: null, error: { message: 'duplicate key value violates unique constraint' } });
                    }
                    rows.push({ ...row });
                }
                return resolve({ data: null, error: null });
            },
        };
        return builder;
    }
    cells(roomId: string) {
        return this.tables.availability.filter(r => r.room_id === roomId).sort((a, b) => a.date.localeCompare(b.date)).map(r => `${r.date}:${r.status}:${r.booking_id}`);
    }
}

const D = dateRange('2026-10-10', '2026-10-13'); // 10, 11, 12

describe('dateRange / lagosToday', () => {
    it('lists the nights of a stay, check-out excluded', () => {
        expect(D).toEqual(['2026-10-10', '2026-10-11', '2026-10-12']);
        expect(dateRange('2026-10-31', '2026-11-02')).toEqual(['2026-10-31', '2026-11-01']);
        expect(dateRange('2026-10-10', '2026-10-10')).toEqual([]);
    });
    it('rolls to the next day at 23:00 UTC (midnight in Nigeria)', () => {
        expect(lagosToday(new Date('2026-10-06T22:59:00Z'))).toBe('2026-10-06');
        expect(lagosToday(new Date('2026-10-06T23:00:00Z'))).toBe('2026-10-07');
    });
});

describe('claimDates', () => {
    let db: FakeDb;
    beforeEach(() => { db = new FakeDb(); });

    it('takes free cells for the booking', async () => {
        const r = await claimDates(db as any, ['u1'], D, 'b1', 'booked');
        expect(r.ok).toBe(true);
        expect(db.cells('u1')).toEqual(['2026-10-10:booked:b1', '2026-10-11:booked:b1', '2026-10-12:booked:b1']);
    });

    it('never overwrites a cell another booking already owns', async () => {
        // caretaker walk-in lands first…
        await claimDates(db as any, ['u1'], ['2026-10-11'], 'walkin', 'booked');
        // …then a website guest tries the same unit for an overlapping stay
        const r = await claimDates(db as any, ['u1'], D, 'web', 'held');
        expect(r.ok).toBe(false);
        expect(r.conflicts.map(c => `${c.date}:${c.booking_id}`)).toEqual(['2026-10-11:walkin']);
        // the walk-in's cell is untouched
        expect(db.cells('u1')).toContain('2026-10-11:booked:walkin');
    });

    it('treats cleaning / maintenance blocks as taken', async () => {
        db.tables.availability.push({ room_id: 'u1', date: '2026-10-12', status: 'cleaning', booking_id: null });
        const r = await claimDates(db as any, ['u1'], D, 'b1', 'booked');
        expect(r.ok).toBe(false);
        expect(r.conflicts[0].status).toBe('cleaning');
    });

    it('ignores an expired unpaid hold and frees that booking', async () => {
        db.tables.bookings.push({ id: 'stale', status: 'pending', expires_at: '2026-10-06T10:00:00.000Z' });
        db.tables.availability.push({ room_id: 'u1', date: '2026-10-10', status: 'held', booking_id: 'stale' });
        const r = await claimDates(db as any, ['u1'], D, 'b1', 'booked');
        expect(r.ok).toBe(true);
        expect(db.tables.bookings[0].status).toBe('expired');
        expect(db.cells('u1')[0]).toBe('2026-10-10:booked:b1');
    });

    it('respects an unexpired hold (guest still on the Paystack page)', async () => {
        const future = new Date(Date.now() + 10 * 60_000).toISOString();
        db.tables.bookings.push({ id: 'paying', status: 'pending', expires_at: future });
        db.tables.availability.push({ room_id: 'u1', date: '2026-10-10', status: 'held', booking_id: 'paying' });
        const r = await claimDates(db as any, ['u1'], D, 'b1', 'booked');
        expect(r.ok).toBe(false);
        expect(r.conflicts[0].booking_id).toBe('paying');
    });

    it('upgrades its own held cells to booked when the booking is paid', async () => {
        await claimDates(db as any, ['u1'], D, 'b1', 'held');
        const r = await claimDates(db as any, ['u1'], D, 'b1', 'booked');
        expect(r.ok).toBe(true);
        expect(db.cells('u1').every(c => c.includes(':booked:b1'))).toBe(true);
    });

    it('clears meaningless "available" placeholder rows', async () => {
        db.tables.availability.push({ room_id: 'u1', date: '2026-10-10', status: 'available', booking_id: null });
        const r = await claimDates(db as any, ['u1'], D, 'b1', 'booked');
        expect(r.ok).toBe(true);
        expect(db.cells('u1')[0]).toBe('2026-10-10:booked:b1');
    });

    it('claims every room of a bundle or none of them is reported clean', async () => {
        await claimDates(db as any, ['u2'], ['2026-10-12'], 'other', 'booked');
        const r = await claimDates(db as any, ['u1', 'u2', 'u3'], D, 'duplex', 'held');
        expect(r.ok).toBe(false);
        expect(r.conflicts).toHaveLength(1);
        expect(r.conflicts[0].room_id).toBe('u2');
    });
});

describe('moveBookingDates', () => {
    let db: FakeDb;
    beforeEach(async () => {
        db = new FakeDb();
        await claimDates(db as any, ['u1'], D, 'b1', 'booked');
    });

    it('extends a stay when the extra nights are free', async () => {
        const r = await moveBookingDates(db as any, 'b1', 'u1', 'u1', dateRange('2026-10-10', '2026-10-15'), 'booked');
        expect(r.ok).toBe(true);
        expect(db.cells('u1')).toHaveLength(5);
    });

    it('refuses an extension into another booking and leaves everything as it was', async () => {
        await claimDates(db as any, ['u1'], ['2026-10-14'], 'next', 'booked');
        const before = db.cells('u1');
        const r = await moveBookingDates(db as any, 'b1', 'u1', 'u1', dateRange('2026-10-10', '2026-10-15'), 'booked');
        expect(r.ok).toBe(false);
        expect(r.conflictDate).toBe('2026-10-14');
        expect(db.cells('u1')).toEqual(before);
    });

    it('shortens a stay and releases the trimmed nights', async () => {
        const r = await moveBookingDates(db as any, 'b1', 'u1', 'u1', dateRange('2026-10-10', '2026-10-11'), 'booked');
        expect(r.ok).toBe(true);
        expect(db.cells('u1')).toEqual(['2026-10-10:booked:b1']);
    });

    it('moves to another unit and frees the old one', async () => {
        const r = await moveBookingDates(db as any, 'b1', 'u1', 'u2', D, 'booked');
        expect(r.ok).toBe(true);
        expect(db.cells('u1')).toEqual([]);
        expect(db.cells('u2')).toHaveLength(3);
    });

    it('keeps the old unit when the target unit is taken', async () => {
        await claimDates(db as any, ['u2'], ['2026-10-11'], 'x', 'booked');
        const r = await moveBookingDates(db as any, 'b1', 'u1', 'u2', D, 'booked');
        expect(r.ok).toBe(false);
        expect(db.cells('u1')).toHaveLength(3);
        expect(db.cells('u2')).toEqual(['2026-10-11:booked:x']);
    });
});

describe('releaseExpiredHolds / releaseDatesFrom', () => {
    it('only touches pending bookings past their expiry', async () => {
        const db = new FakeDb();
        db.tables.bookings.push(
            { id: 'old', status: 'pending', expires_at: '2026-10-01T00:00:00.000Z' },
            { id: 'paid', status: 'paid', expires_at: '2026-10-01T00:00:00.000Z' },
            { id: 'fresh', status: 'pending', expires_at: '2099-01-01T00:00:00.000Z' },
        );
        db.tables.availability.push(
            { room_id: 'u1', date: '2026-10-10', status: 'held', booking_id: 'old' },
            { room_id: 'u1', date: '2026-10-11', status: 'booked', booking_id: 'paid' },
            { room_id: 'u1', date: '2026-10-12', status: 'held', booking_id: 'fresh' },
        );
        const ids = await releaseExpiredHolds(db as any, new Date('2026-10-06T12:00:00Z'));
        expect(ids).toEqual(['old']);
        expect(db.cells('u1')).toEqual(['2026-10-11:booked:paid', '2026-10-12:held:fresh']);
        expect(db.tables.bookings.map(b => b.status)).toEqual(['expired', 'paid', 'pending']);
    });

    it('early check-out frees the unit from today', async () => {
        const db = new FakeDb();
        await claimDates(db as any, ['u1'], D, 'b1', 'booked');
        await releaseDatesFrom(db as any, 'b1', '2026-10-11');
        expect(db.cells('u1')).toEqual(['2026-10-10:booked:b1']);
    });
});
