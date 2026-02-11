import { NextRequest, NextResponse } from 'next/server';
import { validateWebhookSignature } from '@/lib/paystack';
import { inngest } from '@/lib/inngest/client';

// Paystack webhook handler
export async function POST(request: NextRequest) {
    try {
        const body = await request.text();
        const signature = request.headers.get('x-paystack-signature') || '';

        // Validate webhook signature
        if (!validateWebhookSignature(body, signature)) {
            console.error('Invalid Paystack webhook signature');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        const event = JSON.parse(body);
        console.log('Paystack webhook received:', event.event);

        // Handle charge.success event
        if (event.event === 'charge.success') {
            const { reference, amount, metadata } = event.data;

            // Send to Inngest for processing
            await inngest.send({
                name: 'payment/confirmed',
                data: {
                    reference,
                    amount,
                    metadata,
                    paystackData: event.data,
                },
            });

            console.log(`Payment confirmed for reference: ${reference}`);
        }

        // Always return 200 to acknowledge receipt
        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('Paystack webhook error:', error);
        // Still return 200 to prevent Paystack from retrying
        return NextResponse.json({ received: true });
    }
}
