import { inngest } from '../client';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyPayment } from '@/lib/paystack';
import { confirmPaidBooking, announcePayment } from '@/lib/booking/payment-confirmed';

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
                .select('id, room_id, paystack_reference, paystack_access_code, created_at, hold_extended_at')
                .eq('status', 'pending')
                .lt('expires_at', new Date().toISOString());

            if (error) throw new Error(`Failed to find expired bookings: ${error.message}`);
            return data || [];
        });

        // Website card payments: before letting the room go, ask Paystack. A payment that went through
        // (webhook missed) is confirmed now; one still in progress (bank transfer / USSD inside Paystack)
        // gets 10 more minutes, up to 45 minutes in all. Only abandoned ones are released.
        const keep = await step.run('check-paystack', async () => {
            const kept: string[] = [];
            for (const b of expiredBookings as any[]) {
                if (!b.paystack_access_code || !b.paystack_reference) continue;
                try {
                    const v = await verifyPayment(b.paystack_reference);
                    const st = v?.data?.status;
                    if (st === 'success') {
                        const r = await confirmPaidBooking(supabase, { reference: b.paystack_reference, amountKobo: v.data.amount, raw: v.data });
                        await announcePayment(supabase, r);   // same messages as the webhook (it will find this already done)
                        kept.push(b.id);
                    } else if (['ongoing', 'pending', 'processing', 'queued'].includes(String(st)) && !b.hold_extended_at &&
                        Date.now() - new Date(b.created_at).getTime() < 45 * 60 * 1000) {
                        // once only: a checkout left open cannot keep a room locked
                        await supabase.from('bookings').update({ expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), hold_extended_at: new Date().toISOString() })
                            .eq('id', b.id).eq('status', 'pending');
                        kept.push(b.id);
                    }
                } catch (e: any) {
                    console.warn('[expire] Paystack check failed for', b.paystack_reference, e?.message);
                }
            }
            return kept;
        });

        if (expiredBookings.length === 0) {
            return { expired: 0 };
        }

        // Step 2: expire them, but only those still unpaid and overdue now (a payment may have
        // landed since step 1), and release the held nights of exactly those.
        const released = await step.run('mark-expired-and-release', async () => {
            const ids = expiredBookings.map((b: any) => b.id).filter((id: string) => !keep.includes(id));
            if (!ids.length) return 0;
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
                // every night of an expired hold goes back on sale (held, or booked by a payment that failed)
                const { error: relErr } = await supabase.from('availability').delete().in('booking_id', done);
                if (relErr) throw new Error(`Failed to release dates: ${relErr.message}`);
            }
            return done.length;
        });

        return { expired: released };
    }
);
