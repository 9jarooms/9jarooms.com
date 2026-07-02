export type CrmSource = {
    id: string;
    label: string;
    color: string | null;
    is_active: boolean;
    sort_order: number;
};

export type CrmProperty = {
    id: string;
    name: string;
    total_rooms: number;
    is_active: boolean;
    sort_order: number;
};

export type CrmBooking = {
    id: string;
    guest_name: string;
    guest_email: string | null;
    guest_phone: string | null;
    property_id: string | null;
    rooms_booked: number;
    check_in: string;
    check_out: string;
    amount_paid: number;
    source_id: string | null;
    status: 'confirmed' | 'cancelled';
    notes: string | null;
    created_at: string;
};

// Room count → human label, per the owner's convention:
// 1 = single room, 2 = 2-bedroom, 3 = 3-bedroom, otherwise "N rooms".
export function roomLabel(rooms: number): string {
    if (rooms === 1) return 'Single room';
    if (rooms === 2) return '2-bedroom';
    if (rooms === 3) return '3-bedroom';
    return `${rooms} rooms`;
}

export const ROOM_PRESETS = [
    { rooms: 1, label: 'Single room' },
    { rooms: 2, label: '2-bedroom' },
    { rooms: 3, label: '3-bedroom' },
];

export const naira = (n: number) => `₦${new Intl.NumberFormat('en-NG').format(Math.round(n))}`;

export function nights(checkIn: string, checkOut: string): number {
    const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    return Math.max(0, Math.round(ms / 86_400_000));
}

// Derive where a confirmed booking sits relative to a given day (default today).
export type StayState = 'upcoming' | 'staying' | 'past';
export function stayState(b: CrmBooking, todayISO: string): StayState {
    if (b.check_in > todayISO) return 'upcoming';
    if (b.check_out <= todayISO) return 'past';
    return 'staying'; // check_in <= today < check_out
}

export function todayISO(): string {
    return new Date().toISOString().slice(0, 10);
}

// ============================================
// Real `bookings` table (Staff Bookings Console)
// ============================================

export type ConsoleSource = {
    id: string;
    label: string;
    color: string | null;
    is_active: boolean;
    sort_order: number;
};

export type BookingMode = 'single' | 'two_bed' | 'whole';

export type ConsoleBooking = {
    id: string;
    property_id: string;
    room_id: string;
    booking_mode: BookingMode;
    guest_name: string;
    guest_email: string | null;
    guest_phone: string | null;
    check_in: string;
    check_out: string;
    nights: number;
    price_per_night: number;
    total_amount: number;
    status: 'pending' | 'paid' | 'cancelled' | 'completed' | 'expired' | 'confirmed';
    booking_source: string | null;
    notes: string | null;
    created_at: string;
    property: { name: string; area: string | null; is_apartment: boolean } | null;
    room: { name: string } | null;
    booking_rooms: { room_id: string; is_locked: boolean }[] | null;
};

export const MODE_LABEL: Record<BookingMode, string> = {
    single: 'Single',
    two_bed: '2-Bed',
    whole: 'Whole',
};

// Statuses that count toward revenue / active stays.
export const REVENUE_STATUSES = ['paid', 'confirmed', 'completed'] as const;
