import { redirect } from 'next/navigation';

// Bookings now live inside the Today screen.
export default function BookingsPage() {
    redirect('/dashboard?tab=bookings');
}
