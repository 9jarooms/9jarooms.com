import { createAuthClient } from '@/lib/supabase/auth';
import { createClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { Building2 } from 'lucide-react';

function getServiceSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

export default async function OwnerPropertiesPage() {
    const authClient = await createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) redirect('/login');

    const supabase = getServiceSupabase();

    const { data: owner } = await supabase
        .from('owners')
        .select('id')
        .eq('user_id', user.id)
        .single();

    if (!owner) return <div className="text-center py-20 text-gray-400">Owner profile not found</div>;

    const { data: properties } = await supabase
        .from('properties')
        .select('*, rooms(id, name, price_per_night, max_guests), caretaker:caretakers(name, phone)')
        .eq('owner_id', owner.id)
        .order('created_at', { ascending: false });

    const formatPrice = (n: number) => new Intl.NumberFormat('en-NG').format(n);

    return (
        <div className="page-enter">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">My Properties</h1>
                <p className="text-gray-500 mt-1">{properties?.length || 0} properties in your portfolio</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {properties?.map((prop: any) => (
                    <div key={prop.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                        <div className="p-5">
                            <div className="flex items-start gap-4 mb-4">
                                <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 shrink-0">
                                    <Building2 size={24} />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 text-lg">{prop.name}</h3>
                                    <p className="text-sm text-gray-500">{prop.address}</p>
                                    <p className="text-sm text-gray-400">{prop.area}, {prop.city}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="bg-gray-50 rounded-lg p-3">
                                    <p className="text-xs text-gray-500">Price/Night</p>
                                    <p className="font-semibold text-gray-900">₦{formatPrice(prop.price_per_night)}</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3">
                                    <p className="text-xs text-gray-500">Max Guests</p>
                                    <p className="font-semibold text-gray-900">{prop.max_guests}</p>
                                </div>
                            </div>

                            {/* Rooms */}
                            <div className="mb-4">
                                <p className="text-xs font-medium text-gray-500 mb-2">ROOMS ({prop.rooms?.length || 0})</p>
                                <div className="space-y-1">
                                    {prop.rooms?.map((room: any) => (
                                        <div key={room.id} className="flex justify-between text-sm py-1">
                                            <span className="text-gray-700">{room.name}</span>
                                            <span className="text-gray-500">₦{formatPrice(room.price_per_night)} · {room.max_guests} guests</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Caretaker */}
                            {prop.caretaker && (
                                <div className="bg-emerald-50 rounded-lg p-3">
                                    <p className="text-xs text-emerald-600 font-medium">Caretaker</p>
                                    <p className="text-sm text-gray-900">{prop.caretaker.name}</p>
                                    {prop.caretaker.phone && <p className="text-xs text-gray-500">{prop.caretaker.phone}</p>}
                                </div>
                            )}

                            {/* Amenities */}
                            {prop.amenities?.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    {prop.amenities.map((a: string) => (
                                        <span key={a} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{a}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {(!properties || properties.length === 0) && (
                    <div className="col-span-full text-center py-12 text-gray-400">No properties assigned to your account yet</div>
                )}
            </div>
        </div>
    );
}
