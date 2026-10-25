import { NextResponse } from 'next/server';
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
