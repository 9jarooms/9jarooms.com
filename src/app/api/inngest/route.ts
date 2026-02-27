import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { bookingCreated } from '@/lib/inngest/functions/booking-created';
import { paymentConfirmed } from '@/lib/inngest/functions/payment-confirmed';
import { expirePendingBookings } from '@/lib/inngest/functions/expire-bookings';
import { aiMessageReceived } from '@/lib/inngest/functions/ai-message';
import { whatsappMessageBuffer, whatsappMessageProcessor } from '@/lib/inngest/functions/whatsapp-agent';

export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [
        bookingCreated,
        paymentConfirmed,
        expirePendingBookings,
        aiMessageReceived,
        whatsappMessageBuffer,
        whatsappMessageProcessor,
    ],
});
