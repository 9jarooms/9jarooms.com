import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { TelegramClient } from '@/lib/telegram/client';
import { inngest } from '@/lib/inngest/client';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;

// GET — Auto-register webhook with Telegram on first request / deploy
export async function GET(request: NextRequest) {
    try {
        const host = request.headers.get('host') || request.nextUrl.host;
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const webhookUrl = `${protocol}://${host}/api/webhooks/telegram`;

        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: webhookUrl }),
        });

        const data = await res.json();

        if (data.ok) {
            return NextResponse.json({ success: true, webhook: webhookUrl, message: 'Telegram webhook registered' });
        } else {
            return NextResponse.json({ success: false, error: data.description }, { status: 500 });
        }
    } catch (error) {
        console.error('Failed to set Telegram webhook:', error);
        return NextResponse.json({ error: 'Failed to register webhook' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const update = await request.json();
        const message = update.message;

        if (!message || !message.text) {
            return NextResponse.json({ ok: true });
        }

        const chatId = String(message.chat.id);
        const text = message.text.trim();
        const supabase = createAdminClient();
        const telegram = new TelegramClient();

        // Handle /start with deep-link token
        if (text.startsWith('/start ')) {
            const token = text.slice(7).trim();

            if (!token) {
                await telegram.sendMessage(chatId, '❌ Invalid link. Please use the connect button from your 9jaRooms dashboard.');
                return NextResponse.json({ ok: true });
            }

            // Look up token
            const { data: tokenRecord } = await supabase
                .from('telegram_connect_tokens')
                .select('caretaker_id, expires_at')
                .eq('token', token)
                .single();

            if (!tokenRecord) {
                await telegram.sendMessage(chatId, '❌ This link has expired or is invalid. Please generate a new one from your dashboard.');
                return NextResponse.json({ ok: true });
            }

            // Check expiry
            if (new Date(tokenRecord.expires_at) < new Date()) {
                await supabase.from('telegram_connect_tokens').delete().eq('token', token);
                await telegram.sendMessage(chatId, '❌ This link has expired. Please generate a new one from your dashboard.');
                return NextResponse.json({ ok: true });
            }

            // Save chat_id to caretaker
            await supabase
                .from('caretakers')
                .update({ telegram_chat_id: chatId })
                .eq('id', tokenRecord.caretaker_id);

            // Delete used token
            await supabase.from('telegram_connect_tokens').delete().eq('token', token);

            // Fetch caretaker's properties for welcome message
            const { data: caretaker } = await supabase
                .from('caretakers')
                .select('name')
                .eq('id', tokenRecord.caretaker_id)
                .single();

            const { data: properties } = await supabase
                .from('properties')
                .select('name, rooms(name)')
                .eq('caretaker_id', tokenRecord.caretaker_id)
                .eq('is_active', true);

            let welcome = `✅ <b>Connected successfully!</b>\n\nHi ${caretaker?.name || 'there'}! Your Telegram is now linked to your 9jaRooms account.\n`;

            if (properties && properties.length > 0) {
                welcome += `\n<b>Your properties:</b>\n`;
                for (const p of properties) {
                    const rooms = (p as any).rooms || [];
                    welcome += `\n🏠 <b>${p.name}</b>`;
                    if (rooms.length > 0) {
                        welcome += `\n   Rooms: ${rooms.map((r: any) => r.name).join(', ')}`;
                    }
                }
            }

            welcome += `\n\n<b>What I can help you with:</b>\n• Block / unblock dates for your rooms\n• View upcoming bookings\n• Check room availability\n• You'll also receive booking notifications here\n\nJust type naturally! For example: "Block Room A from April 1 to 5"`;

            await telegram.sendMessage(chatId, welcome);
            return NextResponse.json({ ok: true });
        }

        // Handle /start without token
        if (text === '/start') {
            // Check if already connected
            const { data: caretaker } = await supabase
                .from('caretakers')
                .select('id, name')
                .eq('telegram_chat_id', chatId)
                .single();

            if (caretaker) {
                await telegram.sendMessage(chatId, `👋 Welcome back, ${caretaker.name}! How can I help you today?\n\nYou can ask me to block dates, check availability, or view your bookings.`);
            } else {
                await telegram.sendMessage(chatId, `👋 Hi! To connect this bot to your 9jaRooms caretaker account, please use the "Connect to Telegram" button on your dashboard at 9jarooms.com`);
            }
            return NextResponse.json({ ok: true });
        }

        // Regular message — look up caretaker by chat_id
        const { data: caretaker } = await supabase
            .from('caretakers')
            .select('id, name')
            .eq('telegram_chat_id', chatId)
            .single();

        if (!caretaker) {
            await telegram.sendMessage(chatId, '⚠️ Your Telegram is not connected to a 9jaRooms account. Please use the "Connect to Telegram" button on your caretaker dashboard.');
            return NextResponse.json({ ok: true });
        }

        // Fire Inngest event for AI processing
        await inngest.send({
            name: 'telegram/message.received',
            data: {
                chatId,
                caretakerId: caretaker.id,
                caretakerName: caretaker.name,
                message: text,
            },
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Telegram webhook error:', error);
        return NextResponse.json({ ok: true }); // Always return 200 to Telegram
    }
}
