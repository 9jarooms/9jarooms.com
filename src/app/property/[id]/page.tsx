import { createServerClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
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

    if (!property) {
        // Retired listings are hidden from the public client by RLS —
        // check with the admin client whether this URL was merged into a
        // surviving property (old Kaura ad links keep working).
        const { createAdminClient } = await import('@/lib/supabase/server');
        const { data: retired } = await createAdminClient()
            .from('properties')
            .select('merged_into')
            .eq('id', id)
            .maybeSingle();
        if (retired?.merged_into) redirect(`/property/${retired.merged_into}`);
        notFound();
    }

    // Consolidated listings keep their URLs working
    if (property.merged_into) redirect(`/property/${property.merged_into}`);
    if (property.is_deleted) notFound();

    // Strip address before passing to client — address is only sent privately via email/whatsapp
    const { address: _addr, ...safeProperty } = property;

    let { data: rooms } = await supabase
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
    let availability = (rawAvailability || []).filter((slot: any) => {
        if (slot.status === 'held' && slot.booking?.expires_at) {
            const expiresAt = new Date(slot.booking.expires_at);
            if (expiresAt < now) {
                return false; // Ignore this expired hold
            }
        }
        return true; // Keep active holds and 'booked' slots
    });

    // POOLED ROOM TYPES: when the property sells room types (e.g. Kaura's 3
    // types x 8 units), the guest sees one card per type. A date only blocks
    // when EVERY unit of that type is taken — so the listing stays available
    // until the 8th unit is booked. The booking API assigns a real unit.
    const { data: roomTypes } = await supabase
        .from('room_types')
        .select('*')
        .eq('property_id', id)
        .eq('is_active', true)
        .order('sort_order');

    if (roomTypes && roomTypes.length > 0 && rooms && rooms.length > 0) {
        const unitsByType = new Map<string, string[]>();
        for (const r of rooms as any[]) {
            if (!r.room_type_id) continue;
            unitsByType.set(r.room_type_id, [...(unitsByType.get(r.room_type_id) || []), r.id]);
        }

        const blockedByUnitDate = new Set(
            (availability as any[])
                .filter((slot) => slot.status !== 'available')
                .map((slot) => `${slot.room_id}|${slot.date}`)
        );
        const allDates = [...new Set((availability as any[]).map((slot) => slot.date))];

        const pooledAvailability: any[] = [];
        for (const type of roomTypes) {
            const unitIds = unitsByType.get(type.id) || [];
            if (unitIds.length === 0) continue;
            for (const date of allDates) {
                const fullyBooked = unitIds.every((u) => blockedByUnitDate.has(`${u}|${date}`));
                if (fullyBooked) {
                    pooledAvailability.push({ room_id: type.id, date, status: 'booked', booking_id: null });
                }
            }
        }

        // The type IS the room, as far as the guest UI is concerned.
        rooms = roomTypes.map((t: any) => ({
            id: t.id,
            property_id: id,
            name: t.name,
            description: t.description,
            price_per_night: t.price_per_night,
            max_guests: t.max_guests,
            images: (t.images && t.images.length > 0) ? t.images : property.images,
            videos: [],
            is_active: true,
            room_type: null,
            created_at: t.created_at,
            updated_at: t.updated_at,
        })) as typeof rooms;
        availability = pooledAvailability;
    }

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
