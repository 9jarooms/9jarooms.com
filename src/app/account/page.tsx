'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Home, Calendar, Clock, LogOut, CheckCircle2 } from 'lucide-react';

interface Booking {
    id: string;
    check_in: string;
    check_out: string;
    nights: number;
    total_amount: number;
    status: string;
    created_at: string;
    property: {
        name: string;
        city: string;
        area: string;
        thumbnail: string | null;
    };
    room: {
        name: string;
    };
}

export default function CustomerAccountPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkUserAndFetchData();
    }, []);

    const checkUserAndFetchData = async () => {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            router.push('/login');
            return;
        }

        setUser(session.user);

        // Fetch bookings
        try {
            const res = await fetch('/api/user/bookings');
            if (res.ok) {
                const data = await res.json();
                setBookings(data.data || []);
            }
        } catch (error) {
            console.error('Failed to load bookings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSignOut = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/login');
    };

    const formatPrice = (amount: number) => {
        return new Intl.NumberFormat('en-NG').format(amount);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    const upcomingBookings = bookings.filter(b => new Date(b.check_in) >= new Date() && b.status !== 'cancelled');
    const pastBookings = bookings.filter(b => new Date(b.check_in) < new Date() || b.status === 'cancelled');

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <a href="/" className="block">
                        <img src="/icon.png" alt="9jaRooms" className="h-[4.5rem] w-auto object-contain" />
                    </a>
                    <button 
                        onClick={handleSignOut}
                        className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-red-600 transition-colors"
                    >
                        <LogOut size={16} /> Sign Out
                    </button>
                </div>
            </header>

            <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-32 pb-20">
                <div className="mb-10">
                    <h1 className="text-3xl font-bold text-gray-900">
                        Welcome, {user?.user_metadata?.first_name || user?.user_metadata?.name?.split(' ')[0] || 'Guest'}
                    </h1>
                    <p className="text-gray-500 mt-2">Manage your bookings and profile settings here.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Sidebar / Profile Summary */}
                    <div className="md:col-span-1">
                        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm sticky top-32">
                            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold mb-4">
                                {user?.user_metadata?.first_name?.charAt(0) || user?.user_metadata?.name?.charAt(0) || user?.email?.charAt(0) || 'G'}
                            </div>
                            <h2 className="text-lg font-bold text-gray-900">{user?.user_metadata?.name || 'Customer'}</h2>
                            <p className="text-sm text-gray-500 mb-6">{user?.email}</p>

                            <div className="space-y-1">
                                <a href="#bookings" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 text-gray-900 font-medium">
                                    <Calendar size={18} className="text-blue-500" /> My Bookings
                                </a>
                                {/* Placeholder for Wishlist / future features */}
                                <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 text-gray-500 hover:text-gray-900 font-medium transition-colors">
                                    <Home size={18} /> Wishlists (Coming Soon)
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Bookings List */}
                    <div className="md:col-span-2 space-y-10" id="bookings">
                        
                        <section>
                            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                                <Clock size={20} className="text-blue-500" /> Upcoming Stays
                            </h3>
                            
                            {upcomingBookings.length === 0 ? (
                                <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                                    <Calendar size={48} className="mx-auto text-gray-200 mb-4" />
                                    <h4 className="text-lg font-medium text-gray-900 mb-2">No upcoming trips</h4>
                                    <p className="text-gray-500 mb-6 text-sm">Time to dust off your bags and start planning your next adventure.</p>
                                    <a href="/" className="inline-block bg-gray-900 text-white font-medium px-6 py-3 rounded-xl hover:bg-black transition-colors">
                                        Explore Stays
                                    </a>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {upcomingBookings.map((booking) => (
                                        <BookingCard key={booking.id} booking={booking} formatPrice={formatPrice} formatDate={formatDate} isUpcoming />
                                    ))}
                                </div>
                            )}
                        </section>

                        <section>
                            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                                <CheckCircle2 size={20} className="text-gray-400" /> Past Stays
                            </h3>
                            
                            {pastBookings.length === 0 ? (
                                <p className="text-gray-500 text-sm">You have no past bookings yet.</p>
                            ) : (
                                <div className="space-y-4">
                                    {pastBookings.map((booking) => (
                                        <BookingCard key={booking.id} booking={booking} formatPrice={formatPrice} formatDate={formatDate} />
                                    ))}
                                </div>
                            )}
                        </section>

                    </div>
                </div>
            </main>
        </div>
    );
}

function BookingCard({ booking, formatPrice, formatDate, isUpcoming = false }: { booking: Booking, formatPrice: (v: number) => string, formatDate: (v: string) => string, isUpcoming?: boolean }) {
    return (
        <div className={`bg-white rounded-2xl border flex flex-col sm:flex-row overflow-hidden group ${isUpcoming ? 'border-blue-100 shadow-md shadow-blue-50/50' : 'border-gray-100'}`}>
            <div className="w-full sm:w-48 h-48 sm:h-auto bg-gray-100 shrink-0 relative">
                {booking.property?.thumbnail ? (
                    <img src={booking.property.thumbnail} alt={booking.property.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Home size={32} className="text-gray-300" />
                    </div>
                )}
                {booking.status === 'confirmed' && isUpcoming && (
                     <div className="absolute top-3 left-3 bg-white/90 backdrop-blur px-2.5 py-1 rounded-full text-xs font-bold text-green-700 shadow-sm flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                        Confirmed
                     </div>
                )}
            </div>
            <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between">
                <div>
                    <div className="flex items-start justify-between gap-4 mb-2">
                        <h4 className="font-bold text-gray-900 text-lg group-hover:text-blue-600 transition-colors">{booking.property?.name || 'Property'}</h4>
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                            booking.status === 'confirmed' ? 'bg-green-50 text-green-700 border-green-200' :
                            booking.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                            'bg-gray-50 text-gray-700 border-gray-200 uppercase tracking-wide text-[10px]'
                        }`}>
                            {booking.status}
                        </span>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">{booking.property?.area || 'Area'}, {booking.property?.city || 'City'}</p>
                    
                    <div className="flex items-center gap-6 text-sm mb-4">
                        <div>
                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-0.5">Check in</p>
                            <p className="font-medium text-gray-900">{formatDate(booking.check_in)}</p>
                        </div>
                        <div className="w-px h-8 bg-gray-200"></div>
                        <div>
                            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-0.5">Check out</p>
                            <p className="font-medium text-gray-900">{formatDate(booking.check_out)}</p>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-end justify-between pt-4 border-t border-gray-100">
                    <div>
                        <p className="text-xs text-gray-500 mb-0.5">{booking.nights} night{booking.nights > 1 ? 's' : ''} • {booking.room?.name}</p>
                        <p className="font-bold text-gray-900">₦{formatPrice(booking.total_amount)}</p>
                    </div>
                    {isUpcoming && booking.status !== 'cancelled' && (
                        <button className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline">
                            View Details
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
