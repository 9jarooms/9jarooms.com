import { createAuthClient } from '@/lib/supabase/auth';
import { notFound } from 'next/navigation';
import PropertyManageClient from './PropertyManageClient';

interface Props {
    params: Promise<{ id: string }>;
}

export default async function PropertyManagePage({ params }: Props) {
    const { id } = await params;
    const supabase = await createAuthClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: property } = await supabase
        .from('properties')
        .select('*')
        .eq('id', id)
        .eq('caretaker_id', user.id)
        .single();

    if (!property) notFound();

    const { data: rooms } = await supabase
        .from('rooms')
        .select('*')
        .eq('property_id', id);

    const roomIds = rooms?.map((r) => r.id) || [];

    const { data: availability } = await supabase
        .from('availability')
        .select('*')
        .in('room_id', roomIds);

    const { data: bookings } = await supabase
        .from('bookings')
        .select('*, room:rooms(name)')
        .eq('property_id', id)
        .eq('status', 'paid')
        .order('check_in', { ascending: true });

    return (
        <PropertyManageClient
            property={property}
            rooms={rooms || []}
            availability={availability || []}
            bookings={bookings || []}
        />
    );
}
