'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Home, Calendar, Clock, LogOut, CheckCircle2, Settings, User, Mail, Lock, Shield, Phone, MapPin } from 'lucide-react';
import Link from 'next/link';

interface Booking {
    id: string;
    check_in: string;
    check_out: string;
    nights: number;
    total_amount: number;
    status: string;
    property_id: string;
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
    const [activeTab, setActiveTab] = useState<'bookings' | 'settings'>('bookings');

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
                <div className="w-10 h-10 border-4 border-gray-200 border-t-green-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    const upcomingBookings = bookings.filter(b => new Date(b.check_in) >= new Date() && b.status !== 'cancelled');
    const pastBookings = bookings.filter(b => new Date(b.check_in) < new Date() || b.status === 'cancelled');

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <Link href="/" className="block">
                        <img src="/WHITE.jpg" alt="9jaRooms" className="h-[4.5rem] w-auto object-contain" />
                    </Link>
                    <button 
                        onClick={handleSignOut}
                        className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-red-600 transition-colors"
                    >
                        <LogOut size={16} /> Sign Out
                    </button>
                </div>
            </header>

            <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-32 pb-20 page-enter">
                <div className="mb-8 md:mb-12">
                    <h1 className="text-3xl md:text-4xl font-serif font-bold text-gray-900">
                        Welcome, {user?.user_metadata?.first_name || user?.user_metadata?.name?.split(' ')[0] || 'Guest'}
                    </h1>
                    <p className="text-gray-500 mt-2 text-lg font-light">Manage your stays and profile settings</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Sidebar / Navigation */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-3xl shadow-xl shadow-gray-100/50 border border-gray-100 p-6 sticky top-32 overflow-hidden relative">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-full blur-3xl opacity-50 -mr-10 -mt-10 pointer-events-none" />
                            
                            <div className="relative z-10">
                                <div className="w-16 h-16 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-2xl font-bold mb-4 shadow-sm border border-green-200">
                                    {user?.user_metadata?.first_name?.charAt(0) || user?.user_metadata?.name?.charAt(0) || user?.email?.charAt(0) || 'G'}
                                </div>
                                <h2 className="text-lg font-bold text-gray-900 truncate">{user?.user_metadata?.name || `${user?.user_metadata?.first_name || ''} ${user?.user_metadata?.last_name || ''}`.trim() || 'Customer'}</h2>
                                <p className="text-sm text-gray-500 mb-8 truncate">{user?.email}</p>

                                <nav className="space-y-2">
                                    <button 
                                        onClick={() => setActiveTab('bookings')}
                                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-medium transition-all ${
                                            activeTab === 'bookings' 
                                            ? 'bg-green-50 text-green-700 shadow-sm border border-green-100/50' 
                                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                                        }`}
                                    >
                                        <Calendar size={18} className={activeTab === 'bookings' ? 'text-green-600' : ''} /> 
                                        My Stays
                                    </button>
                                    <button 
                                        onClick={() => setActiveTab('settings')}
                                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-medium transition-all ${
                                            activeTab === 'settings' 
                                            ? 'bg-green-50 text-green-700 shadow-sm border border-green-100/50' 
                                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                                        }`}
                                    >
                                        <Settings size={18} className={activeTab === 'settings' ? 'text-green-600' : ''} /> 
                                        Account Settings
                                    </button>
                                </nav>
                            </div>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="lg:col-span-3">
                        {activeTab === 'bookings' && (
                            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <section>
                                    <h3 className="text-xl md:text-2xl font-serif font-bold text-gray-900 mb-6 flex items-center gap-2">
                                        <Clock className="text-green-500" /> Upcoming Stays
                                    </h3>
                                    
                                    {upcomingBookings.length === 0 ? (
                                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-10 md:p-14 text-center">
                                            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-5">
                                                <Calendar size={32} className="text-gray-300" />
                                            </div>
                                            <h4 className="text-lg font-bold text-gray-900 mb-2">No upcoming trips</h4>
                                            <p className="text-gray-500 mb-8 max-w-sm mx-auto">Time to dust off your bags and start planning your next stunning stay.</p>
                                            <Link href="/" className="inline-block bg-gray-900 text-white font-medium px-8 py-3.5 rounded-xl hover:bg-black transition-all hover:shadow-lg hover:shadow-gray-200">
                                                Explore 9jaRooms
                                            </Link>
                                        </div>
                                    ) : (
                                        <div className="space-y-5">
                                            {upcomingBookings.map((booking) => (
                                                <BookingCard key={booking.id} booking={booking} formatPrice={formatPrice} formatDate={formatDate} isUpcoming />
                                            ))}
                                        </div>
                                    )}
                                </section>

                                <section>
                                    <h3 className="text-xl md:text-2xl font-serif font-bold text-gray-900 mb-6 flex items-center gap-2 pt-6 border-t border-gray-100">
                                        <CheckCircle2 className="text-gray-400" /> Past Stays
                                    </h3>
                                    
                                    {pastBookings.length === 0 ? (
                                        <p className="text-gray-500 bg-gray-50 p-6 rounded-2xl border border-gray-100 italic text-center">You have no past bookings yet.</p>
                                    ) : (
                                        <div className="space-y-5">
                                            {pastBookings.map((booking) => (
                                                <BookingCard key={booking.id} booking={booking} formatPrice={formatPrice} formatDate={formatDate} />
                                            ))}
                                        </div>
                                    )}
                                </section>
                            </div>
                        )}

                        {activeTab === 'settings' && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <h3 className="text-xl md:text-2xl font-serif font-bold text-gray-900 mb-6 flex items-center gap-2">
                                    <User className="text-green-500" /> Profile & Security
                                </h3>
                                
                                <AccountSettingsForm user={user} />
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

function BookingCard({ booking, formatPrice, formatDate, isUpcoming = false }: { booking: Booking, formatPrice: (v: number) => string, formatDate: (v: string) => string, isUpcoming?: boolean }) {
    return (
        <div className={`bg-white rounded-3xl border flex flex-col sm:flex-row overflow-hidden group transition-all hover:shadow-md ${isUpcoming ? 'border-green-100/60 shadow-sm shadow-green-50/50' : 'border-gray-100 opacity-90'}`}>
            <div className="w-full sm:w-56 h-48 sm:h-auto bg-gray-100 shrink-0 relative overflow-hidden">
                {booking.property?.thumbnail ? (
                    <img src={booking.property.thumbnail} alt={booking.property.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Home size={32} className="text-gray-300" />
                    </div>
                )}
                {booking.status === 'confirmed' && isUpcoming && (
                     <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-green-700 shadow-sm flex items-center gap-2 border border-green-100">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        Confirmed
                     </div>
                )}
            </div>
            <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between">
                <div>
                    <div className="flex items-start justify-between gap-4 mb-3">
                        <h4 className="font-bold text-gray-900 text-lg group-hover:text-green-600 transition-colors">{booking.property?.name || 'Property'}</h4>
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
                            booking.status === 'confirmed' ? 'bg-green-50 text-green-700 border-green-200' :
                            booking.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                            'bg-gray-50 text-gray-700 border-gray-200 uppercase tracking-wide text-[10px]'
                        }`}>
                            {booking.status}
                        </span>
                    </div>
                    <p className="text-sm text-gray-500 mb-5 flex items-center gap-1.5">
                        <MapPin size={14} className="text-gray-400" />
                        {booking.property?.area || 'Area'}, {booking.property?.city || 'City'}
                    </p>
                    
                    <div className="flex items-center gap-6 text-sm mb-5 bg-gray-50 rounded-2xl p-4 border border-gray-100/80">
                        <div>
                            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1">Check in</p>
                            <p className="font-medium text-gray-900">{formatDate(booking.check_in)}</p>
                        </div>
                        <div className="w-px h-8 bg-gray-200"></div>
                        <div>
                            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1">Check out</p>
                            <p className="font-medium text-gray-900">{formatDate(booking.check_out)}</p>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center justify-between mt-2">
                    <div>
                        <p className="text-xs text-gray-500 mb-0.5">{booking.nights} night{booking.nights > 1 ? 's' : ''} • {booking.room?.name}</p>
                        <p className="font-bold text-gray-900 text-lg">₦{formatPrice(booking.total_amount)}</p>
                    </div>
                    {isUpcoming && booking.status !== 'cancelled' && (
                        <Link href={`/property/${booking.property_id}`} className="text-sm font-semibold text-green-600 hover:text-green-700 hover:underline">
                            View Listing
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}

// -------------------------------------------------------------------------------------------------
// Account Settings Component
// -------------------------------------------------------------------------------------------------

function AccountSettingsForm({ user }: { user: any }) {
    const [firstName, setFirstName] = useState(user?.user_metadata?.first_name || '');
    const [lastName, setLastName] = useState(user?.user_metadata?.last_name || '');
    const [phone, setPhone] = useState(user?.user_metadata?.phone || '');
    const [email, setEmail] = useState(user?.email || '');
    const [password, setPassword] = useState('');
    
    const [profileStatus, setProfileStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [securityStatus, setSecurityStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState<{ text: string, type: 'error' | 'success'} | null>(null);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setProfileStatus('loading');
        setMessage(null);

        try {
            const supabase = createClient();
            
            // Note: updating email sends a confirmation link to old and new emails by default in Supabase
            const updates: any = {
                data: {
                    first_name: firstName,
                    last_name: lastName,
                    name: `${firstName} ${lastName}`.trim(),
                    phone,
                }
            };

            if (email !== user.email) {
                updates.email = email;
            }

            const { error } = await supabase.auth.updateUser(updates);

            if (error) throw error;
            
            setProfileStatus('success');
            if (email !== user.email) {
                setMessage({ text: 'Profile updated! A verification link was sent to your new email.', type: 'success' });
            } else {
                setMessage({ text: 'Profile updated successfully.', type: 'success' });
            }
            setTimeout(() => setProfileStatus('idle'), 3000);
        } catch (err: any) {
            console.error(err);
            setProfileStatus('error');
            setMessage({ text: err.message || 'Failed to update profile.', type: 'error' });
        }
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (password.length < 6) {
            setSecurityStatus('error');
            setMessage({ text: 'Password must be at least 6 characters.', type: 'error' });
            return;
        }

        setSecurityStatus('loading');
        setMessage(null);

        try {
            const supabase = createClient();
            const { error } = await supabase.auth.updateUser({ password });

            if (error) throw error;

            setPassword('');
            setSecurityStatus('success');
            setMessage({ text: 'Password changed successfully.', type: 'success' });
            setTimeout(() => setSecurityStatus('idle'), 3000);
        } catch (err: any) {
            console.error(err);
            setSecurityStatus('error');
            setMessage({ text: err.message || 'Failed to update password.', type: 'error' });
        }
    };

    return (
        <div className="space-y-8">
            {message && (
                <div className={`p-4 rounded-2xl flex items-start gap-3 border ${message.type === 'error' ? 'bg-red-50 border-red-100 text-red-700' : 'bg-green-50 border-green-100 text-green-700'}`}>
                    {message.type === 'success' ? <CheckCircle2 className="shrink-0 mt-0.5" size={18} /> : <Shield className="shrink-0 mt-0.5" size={18} />}
                    <span className="font-medium text-sm">{message.text}</span>
                </div>
            )}

            {/* Personal Info Form */}
            <div className="bg-white rounded-3xl shadow-xl shadow-gray-100/50 border border-gray-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm text-gray-500">
                        <User size={16} />
                    </div>
                    <h4 className="font-bold text-gray-900 text-lg">Personal Information</h4>
                </div>
                
                <div className="p-6 md:p-8">
                    <form onSubmit={handleUpdateProfile} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 ml-1">First Name</label>
                                <input
                                    type="text"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all font-medium text-gray-900"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 ml-1">Last Name</label>
                                <input
                                    type="text"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all font-medium text-gray-900"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 ml-1 flex items-center gap-1.5">
                                    <Mail size={14} className="text-gray-400" /> Email Address
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all font-medium text-gray-900"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 ml-1 flex items-center gap-1.5">
                                    <Phone size={14} className="text-gray-400" /> Phone Number
                                </label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all font-medium text-gray-900"
                                    placeholder="+234..."
                                />
                            </div>
                        </div>

                        <div className="pt-2 flex justify-end">
                            <button
                                type="submit"
                                disabled={profileStatus === 'loading'}
                                className="px-8 py-3 bg-gray-900 hover:bg-black text-white font-medium rounded-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {profileStatus === 'loading' ? 'Saving...' : 'Save Profile'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Security Form */}
            <div className="bg-white rounded-3xl shadow-xl shadow-gray-100/50 border border-gray-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm text-gray-500">
                        <Lock size={16} />
                    </div>
                    <h4 className="font-bold text-gray-900 text-lg">Change Password</h4>
                </div>
                
                <div className="p-6 md:p-8">
                    <form onSubmit={handleUpdatePassword} className="space-y-6 max-w-md">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 ml-1">New Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all font-medium text-gray-900 placeholder-gray-400"
                                placeholder="••••••••"
                                required
                                minLength={6}
                            />
                            <p className="text-xs text-gray-500 ml-1 mt-1">Must be at least 6 characters long.</p>
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={securityStatus === 'loading' || !password}
                                className="px-8 py-3 bg-white border border-gray-200 text-gray-900 hover:bg-gray-50 hover:border-gray-300 font-medium rounded-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
                            >
                                {securityStatus === 'loading' ? 'Updating...' : 'Update Password'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
