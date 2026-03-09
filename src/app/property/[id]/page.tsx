import { createServerClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import PropertyDetailClient from './PropertyDetailClient';

interface Props {
    params: Promise<{ id: string }>;
}

export default async function PropertyPage({ params }: Props) {
    const { id } = await params;
    const supabase = await createServerClient();

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

    // Fetch site settings (contact numbers)
    const { data: settingsData } = await supabase
        .from('site_settings')
        .select('key, value')
        .in('key', ['contact_phone', 'contact_whatsapp']);

    const settings: Record<string, string> = {};
    for (const row of settingsData || []) {
        settings[row.key] = row.value as string;
    }

    return (
        <>
            <Header />
            <main className="pt-20 page-enter">
                <PropertyDetailClient
                    property={property}
                    rooms={rooms || []}
                    availability={availability || []}
                    contactPhone={settings.contact_phone || ''}
                    contactWhatsapp={settings.contact_whatsapp || ''}
                />
            </main>
        </>
    );
}
