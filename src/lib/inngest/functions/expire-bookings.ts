import { inngest } from '../client';
import { createServerClient } from '@/lib/supabase/server';

// Cron: Expire unpaid bookings after 30 minutes
export const expirePendingBookings = inngest.createFunction(
    {
        id: 'expire-pending-bookings',
        name: 'Expire Pending Bookings',
    },
    { cron: '*/5 * * * *' }, // Run every 5 minutes
    async ({ step }) => {
        const supabase = createServerClient();

        // Step 1: Find expired pending bookings
        const expiredBookings = await step.run('find-expired', async () => {
            const { data, error } = await supabase
                .from('bookings')
                .select('id, room_id, paystack_reference')
                .eq('status', 'pending')
                .lt('expires_at', new Date().toISOString());

            if (error) throw new Error(`Failed to find expired bookings: ${error.message}`);
            return data || [];
        });

        if (expiredBookings.length === 0) {
            return { expired: 0 };
        }

        // Step 2: Mark bookings as expired
        await step.run('mark-expired', async () => {
            const ids = expiredBookings.map(b => b.id);

            const { error } = await supabase
                .from('bookings')
                .update({ status: 'expired' })
                .in('id', ids);

            if (error) throw new Error(`Failed to expire bookings: ${error.message}`);
        });

        // Step 3: Release held dates
        await step.run('release-dates', async () => {
            const ids = expiredBookings.map(b => b.id);

            // Delete held availability entries (they go back to available)
            const { error } = await supabase
                .from('availability')
                .delete()
                .in('booking_id', ids)
                .eq('status', 'held');

            if (error) throw new Error(`Failed to release dates: ${error.message}`);
        });

        return { expired: expiredBookings.length };
    }
);
