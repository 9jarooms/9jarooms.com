import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { paymentConfirmed } from '@/lib/inngest/functions/payment-confirmed';
import { expirePendingBookings } from '@/lib/inngest/functions/expire-bookings';
// The "Mary" WhatsApp AI agent (ai-message, whatsapp-agent) is retired (Oct 2026): caretakers answer
// WhatsApp themselves. Its functions are no longer served, so it can never reply to a guest.
export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [
        paymentConfirmed,
        expirePendingBookings,
    ],
});
