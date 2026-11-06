import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePropertyAccess } from '@/lib/auth/require-property-access';

const text = (max: number) => z.string().max(max).nullable().optional();
const settingsSchema = z.object({
    check_in_instructions: text(3000), house_rules: text(3000), name: z.string().trim().min(3).max(120).optional(), description: text(5000),
    area: text(80), city: text(80), amenities: z.array(z.string().max(80)).max(60).optional(),
    images: z.array(z.string().url().max(600)).max(40).optional(), thumbnail: z.string().url().max(600).nullable().optional(),
    price_per_night: z.number().positive().optional(), max_guests: z.number().int().min(1).max(30).optional(),
});

interface Props {
    params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Props) {
    try {
        const { id } = await params;

        const access = await requirePropertyAccess(id);
        const { adminClient, error: authError, status } = access as any;
        if (authError || !adminClient) return NextResponse.json({ error: authError }, { status });

        const supabase = adminClient;

        const parsed = settingsSchema.safeParse(await request.json());
        if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        const body: any = parsed.data;
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
        // prices are changed on Rooms & prices (logged); here only by an admin
        if (price_per_night !== undefined && (access as any).isAdmin) updates.price_per_night = price_per_night;
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
