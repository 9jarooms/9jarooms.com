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
