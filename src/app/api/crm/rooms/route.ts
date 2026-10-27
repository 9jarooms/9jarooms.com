import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrm } from '@/lib/auth/require-crm';
import { operatedInventory } from '@/lib/booking/occupancy';

// Every property staff operate, with its units and groups (room types), for the "Rooms & prices" screen.
export async function GET() {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.adminClient!;
    const inv = await operatedInventory(supabase);
    const props = inv.properties, units = inv.units, types = inv.types;
    const full = props.map(p => ({ id: p.id, images: p.images }));
    const natural = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
    return NextResponse.json({
        properties: props.map(p => ({
            id: p.id, name: p.name, area: p.area, live: !!p.is_active,
            wholePrice: p.whole_apartment_price != null ? Number(p.whole_apartment_price) : null,
            twoBedPrice: p.two_bed_price != null ? Number(p.two_bed_price) : null,
            photos: (full.find(f => f.id === p.id)?.images || []).length,
            units: units.filter(u => u.property_id === p.id)
                .map(u => ({ id: u.id, code: u.unit_code || u.name, typeId: u.room_type_id, price: u.price_per_night != null ? Number(u.price_per_night) : null }))
                .sort((a, b) => natural(a.code, b.code)),
            groups: types.filter(t => t.property_id === p.id)
                .map(t => ({ id: t.id, name: t.name, price: Number(t.price_per_night), live: t.is_active !== false, images: t.images || [] })),
        })),
    });
}

// ------------------------------------------------------------------
// Add rooms to a property: one or more codes (e.g. "9A, 9B, 9C"), either into an existing group
// (they take its price) or each into its own new group at the given price. A code that was removed
// before is switched back on instead of duplicated.
// ------------------------------------------------------------------
const addSchema = z.object({
    propertyId: z.string().uuid(),
    codes: z.array(z.string().trim().min(1).max(30)).min(1).max(50),
    roomTypeId: z.string().uuid().optional(),
    pricePerNight: z.number().positive().optional(),
}).refine(b => b.roomTypeId || b.pricePerNight, { message: 'Pick a group, or give the price per night' });

export async function POST(request: NextRequest) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.adminClient!;
    const parsed = addSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
    const { propertyId, roomTypeId, pricePerNight } = parsed.data;
    const codes = [...new Set(parsed.data.codes.map(c => c.toUpperCase().replace(/\s+/g, ' ')))];

    const { data: prop } = await supabase.from('properties').select('id, max_guests').eq('id', propertyId).eq('is_deleted', false).single();
    if (!prop) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

    let price = pricePerNight ?? 0;
    if (roomTypeId) {
        const { data: t } = await supabase.from('room_types').select('property_id, price_per_night').eq('id', roomTypeId).single();
        if (!t || t.property_id !== propertyId) return NextResponse.json({ error: 'Group not found in this property' }, { status: 404 });
        price = Number(t.price_per_night);
    }

    const { data: existing } = await supabase.from('rooms').select('id, unit_code, is_active').eq('property_id', propertyId);
    const norm = (c: string | null) => (c || '').toUpperCase().replace(/\s+/g, ' ');
    const clash = codes.filter(c => (existing || []).some(r => r.is_active && norm(r.unit_code) === c));
    if (clash.length) return NextResponse.json({ error: `Already in this property: ${clash.join(', ')}` }, { status: 409 });

    const { data: last } = await supabase.from('room_types').select('sort_order').eq('property_id', propertyId).order('sort_order', { ascending: false }).limit(1);
    let order = (last?.[0]?.sort_order || 0);
    const added: string[] = [];
    for (const code of codes) {
        let typeId = roomTypeId;
        if (!typeId) {
            const { data: t, error } = await supabase.from('room_types').insert({
                property_id: propertyId, name: code, price_per_night: price, max_guests: prop.max_guests || 2,
                sort_order: ++order, images: [], is_active: true,
            }).select('id').single();
            if (error || !t) return NextResponse.json({ error: error?.message || 'Could not create the group' }, { status: 500 });
            typeId = t.id;
        }
        const old = (existing || []).find(r => !r.is_active && norm(r.unit_code) === code);
        const row = { room_type_id: typeId, price_per_night: price, is_active: true, unit_code: code, name: `Unit ${code}` };
        const { error } = old
            ? await supabase.from('rooms').update(row).eq('id', old.id)
            : await supabase.from('rooms').insert({ ...row, property_id: propertyId, max_guests: prop.max_guests || 2 });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        added.push(code);
    }
    return NextResponse.json({ success: true, added });
}

// ------------------------------------------------------------------
// Remove rooms: switched off (kept for history: past bookings, payments, the daily log), never erased.
// Refused for any room with a current or upcoming booking. Groups left empty are tidied away.
// ------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.adminClient!;
    const body = await request.json().catch(() => ({}));
    const ids = z.array(z.string().uuid()).min(1).max(100).safeParse(body.roomIds);
    if (!ids.success) return NextResponse.json({ error: 'Pick the rooms to remove' }, { status: 400 });

    const today = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);   // Lagos
    const { data: rooms } = await supabase.from('rooms').select('id, unit_code, name, room_type_id').in('id', ids.data);
    const { data: live } = await supabase.from('bookings').select('room_id, guest_name, check_out')
        .in('room_id', ids.data).in('status', ['pending', 'confirmed', 'paid', 'checked_in']).gte('check_out', today);
    // rooms locked inside a whole-flat booking count too
    const { data: cells } = await supabase.from('availability').select('room_id').in('room_id', ids.data).gte('date', today).not('booking_id', 'is', null);
    const busy = new Set([...(live || []).map(b => b.room_id), ...(cells || []).map(c => c.room_id)]);
    if (busy.size) {
        const names = (rooms || []).filter(r => busy.has(r.id)).map(r => r.unit_code || r.name);
        return NextResponse.json({ error: `These rooms have current or upcoming bookings, so they can't be removed yet: ${names.join(', ')}. Move or finish those bookings first.` }, { status: 409 });
    }

    // switched off and detached from its group (the group's photos/price stay with the remaining rooms)
    const { error } = await supabase.from('rooms').update({ is_active: false, room_type_id: null }).in('id', ids.data);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabase.from('availability').delete().in('room_id', ids.data).gte('date', today).is('booking_id', null);   // future cleaning/maintenance blocks

    for (const typeId of [...new Set((rooms || []).map(r => r.room_type_id).filter((x): x is string => !!x))]) {
        const { count: left } = await supabase.from('rooms').select('id', { count: 'exact', head: true }).eq('room_type_id', typeId).eq('is_active', true);
        if (left) continue;
        const { count: used } = await supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('room_type_id', typeId);
        if (used) await supabase.from('room_types').update({ is_active: false }).eq('id', typeId);   // old bookings point at it: hide
        else await supabase.from('room_types').delete().eq('id', typeId);
    }
    return NextResponse.json({ success: true, removed: (rooms || []).map(r => r.unit_code || r.name) });
}
