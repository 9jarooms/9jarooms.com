import { describe, it, expect } from 'vitest';
import { computeOptions, ApartmentLite } from './options';

const apt: ApartmentLite = {
  id: 'apt', is_apartment: true, property_price: 0,
  whole_apartment_price: 150000, two_bed_price: 120000,
  rooms: [
    { id: 'big', name: 'Big Balcony', room_type: 'big_balcony', price_per_night: 40000 },
    { id: 'reg', name: 'Regular Balcony', room_type: 'regular_balcony', price_per_night: 35000 },
    { id: 'no',  name: 'No Balcony', room_type: 'no_balcony', price_per_night: 30000 },
  ],
};
const dates = ['2026-07-01'];
const args = (unav: string[]) => computeOptions(apt, new Set(unav), '2026-07-01', '2026-07-02', dates);

describe('computeOptions', () => {
  it('all 5 options available when all rooms free', () => {
    const o = args([]);
    expect(o.map(x => x.key).sort()).toEqual(['single:big', 'single:no', 'single:reg', 'two_bed', 'whole'].sort());
    expect(o.every(x => x.available)).toBe(true);
    expect(o.find(x => x.key === 'whole')!.price).toBe(150000);
    expect(o.find(x => x.key === 'two_bed')!.price).toBe(120000);
    expect(o.find(x => x.key === 'single:big')!.price).toBe(40000);
  });
  it('booking one single disables whole + 2-bed but keeps other singles', () => {
    const o = args(['big|2026-07-01']);
    expect(o.find(x => x.key === 'whole')!.available).toBe(false);
    expect(o.find(x => x.key === 'two_bed')!.available).toBe(false);
    expect(o.find(x => x.key === 'single:big')!.available).toBe(false);
    expect(o.find(x => x.key === 'single:reg')!.available).toBe(true);
    expect(o.find(x => x.key === 'single:no')!.available).toBe(true);
  });
  it('whole/2-bed each occupy all 3 rooms; 2-bed locks one', () => {
    const o = args([]);
    expect(o.find(x => x.key === 'whole')!.roomIds.sort()).toEqual(['big', 'no', 'reg']);
    const twoBed = o.find(x => x.key === 'two_bed')!;
    expect(twoBed.roomIds.length).toBe(2);
    expect(twoBed.lockedRoomIds.length).toBe(1);
    expect([...twoBed.roomIds, ...twoBed.lockedRoomIds].sort()).toEqual(['big', 'no', 'reg']);
  });
  it('multi-night prices multiply by nights', () => {
    const o = computeOptions(apt, new Set(), '2026-07-01', '2026-07-03', ['2026-07-01', '2026-07-02']);
    expect(o.find(x => x.key === 'whole')!.price).toBe(300000);
    expect(o.find(x => x.key === 'single:big')!.price).toBe(80000);
  });
  it('non-apartment returns one option per room, no bundles', () => {
    const o = computeOptions({ ...apt, is_apartment: false, whole_apartment_price: null, two_bed_price: null }, new Set(), '2026-07-01', '2026-07-02', dates);
    expect(o.some(x => x.type === 'whole' || x.type === 'two_bed')).toBe(false);
  });
});
