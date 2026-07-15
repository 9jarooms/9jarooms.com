import { describe, it, expect } from 'vitest';
import { groupDuplexes, freeDuplexes, duplexBundleAvailable, type DuplexRoom } from './options';

// Kaura: 3 duplex units of 3 rooms each (nA/nB/nC).
const rooms: DuplexRoom[] = [
  { id: 'r1a', unit_code: '1A', price_per_night: 35000 },
  { id: 'r1b', unit_code: '1B', price_per_night: 30000 },
  { id: 'r1c', unit_code: '1C', price_per_night: 40000 },
  { id: 'r2a', unit_code: '2A', price_per_night: 35000 },
  { id: 'r2b', unit_code: '2B', price_per_night: 30000 },
  { id: 'r2c', unit_code: '2C', price_per_night: 40000 },
  { id: 'r3a', unit_code: '3A', price_per_night: 35000 },
  { id: 'r3b', unit_code: '3B', price_per_night: 30000 },
  { id: 'r3c', unit_code: '3C', price_per_night: 40000 },
];
const dates = ['2026-07-01', '2026-07-02'];

describe('groupDuplexes', () => {
  it('groups rooms into 3 units of 3, sorted A→C', () => {
    const units = groupDuplexes(rooms);
    expect(units.map(u => u.duplexNo)).toEqual(['1', '2', '3']);
    expect(units[0].roomIds).toEqual(['r1a', 'r1b', 'r1c']);
  });
  it('ignores rooms without a numeric unit code', () => {
    expect(groupDuplexes([{ id: 'x', unit_code: null, price_per_night: 1 }])).toEqual([]);
  });
});

describe('freeDuplexes / duplexBundleAvailable', () => {
  it('all units free when nothing is blocked', () => {
    const units = groupDuplexes(rooms);
    expect(freeDuplexes(units, new Set(), dates)).toHaveLength(3);
    expect(duplexBundleAvailable(units, new Set(), dates)).toBe(true);
  });
  it('blocking ONE room of a unit removes only that whole unit', () => {
    const units = groupDuplexes(rooms);
    // 1B taken on the 2nd → unit 1 is no longer a whole free duplex
    const unavailable = new Set(['r1b|2026-07-02']);
    const free = freeDuplexes(units, unavailable, dates);
    expect(free.map(u => u.duplexNo)).toEqual(['2', '3']);
    expect(duplexBundleAvailable(units, unavailable, dates)).toBe(true);
  });
  it('no duplex available when every unit has a blocked room', () => {
    const units = groupDuplexes(rooms);
    const unavailable = new Set(['r1a|2026-07-01', 'r2c|2026-07-02', 'r3b|2026-07-01']);
    expect(freeDuplexes(units, unavailable, dates)).toHaveLength(0);
    expect(duplexBundleAvailable(units, unavailable, dates)).toBe(false);
  });
});
