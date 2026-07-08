import type { createAdminClient } from '@/lib/supabase/server';

type AdminClient = ReturnType<typeof createAdminClient>;

export interface RoomTypeRow {
    id: string;
    property_id: string;
    name: string;
    description: string | null;
    price_per_night: number;
    max_guests: number | null;
    images: string[] | null;
    sort_order: number | null;
    is_active: boolean | null;
}

export interface UnitRow {
    id: string;
    room_type_id: string | null;
    unit_code: string | null;
    name: string;
    is_active: boolean | null;
}

// A cell is blocked if booked/cleaning/maintenance, or held with an
// unexpired hold. Mirrors the rule used across the public site.
export function isBlockedSlot(
    slot: { status: string; booking?: { expires_at: string | null } | null },
    now: Date
): boolean {
    if (slot.status === 'booked' || slot.status === 'cleaning' || slot.status === 'maintenance') {
        return true;
    }
    if (slot.status === 'held') {
        const expiresAt = slot.booking?.expires_at ? new Date(slot.booking.expires_at) : null;
        if (!expiresAt || expiresAt >= now) return true;
    }
    return false;
}

// Pooled availability for every room type of a property over [from, to).
// A date is available for a type while >= 1 of its units is free.
export async function getRoomTypeAvailability(
    supabase: AdminClient,
    propertyId: string,
    dates: string[]
): Promise<{
    roomTypes: RoomTypeRow[];
    units: UnitRow[];
    // per type: dates with zero free units (what the public calendar blocks)
    fullDatesByType: Record<string, string[]>;
    // per type per date: number of free units (CRM occupancy)
    freeCountByTypeDate: Record<string, Record<string, number>>;
}> {
    const { data: typeRows } = await supabase
        .from('room_types')
        .select('*')
        .eq('property_id', propertyId)
        .eq('is_active', true)
        .order('sort_order');

    const roomTypes = (typeRows || []) as RoomTypeRow[];
    if (roomTypes.length === 0) {
        return { roomTypes: [], units: [], fullDatesByType: {}, freeCountByTypeDate: {} };
    }

    const typeIds = roomTypes.map(t => t.id);
    const { data: unitRows } = await supabase
        .from('rooms')
        .select('id, room_type_id, unit_code, name, is_active')
        .in('room_type_id', typeIds)
        .eq('is_active', true);

    const units = (unitRows || []) as UnitRow[];
    const unitIds = units.map(u => u.id);
    const unitsByType = new Map<string, UnitRow[]>();
    for (const u of units) {
        if (!u.room_type_id) continue;
        if (!unitsByType.has(u.room_type_id)) unitsByType.set(u.room_type_id, []);
        unitsByType.get(u.room_type_id)!.push(u);
    }

    const blockedByUnit = new Map<string, Set<string>>();
    if (unitIds.length > 0 && dates.length > 0) {
        const { data: slots } = await supabase
            .from('availability')
            .select('room_id, date, status, booking:bookings(expires_at)')
            .in('room_id', unitIds)
            .in('date', dates);

        const now = new Date();
        for (const slot of (slots || []) as unknown as Array<{
            room_id: string; date: string; status: string;
            booking?: { expires_at: string | null } | null;
        }>) {
            if (isBlockedSlot(slot, now)) {
                if (!blockedByUnit.has(slot.room_id)) blockedByUnit.set(slot.room_id, new Set());
                blockedByUnit.get(slot.room_id)!.add(slot.date);
            }
        }
    }

    const fullDatesByType: Record<string, string[]> = {};
    const freeCountByTypeDate: Record<string, Record<string, number>> = {};

    for (const type of roomTypes) {
        const typeUnits = unitsByType.get(type.id) || [];
        const counts: Record<string, number> = {};
        const full: string[] = [];
        for (const date of dates) {
            const free = typeUnits.filter(u => !blockedByUnit.get(u.id)?.has(date)).length;
            counts[date] = free;
            if (free === 0) full.push(date);
        }
        freeCountByTypeDate[type.id] = counts;
        fullDatesByType[type.id] = full;
    }

    return { roomTypes, units, fullDatesByType, freeCountByTypeDate };
}

// Units of a type that are free for EVERY date in the stay, in a stable
// order (unit_code) so assignment fills A1 before A2. The booking route
// walks this list and lets reserveAndVerify settle races per unit.
export async function findFreeUnits(
    supabase: AdminClient,
    roomTypeId: string,
    dates: string[]
): Promise<UnitRow[]> {
    const { data: unitRows } = await supabase
        .from('rooms')
        .select('id, room_type_id, unit_code, name, is_active')
        .eq('room_type_id', roomTypeId)
        .eq('is_active', true)
        .order('unit_code');

    const units = (unitRows || []) as UnitRow[];
    if (units.length === 0) return [];

    const { data: slots } = await supabase
        .from('availability')
        .select('room_id, date, status, booking:bookings(expires_at)')
        .in('room_id', units.map(u => u.id))
        .in('date', dates);

    const now = new Date();
    const blocked = new Set<string>();
    for (const slot of (slots || []) as unknown as Array<{
        room_id: string; date: string; status: string;
        booking?: { expires_at: string | null } | null;
    }>) {
        if (isBlockedSlot(slot, now)) blocked.add(slot.room_id);
    }

    return units.filter(u => !blocked.has(u.id));
}

// Nightly total for a stay: date-range price overrides win over the
// type's base rate, per night.
export async function priceRoomTypeStay(
    supabase: AdminClient,
    roomType: { id: string; price_per_night: number },
    dates: string[]
): Promise<{ total: number; perNight: number }> {
    const { data: overrides } = await supabase
        .from('price_overrides')
        .select('start_date, end_date, price_per_night')
        .eq('room_type_id', roomType.id);

    let total = 0;
    for (const date of dates) {
        const override = (overrides || []).find(
            o => date >= o.start_date && date <= o.end_date
        );
        total += Number(override ? override.price_per_night : roomType.price_per_night);
    }
    const perNight = dates.length > 0 ? Math.round(total / dates.length) : Number(roomType.price_per_night);
    return { total, perNight };
}
