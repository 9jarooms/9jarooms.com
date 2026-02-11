import { createServerClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PropertyDetailClient from './PropertyDetailClient';

interface Props {
    params: Promise<{ id: string }>;
}

export default async function PropertyPage({ params }: Props) {
    const { id } = await params;
    const supabase = createServerClient();

    // Fetch property with rooms and availability
    const { data: property } = await supabase
        .from('properties')
        .select('*, owner:owners(name, paystack_subaccount_code)')
        .eq('id', id)
        .single();

    if (!property) notFound();

    const { data: rooms } = await supabase
        .from('rooms')
        .select('*')
        .eq('property_id', id)
        .eq('is_active', true);

    // Get availability for all rooms (next 90 days)
    const roomIds = rooms?.map((r) => r.id) || [];
    const { data: availability } = await supabase
        .from('availability')
        .select('*')
        .in('room_id', roomIds)
        .gte('date', new Date().toISOString().split('T')[0]);

    return (
        <>
            <Header />
            <main className="pt-20 page-enter">
                <PropertyDetailClient
                    property={property}
                    rooms={rooms || []}
                    availability={availability || []}
                />
            </main>
            <Footer />
        </>
    );
}
