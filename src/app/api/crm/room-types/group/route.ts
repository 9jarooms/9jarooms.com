import { NextRequest, NextResponse } from 'next/server';
import { requireCrm } from '@/lib/auth/require-crm';
import { z } from 'zod';

// Group units into one room type ("group"): the units share one name, one price and one set of photos,
// and the website sells them as a single listing (a guest books the group, the app picks a free unit).
// Target is an existing group of the same property, or a new one. A group left with no units is removed
// (or hidden, when old bookings still point at it).
const schema = z.object({
    propertyId: z.string().uuid(),
    unitIds: z.array(z.string().uuid()).min(1).max(100),
    roomTypeId: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(80).optional(),
    pricePerNight: z.number().positive().optional(),
}).refine(b => b.roomTypeId || (b.name && b.pricePerNight), { message: 'Pick a group, or give the new group a name and price' });

export async function POST(request: NextRequest) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.adminClient!;

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
    const body = parsed.data;

    const { data: units } = await supabase
        .from('rooms').select('id, property_id, room_type_id').in('id', body.unitIds);
    if (!units || units.length !== body.unitIds.length || units.some(u => u.property_id !== body.propertyId)) {
        return NextResponse.json({ error: 'Those rooms are not all in this property' }, { status: 400 });
    }

    let typeId = body.roomTypeId;
    let price: number;
    if (typeId) {
        const { data: t } = await supabase.from('room_types').select('id, property_id, price_per_night').eq('id', typeId).single();
        if (!t || t.property_id !== body.propertyId) return NextResponse.json({ error: 'Group not found in this property' }, { status: 404 });
        price = Number(t.price_per_night);
    } else {
        const { data: last } = await supabase.from('room_types').select('sort_order')
            .eq('property_id', body.propertyId).order('sort_order', { ascending: false }).limit(1);
        const { data: t, error } = await supabase.from('room_types').insert({
            property_id: body.propertyId, name: body.name, price_per_night: body.pricePerNight,
            sort_order: ((last?.[0]?.sort_order) || 0) + 1, images: [], is_active: true,
        }).select('id').single();
        if (error || !t) return NextResponse.json({ error: error?.message || 'Could not create the group' }, { status: 500 });
        typeId = t.id; price = body.pricePerNight!;
    }

    const { error: moveErr } = await supabase.from('rooms')
        .update({ room_type_id: typeId, price_per_night: price }).in('id', body.unitIds);
    if (moveErr) return NextResponse.json({ error: moveErr.message }, { status: 500 });

    // tidy groups that were emptied by this move
    const old = [...new Set(units.map(u => u.room_type_id).filter((x): x is string => !!x && x !== typeId))];
    for (const id of old) {
        const { count: left } = await supabase.from('rooms').select('id', { count: 'exact', head: true }).eq('room_type_id', id);
        if (left) continue;
        const { count: used } = await supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('room_type_id', id);
        if (used) await supabase.from('room_types').update({ is_active: false }).eq('id', id);
        else await supabase.from('room_types').delete().eq('id', id);
    }

    return NextResponse.json({ success: true, roomTypeId: typeId });
}
