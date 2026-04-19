import { MetadataRoute } from 'next';
import { createServerClient } from '@/lib/supabase/server';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const supabase = await createServerClient();

    const { data: properties } = await supabase
        .from('properties')
        .select('id, updated_at')
        .eq('is_active', true);

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://9jarooms.com';

    const propertyUrls: MetadataRoute.Sitemap = (properties || []).map((p) => ({
        url: `${baseUrl}/property/${p.id}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
    }));

    return [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1,
        },
        {
            url: `${baseUrl}/properties`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.9,
        },
        ...propertyUrls,
    ];
}
