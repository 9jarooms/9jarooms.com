import { NextRequest, NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';

// Verify Webhook (GET)
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
        console.log('WhatsApp Webhook Verified');
        return new NextResponse(challenge, { status: 200 });
    }

    return new NextResponse('Forbidden', { status: 403 });
}

// Receive Messages (POST)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Check if this is a WhatsApp status update or message
        if (body.object === 'whatsapp_business_account') {
            for (const entry of body.entry) {
                for (const change of entry.changes) {
                    const value = change.value;

                    if (value.messages && value.messages.length > 0) {
                        const message = value.messages[0];
                        const contact = value.contacts?.[0];

                        // Trigger Inngest Event
                        await inngest.send({
                            name: 'whatsapp.message.received',
                            data: {
                                messageId: message.id,
                                from: message.from, // Booking User's Phone
                                text: message.text?.body || '', // Only handling text for now
                                type: message.type,
                                contactName: contact?.profile?.name || 'Unknown',
                                timestamp: message.timestamp,
                            },
                        });
                    }
                }
            }
        }

        return NextResponse.json({ status: 'ok' });
    } catch (error) {
        console.error('Webhook Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
