import { createAdminClient } from '@/lib/supabase/server';
import OperatorDashboardClient from './OperatorDashboardClient';

export default async function OperatorPage() {
    const supabase = createAdminClient();

    // Active properties for booking flow
    const { data: activeProperties } = await supabase
        .from('properties')
        .select('*, rooms(*)')
        .eq('is_active', true)
        .order('name');

    // All properties (active + draft) for the properties management tab
    const { data: allProperties } = await supabase
        .from('properties')
        .select('id,name,description,area,city,price_per_night,max_guests,amenities,images,thumbnail,is_active,check_in_instructions,house_rules')
        .neq('is_deleted', true)
        .order('name');

    const { data: availability } = await supabase
        .from('availability')
        .select('*')
        .gte('date', new Date().toISOString().split('T')[0]);

    const { data: pendingRequests } = await supabase
        .from('bookings')
        .select('*, property:properties(name), room:rooms(name)')
        .eq('status', 'pending')
        .in('booking_source', ['website', 'whatsapp', 'operator'])
        .order('created_at', { ascending: false });

    return (
        <div className="page-enter">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Operator Dashboard</h1>
                <p className="text-gray-500 mt-1">Manage bookings, availability, and properties.</p>
            </div>

            <OperatorDashboardClient
                properties={activeProperties || []}
                allProperties={allProperties || []}
                availability={availability || []}
                pendingRequests={pendingRequests || []}
            />
        </div>
    );
}
