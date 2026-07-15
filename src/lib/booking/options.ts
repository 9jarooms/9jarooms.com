export type RoomLite = { id: string; name: string; room_type: string | null; price_per_night: number };
export type ApartmentLite = {
  id: string;
  is_apartment: boolean;
  property_price: number;
  whole_apartment_price: number | null;
  two_bed_price: number | null;
  rooms: RoomLite[];
};
export type BookingOption = {
  type: 'single' | 'two_bed' | 'whole';
  label: string;
  price: number;            // total for the whole stay
  pricePerNight: number;
  roomIds: string[];        // rooms this option books
  lockedRoomIds: string[];  // rooms held empty (2-bed's 3rd room)
  available: boolean;
  key: string;              // 'single:<roomId>' | 'two_bed' | 'whole'
};

export function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.max(0, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000));
}

// ============================================================
// DUPLEX BUNDLES (Kaura)
// A property can be sold both as pooled single rooms AND as whole
// "duplex" units. A duplex is the set of physical rooms whose unit_code
// shares a leading number — e.g. 1A / 1B / 1C is duplex 1. Singles book
// one room independently; a duplex product books the whole unit.
//   - 3-Bed Duplex: guests use all 3 rooms.
//   - 2-Bed Duplex: guests use 2 rooms, the 3rd is held empty (locked).
// Both require every room of a unit free for the dates.
// ============================================================
export type DuplexRoom = { id: string; unit_code: string | null; price_per_night: number | null };
export type DuplexUnit = { duplexNo: string; roomIds: string[] };

// Group rooms into duplex units by the leading number of their unit_code.
// Sorted A→C within a unit (so a 2-bed locks the "C" room last), units 1→8.
export function groupDuplexes(rooms: DuplexRoom[]): DuplexUnit[] {
  const byNo = new Map<string, DuplexRoom[]>();
  for (const r of rooms) {
    const m = (r.unit_code || '').match(/^(\d+)/);
    if (!m) continue;
    if (!byNo.has(m[1])) byNo.set(m[1], []);
    byNo.get(m[1])!.push(r);
  }
  return [...byNo.entries()]
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([duplexNo, group]) => ({
      duplexNo,
      roomIds: group
        .sort((a, b) => (a.unit_code ?? '').localeCompare(b.unit_code ?? ''))
        .map(r => r.id),
    }));
}

// Duplex units whose EVERY room is free for EVERY date in the stay.
export function freeDuplexes(
  duplexes: DuplexUnit[], unavailable: Set<string>, dates: string[]
): DuplexUnit[] {
  return duplexes.filter(d => allFree(d.roomIds, unavailable, dates));
}

// Is at least one whole duplex free for these dates? (3-bed and 2-bed share
// the same availability rule — both need a full unit free.)
export function duplexBundleAvailable(
  duplexes: DuplexUnit[], unavailable: Set<string>, dates: string[]
): boolean {
  return freeDuplexes(duplexes, unavailable, dates).length > 0;
}

function allFree(roomIds: string[], unavailable: Set<string>, dates: string[]): boolean {
  return roomIds.every(rid => dates.every(d => !unavailable.has(`${rid}|${d}`)));
}

// `unavailable` holds `${room_id}|${yyyy-mm-dd}` cells that are NOT bookable.
export function computeOptions(
  apt: ApartmentLite, unavailable: Set<string>, checkIn: string, checkOut: string, dates: string[]
): BookingOption[] {
  const n = Math.max(1, dates.length);
  const out: BookingOption[] = [];

  const order: Record<string, number> = { big_balcony: 0, regular_balcony: 1, no_balcony: 2 };
  const rooms = [...apt.rooms].sort((a, b) => (order[a.room_type ?? ''] ?? 9) - (order[b.room_type ?? ''] ?? 9));
  for (const r of rooms) {
    out.push({
      type: 'single', label: r.name, key: `single:${r.id}`,
      pricePerNight: r.price_per_night, price: r.price_per_night * n,
      roomIds: [r.id], lockedRoomIds: [],
      available: allFree([r.id], unavailable, dates),
    });
  }

  const allRoomIds = apt.rooms.map(r => r.id);
  const wholeFree = allFree(allRoomIds, unavailable, dates);

  if (apt.is_apartment && apt.two_bed_price != null && apt.rooms.length >= 2) {
    const byVal = [...apt.rooms].sort((a, b) => b.price_per_night - a.price_per_night);
    const sold = byVal.slice(0, 2).map(r => r.id);
    const locked = byVal.slice(2).map(r => r.id);
    out.push({
      type: 'two_bed', label: '2-Bedroom', key: 'two_bed',
      pricePerNight: apt.two_bed_price, price: apt.two_bed_price * n,
      roomIds: sold, lockedRoomIds: locked, available: wholeFree,
    });
  }
  if (apt.is_apartment && apt.whole_apartment_price != null) {
    out.push({
      type: 'whole', label: 'Whole Apartment (3-Bed)', key: 'whole',
      pricePerNight: apt.whole_apartment_price, price: apt.whole_apartment_price * n,
      roomIds: allRoomIds, lockedRoomIds: [], available: wholeFree,
    });
  }
  return out;
}
