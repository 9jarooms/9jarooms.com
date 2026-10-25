import { NextResponse } from 'next/server';
import { requireCrm } from '@/lib/auth/require-crm';
import { operatedProperties } from '@/lib/booking/occupancy';

// Every property staff operate, with its units and groups (room types), for the "Rooms & prices" screen.
export async function GET() {
    const auth = await requireCrm();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = auth.adminClient!;
    const props = await operatedProperties(supabase);
    const ids = props.map(p => p.id);
    const [{ data: units }, { data: types }, { data: full }] = await Promise.all([
        ids.length ? supabase.from('rooms').select('id, property_id, unit_code, name, room_type_id, price_per_night').in('property_id', ids).eq('is_active', true) : Promise.resolve({ data: [] as any[] }),
        ids.length ? supabase.from('room_types').select('id, property_id, name, price_per_night, is_active, images, sort_order').in('property_id', ids).order('sort_order') : Promise.resolve({ data: [] as any[] }),
        ids.length ? supabase.from('properties').select('id, images').in('id', ids) : Promise.resolve({ data: [] as any[] }),
    ]);
    const natural = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
    return NextResponse.json({
        properties: props.map(p => ({
            id: p.id, name: p.name, area: p.area, live: !!p.is_active,
            photos: ((full || []).find(f => f.id === p.id)?.images || []).length,
            units: (units || []).filter(u => u.property_id === p.id)
                .map(u => ({ id: u.id, code: u.unit_code || u.name, typeId: u.room_type_id, price: u.price_per_night != null ? Number(u.price_per_night) : null }))
                .sort((a, b) => natural(a.code, b.code)),
            groups: (types || []).filter(t => t.property_id === p.id)
                .map(t => ({ id: t.id, name: t.name, price: Number(t.price_per_night), live: t.is_active !== false, images: t.images || [] })),
        })),
    });
}
