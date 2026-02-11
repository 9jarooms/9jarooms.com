import { createAuthClient } from '@/lib/supabase/auth';
import Link from 'next/link';
import { Building2, MapPin, Users, ChevronRight } from 'lucide-react';

export default async function PropertiesPage() {
    const supabase = await createAuthClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: properties } = await supabase
        .from('properties')
        .select('*, rooms(id, name, price_per_night)')
        .eq('caretaker_id', user.id)
        .order('created_at', { ascending: false });

    const formatPrice = (price: number) =>
        new Intl.NumberFormat('en-NG').format(price);

    return (
        <>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Properties</h1>
                <p className="text-gray-500 text-sm mt-1">Manage your assigned properties</p>
            </div>

            {properties && properties.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {properties.map((property) => (
                        <Link
                            key={property.id}
                            href={`/dashboard/properties/${property.id}`}
                            className="group bg-white rounded-2xl border border-gray-100 p-5 hover:border-green-200 hover:shadow-sm transition-all"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3">
                                    <div className="w-11 h-11 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
                                        <Building2 size={20} className="text-green-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 group-hover:text-green-600 transition-colors">
                                            {property.name}
                                        </h3>
                                        <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
                                            <MapPin size={14} />
                                            {property.area}, {property.city}
                                        </div>
                                    </div>
                                </div>
                                <ChevronRight size={18} className="text-gray-300 group-hover:text-green-400 transition-colors mt-1" />
                            </div>

                            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-50">
                                <span className="text-sm text-gray-500">
                                    <span className="font-medium text-gray-900">₦{formatPrice(property.price_per_night)}</span> / night
                                </span>
                                <span className="text-sm text-gray-500 flex items-center gap-1">
                                    <Users size={14} />
                                    {property.max_guests} guests
                                </span>
                                <span className="text-sm text-gray-500">
                                    {(property as any).rooms?.length || 0} rooms
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
                    <Building2 size={32} className="text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No properties assigned to you yet</p>
                </div>
            )}
        </>
    );
}
