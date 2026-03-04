import { createServerClient } from '@/lib/supabase/server';
import OperatorDashboardClient from './OperatorDashboardClient';

export default async function OperatorPage() {
    const supabase = createServerClient();

    // Fetch properties and rooms
    const { data: properties } = await supabase
        .from('properties')
        .select('*, rooms(*)')
        .eq('is_active', true)
        .order('name');

    // Fetch availability
    const { data: availability } = await supabase
        .from('availability')
        .select('*')
        .gte('date', new Date().toISOString().split('T')[0]);

    return (
        <div className="page-enter">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Call Operator Dashboard</h1>
                <p className="text-gray-500 mt-1">Search properties, check availability, and generate payment links for customers.</p>
            </div>

            <OperatorDashboardClient
                properties={properties || []}
                availability={availability || []}
            />
        </div>
    );
}
