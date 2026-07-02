import { createAdminClient } from '@/lib/supabase/server';
import BookingsConsole from './BookingsConsole';
import type { ConsoleBooking, ConsoleSource } from './types';

export const dynamic = 'force-dynamic';

export default async function AdminBookingsPage() {
    const supabase = createAdminClient();

    const [{ data: bookings }, { data: sources }] = await Promise.all([
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
    ]);

    return (
        <BookingsConsole
            bookings={(bookings as ConsoleBooking[]) || []}
            sources={(sources as ConsoleSource[]) || []}
        />
    );
}
