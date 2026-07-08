import { createAdminClient } from '@/lib/supabase/server';
import CalendarClient from './CalendarClient';

export const dynamic = 'force-dynamic';

export default async function CrmCalendarPage() {
    const supabase = createAdminClient();
    const { data: properties } = await supabase
        .from('properties')
        .select('id, name, area')
        .eq('is_deleted', false)
        .eq('is_active', true)
        .order('name');

    return <CalendarClient properties={properties || []} />;
}
