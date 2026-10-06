import { describe, it, expect } from 'vitest';
import { makeStaffToken, verifyStaffToken, waNumber, linkVersion } from './staff-link';

const KEY = 'test-key';
const ID = '3f2a9c1e-7b4d-4e8f-9a01-23456789abcd';

describe('staff link tokens', () => {
    it('round-trips user id and version', () => {
        const t = makeStaffToken(ID, 3, KEY);
        expect(t).toMatch(/^[0-9a-f]{32}\.3\.[A-Za-z0-9_-]{24}$/);
        expect(verifyStaffToken(t, KEY)).toEqual({ userId: ID, version: 3 });
    });

    it('rejects a tampered user id, version or signature', () => {
        const t = makeStaffToken(ID, 1, KEY);
        const [id, v, sig] = t.split('.');
        const otherId = id.slice(0, -1) + (id.endsWith('a') ? 'b' : 'a');
        expect(verifyStaffToken(`${otherId}.${v}.${sig}`, KEY)).toBeNull();
        expect(verifyStaffToken(`${id}.2.${sig}`, KEY)).toBeNull();
        expect(verifyStaffToken(`${id}.${v}.${sig.slice(0, -1)}A`, KEY)).toBeNull();
    });

    it('rejects a token signed with another key', () => {
        expect(verifyStaffToken(makeStaffToken(ID, 1, 'other'), KEY)).toBeNull();
    });

    it('rejects junk', () => {
        for (const junk of ['', 'abc', '../../etc', `${ID}.1.x`]) expect(verifyStaffToken(junk, KEY)).toBeNull();
    });

    it('version defaults to 1', () => {
        expect(linkVersion(undefined)).toBe(1);
        expect(linkVersion({ staff_link_v: 4 })).toBe(4);
        expect(linkVersion({ staff_link_v: 'x' })).toBe(1);
    });
});

describe('waNumber', () => {
    it('normalises Nigerian numbers', () => {
        expect(waNumber('0803 123 4567')).toBe('2348031234567');
        expect(waNumber('+234 803 123 4567')).toBe('2348031234567');
        expect(waNumber('8031234567')).toBe('2348031234567');
        expect(waNumber('')).toBeNull();
        expect(waNumber('123')).toBeNull();
    });
});
