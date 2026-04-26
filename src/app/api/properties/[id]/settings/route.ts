import { NextRequest, NextResponse } from 'next/server';
import { requirePropertyAccess } from '@/lib/auth/require-property-access';

interface Props {
    params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Props) {
    try {
        const { id } = await params;

        const { adminClient, error: authError, status } = await requirePropertyAccess(id);
        if (authError || !adminClient) return NextResponse.json({ error: authError }, { status });

        const supabase = adminClient;

        const body = await request.json();
        const {
            check_in_instructions, house_rules,
            name, description, area, city, amenities,
            images, thumbnail, price_per_night, max_guests,
        } = body;

        const updates: Record<string, any> = {};
        if (check_in_instructions !== undefined) updates.check_in_instructions = check_in_instructions;
        if (house_rules !== undefined) updates.house_rules = house_rules;
        if (name !== undefined) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (area !== undefined) updates.area = area;
        if (city !== undefined) updates.city = city;
        if (amenities !== undefined) updates.amenities = amenities;
        if (images !== undefined) updates.images = images;
        if (thumbnail !== undefined) updates.thumbnail = thumbnail;
        if (price_per_night !== undefined) updates.price_per_night = price_per_night;
        if (max_guests !== undefined) updates.max_guests = max_guests;

        const { error } = await supabase
            .from('properties')
            .update(updates)
            .eq('id', id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Property settings update error:', error);
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }
}
