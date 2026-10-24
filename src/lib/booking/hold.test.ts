import { describe, it, expect } from 'vitest';
import { stayDates, holdExpiry, HOLD_MINUTES } from './hold';

describe('stayDates', () => {
    it('lists check-in through the night before check-out', () => {
        expect(stayDates('2026-10-24', '2026-10-27')).toEqual(['2026-10-24', '2026-10-25', '2026-10-26']);
    });

    it('is a plain calendar count, whatever the process timezone', () => {
        // a one-night stay must never slide to the previous day
        expect(stayDates('2026-10-24', '2026-10-25')).toEqual(['2026-10-24']);
        // crosses month and year ends
        expect(stayDates('2026-12-31', '2027-01-02')).toEqual(['2026-12-31', '2027-01-01']);
    });

    it('is empty when check-out is not after check-in', () => {
        expect(stayDates('2026-10-24', '2026-10-24')).toEqual([]);
        expect(stayDates('2026-10-25', '2026-10-24')).toEqual([]);
    });

    it('ignores a time part on the dates', () => {
        expect(stayDates('2026-10-24T00:00:00.000Z', '2026-10-25T00:00:00.000Z')).toEqual(['2026-10-24']);
    });
});

describe('holdExpiry', () => {
    it('is HOLD_MINUTES from now', () => {
        const now = Date.UTC(2026, 9, 24, 12, 0, 0);
        expect(holdExpiry(now).getTime() - now).toBe(HOLD_MINUTES * 60 * 1000);
        expect(HOLD_MINUTES).toBe(15);
    });
});
