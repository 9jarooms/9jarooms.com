import { inngest } from '../client';
import { createAdminClient } from '@/lib/supabase/server';

// Cron: Expire unpaid bookings and holds once expires_at passes (HOLD_MINUTES)
export const expirePendingBookings = (inngest as any).createFunction(
    {
        id: 'expire-pending-bookings',
        name: 'Expire Pending Bookings',
        triggers: { cron: '*/5 * * * *' }, // Run every 5 minutes
    },
    async ({ step }: any) => {
        const supabase = createAdminClient();

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

        // Step 2: expire them, but only those still unpaid and overdue now (a payment may have
        // landed since step 1), and release the held nights of exactly those.
        const released = await step.run('mark-expired-and-release', async () => {
            const ids = expiredBookings.map((b: any) => b.id);
            const { data, error } = await supabase
                .from('bookings')
                .update({ status: 'expired' })
                .in('id', ids)
                .eq('status', 'pending')
                .lt('expires_at', new Date().toISOString())
                .select('id');
            if (error) throw new Error(`Failed to expire bookings: ${error.message}`);
            const done = (data || []).map((b: any) => b.id);
            if (done.length) {
                const { error: relErr } = await supabase.from('availability').delete().in('booking_id', done).eq('status', 'held');
                if (relErr) throw new Error(`Failed to release dates: ${relErr.message}`);
            }
            return done.length;
        });

        return { expired: released };
    }
);
