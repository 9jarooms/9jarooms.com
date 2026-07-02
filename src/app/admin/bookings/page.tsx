import { createAdminClient } from '@/lib/supabase/server';
import BookingsCRM from './BookingsCRM';
import type { CrmBooking, CrmProperty, CrmSource } from './types';

export const dynamic = 'force-dynamic';

// Standalone MANUAL bookings CRM — deliberately NOT linked to the website's
// `bookings`/`properties`. Staff log everything by hand here. Website sync
// comes later.
export default async function AdminBookingsPage() {
    const supabase = createAdminClient();

    const [{ data: bookings }, { data: properties }, { data: sources }] = await Promise.all([
        supabase.from('crm_bookings').select('*').order('check_in', { ascending: false }),
        supabase.from('crm_properties').select('*').order('sort_order').order('name'),
        supabase.from('crm_booking_sources').select('*').order('sort_order').order('label'),
    ]);

    return (
        <BookingsCRM
            initialBookings={(bookings as CrmBooking[]) || []}
            properties={(properties as CrmProperty[]) || []}
            sources={(sources as CrmSource[]) || []}
        />
    );
}
