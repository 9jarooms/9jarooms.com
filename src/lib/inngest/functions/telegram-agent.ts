import { inngest } from '../client';
import { createAdminClient } from '@/lib/supabase/server';
import { TelegramClient } from '@/lib/telegram/client';
import { GoogleGenAI, Type, type FunctionDeclaration } from '@google/genai';
import { format, addDays, parseISO } from 'date-fns';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const SYSTEM_PROMPT = `You are the 9jaRooms Caretaker Assistant on Telegram. You help property caretakers manage their rooms and bookings via natural language.

Your capabilities:
1. List properties and rooms the caretaker manages
2. Block dates for rooms (mark as unavailable for maintenance, cleaning, or personal use)
3. Unblock dates (make them available again)
4. View upcoming bookings
5. Check room availability for specific dates

Your personality:
- Professional but friendly
- Concise (this is Telegram, not email)
- Use emojis sparingly but effectively
- Always confirm actions before executing (unless user is very specific)

Important rules:
- You can ONLY manage properties assigned to this caretaker
- You CANNOT cancel or modify existing bookings (those dates are locked)
- When blocking dates, you set them to "maintenance" status
- When unblocking, you remove the availability record (making them open)
- Always confirm the room name and dates before blocking/unblocking
- If a caretaker manages multiple rooms, ask which room unless they specify
- Format dates clearly for Nigerian users (e.g., "5 Apr 2026")

Pricing is in Nigerian Naira (₦). Always format currency with ₦ symbol.`;

// Tool definitions
const tools = [
    {
        name: 'list_properties',
        description: 'List all properties and rooms this caretaker manages. Call this first if you need to know what rooms are available.',
        parameters: {
            type: Type.OBJECT,
            properties: {},
        },
    },
    {
        name: 'block_dates',
        description: 'Block dates for a specific room (marks as maintenance/unavailable). Dates should be in YYYY-MM-DD format.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                room_id: { type: Type.STRING, description: 'Room ID to block' },
                start_date: { type: Type.STRING, description: 'Start date (YYYY-MM-DD)' },
                end_date: { type: Type.STRING, description: 'End date (YYYY-MM-DD), inclusive' },
                reason: { type: Type.STRING, description: 'Reason: maintenance, cleaning, or personal' },
            },
            required: ['room_id', 'start_date', 'end_date'],
        },
    },
    {
        name: 'unblock_dates',
        description: 'Unblock dates for a specific room (makes them available again). Cannot unblock booked dates.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                room_id: { type: Type.STRING, description: 'Room ID to unblock' },
                start_date: { type: Type.STRING, description: 'Start date (YYYY-MM-DD)' },
                end_date: { type: Type.STRING, description: 'End date (YYYY-MM-DD), inclusive' },
            },
            required: ['room_id', 'start_date', 'end_date'],
        },
    },
    {
        name: 'get_upcoming_bookings',
        description: 'Get upcoming confirmed bookings for the caretaker\'s properties',
        parameters: {
            type: Type.OBJECT,
            properties: {
                limit: { type: Type.NUMBER, description: 'Max number of bookings to return (default 10)' },
            },
        },
    },
    {
        name: 'get_room_availability',
        description: 'Check availability for a specific room over a date range',
        parameters: {
            type: Type.OBJECT,
            properties: {
                room_id: { type: Type.STRING, description: 'Room ID to check' },
                start_date: { type: Type.STRING, description: 'Start date (YYYY-MM-DD)' },
                end_date: { type: Type.STRING, description: 'End date (YYYY-MM-DD)' },
            },
            required: ['room_id', 'start_date', 'end_date'],
        },
    },
];

// Tool execution
async function executeListProperties(caretakerId: string) {
    const supabase = createAdminClient();
    const { data: properties } = await supabase
        .from('properties')
        .select('id, name, area, city, rooms(id, name, price_per_night, max_guests, is_active)')
        .eq('caretaker_id', caretakerId)
        .eq('is_active', true);

    if (!properties || properties.length === 0) {
        return 'No properties currently assigned to you.';
    }

    return JSON.stringify(
        properties.map(p => ({
            id: p.id,
            name: p.name,
            area: p.area,
            city: p.city,
            rooms: ((p as any).rooms || []).map((r: any) => ({
                id: r.id,
                name: r.name,
                price_per_night: r.price_per_night,
                max_guests: r.max_guests,
                is_active: r.is_active,
            })),
        }))
    );
}

async function executeBlockDates(args: Record<string, unknown>, caretakerId: string) {
    const supabase = createAdminClient();
    const roomId = args.room_id as string;
    const startDate = args.start_date as string;
    const endDate = args.end_date as string;
    const reason = (args.reason as string) || 'maintenance';

    // Verify room belongs to caretaker
    const { data: room } = await supabase
        .from('rooms')
        .select('id, name, property:properties!inner(caretaker_id)')
        .eq('id', roomId)
        .single();

    if (!room || (room as any).property?.caretaker_id !== caretakerId) {
        return 'Error: Room not found or you do not have access to it.';
    }

    // Generate date range
    const dates: string[] = [];
    let current = parseISO(startDate);
    const end = parseISO(endDate);
    while (current <= end) {
        dates.push(format(current, 'yyyy-MM-dd'));
        current = addDays(current, 1);
    }

    // Check for existing bookings on those dates
    const { data: booked } = await supabase
        .from('availability')
        .select('date, status')
        .eq('room_id', roomId)
        .in('date', dates)
        .eq('status', 'booked');

    if (booked && booked.length > 0) {
        return `Cannot block all dates. The following dates have confirmed bookings: ${booked.map(b => b.date).join(', ')}. Please block around those dates.`;
    }

    // Upsert availability records
    const records = dates.map(date => ({
        room_id: roomId,
        date,
        status: reason === 'cleaning' ? 'cleaning' : 'maintenance',
    }));

    for (const record of records) {
        const { data: existing } = await supabase
            .from('availability')
            .select('id')
            .eq('room_id', roomId)
            .eq('date', record.date)
            .single();

        if (existing) {
            await supabase
                .from('availability')
                .update({ status: record.status })
                .eq('room_id', roomId)
                .eq('date', record.date);
        } else {
            await supabase
                .from('availability')
                .insert(record);
        }
    }

    return JSON.stringify({
        success: true,
        room: room.name,
        dates_blocked: dates.length,
        from: startDate,
        to: endDate,
        reason,
    });
}

async function executeUnblockDates(args: Record<string, unknown>, caretakerId: string) {
    const supabase = createAdminClient();
    const roomId = args.room_id as string;
    const startDate = args.start_date as string;
    const endDate = args.end_date as string;

    // Verify room belongs to caretaker
    const { data: room } = await supabase
        .from('rooms')
        .select('id, name, property:properties!inner(caretaker_id)')
        .eq('id', roomId)
        .single();

    if (!room || (room as any).property?.caretaker_id !== caretakerId) {
        return 'Error: Room not found or you do not have access to it.';
    }

    // Generate date range
    const dates: string[] = [];
    let current = parseISO(startDate);
    const end = parseISO(endDate);
    while (current <= end) {
        dates.push(format(current, 'yyyy-MM-dd'));
        current = addDays(current, 1);
    }

    // Only delete non-booked availability records (maintenance, cleaning, etc.)
    const { data: deleted } = await supabase
        .from('availability')
        .delete()
        .eq('room_id', roomId)
        .in('date', dates)
        .in('status', ['maintenance', 'cleaning'])
        .select('date');

    return JSON.stringify({
        success: true,
        room: room.name,
        dates_unblocked: deleted?.length || 0,
        from: startDate,
        to: endDate,
    });
}

async function executeGetUpcomingBookings(args: Record<string, unknown>, caretakerId: string) {
    const supabase = createAdminClient();
    const limit = (args.limit as number) || 10;

    // Get caretaker's property IDs
    const { data: properties } = await supabase
        .from('properties')
        .select('id, name')
        .eq('caretaker_id', caretakerId)
        .eq('is_active', true);

    if (!properties || properties.length === 0) {
        return 'No properties assigned to you.';
    }

    const propertyIds = properties.map(p => p.id);
    const propertyMap = Object.fromEntries(properties.map(p => [p.id, p.name]));

    const { data: bookings } = await supabase
        .from('bookings')
        .select('id, guest_name, guest_phone, check_in, check_out, nights, total_amount, status, property_id, room:rooms(name)')
        .in('property_id', propertyIds)
        .in('status', ['paid', 'confirmed'])
        .gte('check_out', new Date().toISOString().split('T')[0])
        .order('check_in', { ascending: true })
        .limit(limit);

    if (!bookings || bookings.length === 0) {
        return 'No upcoming bookings.';
    }

    return JSON.stringify(
        bookings.map(b => ({
            guest_name: b.guest_name,
            guest_phone: b.guest_phone,
            property: propertyMap[b.property_id] || 'Unknown',
            room: (b as any).room?.name || 'N/A',
            check_in: b.check_in,
            check_out: b.check_out,
            nights: b.nights,
            total: b.total_amount,
            status: b.status,
        }))
    );
}

async function executeGetRoomAvailability(args: Record<string, unknown>, caretakerId: string) {
    const supabase = createAdminClient();
    const roomId = args.room_id as string;
    const startDate = args.start_date as string;
    const endDate = args.end_date as string;

    // Verify room belongs to caretaker
    const { data: room } = await supabase
        .from('rooms')
        .select('id, name, property:properties!inner(caretaker_id, name)')
        .eq('id', roomId)
        .single();

    if (!room || (room as any).property?.caretaker_id !== caretakerId) {
        return 'Error: Room not found or you do not have access to it.';
    }

    const { data: availability } = await supabase
        .from('availability')
        .select('date, status')
        .eq('room_id', roomId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

    // Generate full calendar
    const dates: string[] = [];
    let current = parseISO(startDate);
    const end = parseISO(endDate);
    while (current <= end) {
        dates.push(format(current, 'yyyy-MM-dd'));
        current = addDays(current, 1);
    }

    const statusMap = Object.fromEntries(
        (availability || []).map(a => [a.date, a.status])
    );

    const calendar = dates.map(date => ({
        date,
        status: statusMap[date] || 'available',
    }));

    return JSON.stringify({
        room: room.name,
        property: (room as any).property?.name,
        availability: calendar,
    });
}

async function executeTool(name: string, args: Record<string, unknown>, caretakerId: string): Promise<string> {
    switch (name) {
        case 'list_properties':
            return executeListProperties(caretakerId);
        case 'block_dates':
            return executeBlockDates(args, caretakerId);
        case 'unblock_dates':
            return executeUnblockDates(args, caretakerId);
        case 'get_upcoming_bookings':
            return executeGetUpcomingBookings(args, caretakerId);
        case 'get_room_availability':
            return executeGetRoomAvailability(args, caretakerId);
        default:
            return `Unknown tool: ${name}`;
    }
}

// Main Telegram message handler
export const telegramMessageHandler = inngest.createFunction(
    {
        id: 'telegram-message-handler',
        name: 'Telegram Message Handler',
        debounce: {
            key: 'event.data.chatId',
            period: '30s', // Batch rapid messages
        },
    },
    { event: 'telegram/message.received' },
    async ({ event, step }) => {
        const { chatId, caretakerId, caretakerName, message } = event.data;
        const supabase = createAdminClient();
        const telegram = new TelegramClient();

        // Step 1: Get or create conversation context
        const conversation = await step.run('get-conversation', async () => {
            // Use a simple key to track conversation history per caretaker
            const { data } = await supabase
                .from('conversations')
                .select('*')
                .eq('channel', 'telegram')
                .eq('external_id', chatId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (data) return data;

            // Create new conversation
            const { data: newConv } = await supabase
                .from('conversations')
                .insert({
                    channel: 'telegram',
                    external_id: chatId,
                    guest_name: caretakerName,
                    messages: [],
                    context: { caretakerId, role: 'caretaker' },
                })
                .select()
                .single();

            return newConv;
        });

        if (!conversation) throw new Error('Failed to get/create conversation');

        // Step 2: Add user message
        const updatedMessages = await step.run('add-message', async () => {
            const messages = (conversation.messages as any[]) || [];
            messages.push({
                role: 'user',
                content: message,
                timestamp: new Date().toISOString(),
            });

            // Keep only last 20 messages to avoid context overflow
            const trimmed = messages.slice(-20);

            await supabase
                .from('conversations')
                .update({
                    messages: trimmed,
                    last_message_at: new Date().toISOString(),
                })
                .eq('id', conversation.id);

            return trimmed;
        });

        // Step 3: Generate AI response
        const aiResponse = await step.run('generate-response', async () => {
            const chatHistory = updatedMessages.map((msg: any) => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }],
            }));

            const lastMessage = chatHistory.pop();

            const chat = genAI.chats.create({
                model: 'gemini-2.5-flash',
                config: {
                    systemInstruction: SYSTEM_PROMPT + `\n\nCaretaker ID: ${caretakerId}\nCaretaker Name: ${caretakerName}\nCurrent Date: ${format(new Date(), 'yyyy-MM-dd')}`,
                    tools: [{
                        functionDeclarations: tools as unknown as FunctionDeclaration[],
                    }],
                },
                history: chatHistory,
            });

            let response = await chat.sendMessage({
                message: lastMessage!.parts[0].text,
            });

            // Handle function calls
            let maxIterations = 5;
            while (maxIterations > 0) {
                const candidate = response.candidates?.[0];
                const parts = candidate?.content?.parts || [];
                const functionCalls = parts.filter((p: any) => p.functionCall);
                if (functionCalls.length === 0) break;

                const functionResponses = [];
                for (const part of functionCalls) {
                    const fc = (part as any).functionCall;
                    const result = await executeTool(fc.name, fc.args, caretakerId);
                    functionResponses.push({
                        functionResponse: {
                            name: fc.name,
                            response: { result },
                        },
                    });
                }

                response = await chat.sendMessage({
                    message: functionResponses,
                });

                maxIterations--;
            }

            const responseText = response.candidates?.[0]?.content?.parts
                ?.filter((p: any) => p.text)
                ?.map((p: any) => p.text)
                ?.join('\n') || 'Sorry, I couldn\'t process your request. Please try again.';

            return responseText;
        });

        // Step 4: Save AI response
        await step.run('save-response', async () => {
            const messages = updatedMessages;
            messages.push({
                role: 'assistant',
                content: aiResponse,
                timestamp: new Date().toISOString(),
            });

            await supabase
                .from('conversations')
                .update({ messages: messages.slice(-20) })
                .eq('id', conversation.id);
        });

        // Step 5: Send response via Telegram
        await step.run('send-reply', async () => {
            try {
                // Telegram has a 4096 char limit per message
                const maxLen = 4000;
                if (aiResponse.length > maxLen) {
                    const chunks = aiResponse.match(new RegExp(`.{1,${maxLen}}`, 'gs')) || [aiResponse];
                    for (const chunk of chunks) {
                        await telegram.sendMessage(chatId, chunk);
                    }
                } else {
                    await telegram.sendMessage(chatId, aiResponse);
                }
                return { sent: true };
            } catch (error) {
                console.error('Failed to send Telegram reply:', error);
                return { sent: false, error: String(error) };
            }
        });

        return { chatId, response: aiResponse };
    }
);
