import { NextRequest, NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';

// ManyChat webhook handler
// ManyChat sends messages here, we route them to the AI agent
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // ManyChat sends subscriber data and message
        const {
            subscriber_id,
            first_name,
            last_name,
            phone,
            message,
            channel = 'whatsapp',
        } = body;

        if (!message) {
            return NextResponse.json({ error: 'No message provided' }, { status: 400 });
        }

        const senderName = [first_name, last_name].filter(Boolean).join(' ') || 'Guest';

        // Send to Inngest AI handler with debouncing
        await inngest.send({
            name: 'ai/message.received',
            data: {
                conversationId: null, // Will be resolved by the handler
                message,
                senderPhone: phone,
                senderName,
                channel,
                externalId: subscriber_id,
            },
        });

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('ManyChat webhook error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
