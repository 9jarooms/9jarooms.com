import { createAdminClient } from '@/lib/supabase/server';
import BookingsConsole from './BookingsConsole';
import type { ConsoleBooking, ConsoleSource } from './types';
import type { ConsoleProperty } from './LogBookingModal';

export const dynamic = 'force-dynamic';

export default async function AdminBookingsPage() {
    const supabase = createAdminClient();

    const [{ data: bookings }, { data: sources }, { data: properties }] = await Promise.all([
        supabase
            .from('bookings')
            .select(
                '*, property:properties(name, area, is_apartment), room:rooms(name), booking_rooms(room_id, is_locked)'
            )
            .order('check_in', { ascending: false }),
        supabase
            .from('crm_booking_sources')
            .select('*')
            .order('sort_order')
            .order('label'),
        supabase
            .from('properties')
            .select('id, name, is_apartment, whole_apartment_price, two_bed_price')
            .order('name'),
    ]);

    return (
        <BookingsConsole
            bookings={(bookings as ConsoleBooking[]) || []}
            sources={(sources as ConsoleSource[]) || []}
            properties={(properties as ConsoleProperty[]) || []}
        />
    );
}
