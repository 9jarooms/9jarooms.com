import { createServerClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Header from '@/components/Header';
import PropertyDetailClient from './PropertyDetailClient';

interface Props {
    params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const supabase = await createServerClient();

    const { data: p } = await supabase
        .from('properties')
        .select('name, description, area, city, price_per_night, thumbnail, images, type')
        .eq('id', id)
        .single();

    if (!p) return {};

    const title = `${p.name} in ${p.area}, ${p.city}`;
    const description = p.description
        ? p.description.slice(0, 160)
        : `Book ${p.name} — a ${p.type?.toLowerCase() || 'shortlet'} in ${p.area}, Abuja. From ₦${p.price_per_night?.toLocaleString()} per night.`;
    const image = p.thumbnail || p.images?.[0];

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            type: 'website',
            images: image ? [{ url: image, alt: p.name }] : [],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: image ? [image] : [],
        },
        alternates: {
            canonical: `/property/${id}`,
        },
    };
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

    // Strip address before passing to client — address is only sent privately via email/whatsapp
    const { address: _addr, ...safeProperty } = property;

    const { data: rooms } = await supabase
        .from('rooms')
        .select('*')
        .eq('property_id', id)
        .eq('is_active', true);

    // Get availability for all rooms (next 90 days), joining bookings to check expiration
    const roomIds = rooms?.map((r) => r.id) || [];
    const { data: rawAvailability } = await supabase
        .from('availability')
        .select('*, booking:bookings(expires_at)')
        .in('room_id', roomIds)
        .gte('date', new Date().toISOString().split('T')[0]);

    // Filter out expired holds dynamically so the UI treats them as available immediately
    const now = new Date();
    const availability = (rawAvailability || []).filter((slot: any) => {
        if (slot.status === 'held' && slot.booking?.expires_at) {
            const expiresAt = new Date(slot.booking.expires_at);
            if (expiresAt < now) {
                return false; // Ignore this expired hold
            }
        }
        return true; // Keep active holds and 'booked' slots
    });

    // Build the `${room_id}|${date}` set of unavailable cells for the apartment
    // booking engine, applying the SAME expired-hold filter used above.
    const unavailable: string[] = (availability as { room_id: string; date: string; status: string }[])
        .filter((slot) => slot.status !== 'available')
        .map((slot) => `${slot.room_id}|${slot.date}`);

    // Fetch similar properties (same area, exclude current)
    const { data: similarProperties } = await supabase
        .from('properties')
        .select('*, rooms(id, price_per_night, max_guests)')
        .eq('area', property.area)
        .eq('is_active', true)
        .neq('id', id)
        .limit(4);

    // Fetch site settings (contact numbers)
    const { data: settingsData } = await supabase
        .from('site_settings')
        .select('key, value')
        .in('key', ['contact_phone', 'contact_whatsapp']);

    const settings: Record<string, string> = {};
    for (const row of settingsData || []) {
        settings[row.key] = row.value as string;
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://9jarooms.com';

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "LodgingBusiness",
                        "name": property.name,
                        "description": property.description || `Shortlet in ${property.area}, Abuja`,
                        "image": property.thumbnail || property.images?.[0],
                        "url": `${baseUrl}/property/${property.id}`,
                        "address": {
                            "@type": "PostalAddress",
                            "addressLocality": property.area,
                            "addressRegion": "Abuja, FCT",
                            "addressCountry": "NG",
                        },
                        "priceRange": property.price_per_night
                            ? `From ₦${property.price_per_night.toLocaleString()} per night`
                            : undefined,
                    }),
                }}
            />
            <Header />
            <main className="pt-20 page-enter">
                <PropertyDetailClient
                    property={safeProperty as typeof property}
                    rooms={rooms || []}
                    availability={availability || []}
                    unavailable={unavailable}
                    isApartment={!!property.is_apartment}
                    wholeApartmentPrice={property.whole_apartment_price ?? null}
                    twoBedPrice={property.two_bed_price ?? null}
                    contactPhone={settings.contact_phone || '09067779344'}
                    contactWhatsapp={settings.contact_whatsapp || '09067779344'}
                    similarProperties={similarProperties || []}
                />
            </main>
        </>
    );
}
