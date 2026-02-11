import { inngest } from '../client';
import { createServerClient } from '@/lib/supabase/server';
import { GoogleGenAI, Type, type FunctionDeclaration } from '@google/genai';
import { format, addDays } from 'date-fns';
import { generateReference } from '@/lib/paystack';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const SYSTEM_PROMPT = `You are the 9jaRooms booking assistant — a friendly, helpful AI agent for a short-let apartment booking platform in Lagos, Nigeria.

Your capabilities:
1. Search for available properties by area, price range, and dates
2. Check room availability for specific dates
3. Help guests create bookings
4. Generate payment links
5. Answer questions about properties, amenities, and policies

Your personality:
- Warm, professional, and conversational
- Use Nigerian-friendly language (but don't overdo pidgin)
- Be concise — this is WhatsApp/chat, not email
- Use emojis sparingly but effectively
- Always confirm details before creating bookings

Your guardrails:
- You can ONLY search properties, check availability, and create bookings
- You cannot modify or cancel existing bookings
- You cannot access other guests' data
- If someone asks something outside your scope, politely redirect them to contact support

Pricing is in Nigerian Naira (₦). Always format currency with ₦ symbol.

When suggesting properties, format them cleanly:
🏠 Property Name
📍 Area, City
💰 ₦XX,XXX per night
✨ Key amenities

When a guest wants to book, you need:
1. Their name
2. Email address
3. Phone number
4. Check-in date
5. Check-out date
6. Which property/room

After collecting all info, confirm the total and create the booking.`;

// Tool definitions for Gemini function calling
const tools = [
    {
        name: 'search_properties',
        description: 'Search for available properties. Can filter by area, price range, and dates.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                area: { type: Type.STRING, description: 'Area to search in (e.g., Lekki, Victoria Island, Ikoyi, Surulere)' },
                min_price: { type: Type.NUMBER, description: 'Minimum price per night in Naira' },
                max_price: { type: Type.NUMBER, description: 'Maximum price per night in Naira' },
                check_in: { type: Type.STRING, description: 'Check-in date (YYYY-MM-DD)' },
                check_out: { type: Type.STRING, description: 'Check-out date (YYYY-MM-DD)' },
                max_guests: { type: Type.NUMBER, description: 'Number of guests' },
            },
        },
    },
    {
        name: 'check_availability',
        description: 'Check if a specific room is available for given dates',
        parameters: {
            type: Type.OBJECT,
            properties: {
                room_id: { type: Type.STRING, description: 'Room ID to check' },
                check_in: { type: Type.STRING, description: 'Check-in date (YYYY-MM-DD)' },
                check_out: { type: Type.STRING, description: 'Check-out date (YYYY-MM-DD)' },
            },
            required: ['room_id', 'check_in', 'check_out'],
        },
    },
    {
        name: 'create_booking',
        description: 'Create a booking and generate a payment link',
        parameters: {
            type: Type.OBJECT,
            properties: {
                room_id: { type: Type.STRING, description: 'Room ID to book' },
                property_id: { type: Type.STRING, description: 'Property ID' },
                guest_name: { type: Type.STRING, description: 'Guest full name' },
                guest_email: { type: Type.STRING, description: 'Guest email address' },
                guest_phone: { type: Type.STRING, description: 'Guest phone number' },
                check_in: { type: Type.STRING, description: 'Check-in date (YYYY-MM-DD)' },
                check_out: { type: Type.STRING, description: 'Check-out date (YYYY-MM-DD)' },
            },
            required: ['room_id', 'property_id', 'guest_name', 'guest_email', 'guest_phone', 'check_in', 'check_out'],
        },
    },
    {
        name: 'get_property_details',
        description: 'Get detailed information about a specific property',
        parameters: {
            type: Type.OBJECT,
            properties: {
                property_id: { type: Type.STRING, description: 'Property ID' },
            },
            required: ['property_id'],
        },
    },
];

// Tool execution functions
async function executeSearchProperties(args: Record<string, unknown>) {
    const supabase = createServerClient();

    let query = supabase
        .from('properties')
        .select('*, rooms(*)')
        .eq('is_active', true);

    if (args.area) query = query.ilike('area', `%${args.area}%`);
    if (args.max_guests) query = query.gte('max_guests', args.max_guests as number);

    const { data: properties } = await query;

    if (!properties || properties.length === 0) {
        return 'No properties found matching your criteria. Try different filters or ask me about available areas.';
    }

    // Filter by price if specified
    let filtered = properties;
    if (args.min_price) {
        filtered = filtered.filter(p => p.price_per_night >= (args.min_price as number));
    }
    if (args.max_price) {
        filtered = filtered.filter(p => p.price_per_night <= (args.max_price as number));
    }

    // If dates specified, check availability
    if (args.check_in && args.check_out) {
        const checkIn = new Date(args.check_in as string);
        const checkOut = new Date(args.check_out as string);
        const dates: string[] = [];
        let current = checkIn;
        while (current < checkOut) {
            dates.push(format(current, 'yyyy-MM-dd'));
            current = addDays(current, 1);
        }

        // Check each property's rooms for availability
        const availableProperties = [];
        for (const property of filtered) {
            const rooms = (property as any).rooms || [];
            for (const room of rooms) {
                const { data: unavailable } = await supabase
                    .from('availability')
                    .select('date')
                    .eq('room_id', room.id)
                    .in('date', dates)
                    .neq('status', 'available');

                if (!unavailable || unavailable.length === 0) {
                    availableProperties.push({
                        ...property,
                        available_room: room,
                    });
                    break;
                }
            }
        }
        filtered = availableProperties;
    }

    return JSON.stringify(
        filtered.map(p => ({
            id: p.id,
            name: p.name,
            area: p.area,
            city: p.city,
            price_per_night: p.price_per_night,
            amenities: p.amenities?.slice(0, 5),
            max_guests: p.max_guests,
            rooms: ((p as any).rooms || []).map((r: any) => ({
                id: r.id,
                name: r.name,
                price: r.price_per_night || p.price_per_night,
                max_guests: r.max_guests,
            })),
        }))
    );
}

async function executeCheckAvailability(args: Record<string, unknown>) {
    const supabase = createServerClient();
    const checkIn = new Date(args.check_in as string);
    const checkOut = new Date(args.check_out as string);
    const dates: string[] = [];

    let current = checkIn;
    while (current < checkOut) {
        dates.push(format(current, 'yyyy-MM-dd'));
        current = addDays(current, 1);
    }

    const { data: unavailable } = await supabase
        .from('availability')
        .select('date, status')
        .eq('room_id', args.room_id as string)
        .in('date', dates)
        .neq('status', 'available');

    if (!unavailable || unavailable.length === 0) {
        return JSON.stringify({ available: true, nights: dates.length });
    }

    return JSON.stringify({
        available: false,
        unavailable_dates: unavailable.map(a => ({ date: a.date, reason: a.status })),
    });
}

async function executeCreateBooking(args: Record<string, unknown>) {
    // Trigger the booking.created Inngest event
    await inngest.send({
        name: 'booking/created',
        data: {
            roomId: args.room_id,
            propertyId: args.property_id,
            guestName: args.guest_name,
            guestEmail: args.guest_email,
            guestPhone: args.guest_phone,
            checkIn: args.check_in,
            checkOut: args.check_out,
        },
    });

    return JSON.stringify({
        message: 'Booking is being created. A payment link will be generated shortly.',
        note: 'The payment link expires in 30 minutes.',
    });
}

async function executeGetPropertyDetails(args: Record<string, unknown>) {
    const supabase = createServerClient();

    const { data: property } = await supabase
        .from('properties')
        .select('*, rooms(*)')
        .eq('id', args.property_id as string)
        .single();

    if (!property) return 'Property not found.';

    return JSON.stringify({
        name: property.name,
        description: property.description,
        area: property.area,
        city: property.city,
        address: property.address,
        price_per_night: property.price_per_night,
        amenities: property.amenities,
        max_guests: property.max_guests,
        check_in_time: property.check_in_time,
        check_out_time: property.check_out_time,
        house_rules: property.house_rules,
        rooms: ((property as any).rooms || []).map((r: any) => ({
            id: r.id,
            name: r.name,
            price: r.price_per_night || property.price_per_night,
            max_guests: r.max_guests,
            description: r.description,
        })),
    });
}

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
    switch (name) {
        case 'search_properties':
            return executeSearchProperties(args);
        case 'check_availability':
            return executeCheckAvailability(args);
        case 'create_booking':
            return executeCreateBooking(args);
        case 'get_property_details':
            return executeGetPropertyDetails(args);
        default:
            return `Unknown tool: ${name}`;
    }
}

// Main AI message handler with 1-minute batching
export const aiMessageReceived = inngest.createFunction(
    {
        id: 'ai-message-received',
        name: 'AI Message Received',
        debounce: {
            key: 'event.data.conversationId',
            period: '1m', // Wait 1 minute for additional messages
        },
    },
    { event: 'ai/message.received' },
    async ({ event, step }) => {
        const { conversationId, message, senderPhone, senderName, channel, externalId } = event.data;

        const supabase = createServerClient();

        // Step 1: Get or create conversation
        const conversation = await step.run('get-conversation', async () => {
            if (conversationId) {
                const { data } = await supabase
                    .from('conversations')
                    .select('*')
                    .eq('id', conversationId)
                    .single();

                if (data) return data;
            }

            // Find by external_id or phone
            if (externalId) {
                const { data } = await supabase
                    .from('conversations')
                    .select('*')
                    .eq('external_id', externalId)
                    .single();

                if (data) return data;
            }

            if (senderPhone) {
                const { data } = await supabase
                    .from('conversations')
                    .select('*')
                    .eq('guest_phone', senderPhone)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (data) return data;
            }

            // Create new conversation
            const { data: newConv } = await supabase
                .from('conversations')
                .insert({
                    channel: channel || 'whatsapp',
                    external_id: externalId,
                    guest_name: senderName,
                    guest_phone: senderPhone,
                    messages: [],
                    context: {},
                })
                .select()
                .single();

            return newConv;
        });

        if (!conversation) throw new Error('Failed to get/create conversation');

        // Step 2: Add user message to history
        const updatedMessages = await step.run('add-message', async () => {
            const messages = (conversation.messages as any[]) || [];
            messages.push({
                role: 'user',
                content: message,
                timestamp: new Date().toISOString(),
            });

            await supabase
                .from('conversations')
                .update({
                    messages,
                    last_message_at: new Date().toISOString(),
                    guest_name: senderName || conversation.guest_name,
                })
                .eq('id', conversation.id);

            return messages;
        });

        // Step 3: Generate AI response with Gemini
        const aiResponse = await step.run('generate-response', async () => {
            // Build conversation history for Gemini
            const chatHistory = updatedMessages.map((msg: any) => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }],
            }));

            // Remove the last user message (we'll send it separately)
            const lastMessage = chatHistory.pop();

            const chat = genAI.chats.create({
                model: 'gemini-2.5-flash',
                config: {
                    systemInstruction: SYSTEM_PROMPT,
                    tools: [{
                        functionDeclarations: tools as unknown as FunctionDeclaration[],
                    }],
                },
                history: chatHistory,
            });

            let response = await chat.sendMessage({
                message: lastMessage!.parts[0].text,
            });

            // Handle function calls (tool use)
            let maxIterations = 5;
            while (maxIterations > 0) {
                const candidate = response.candidates?.[0];
                const parts = candidate?.content?.parts || [];

                const functionCalls = parts.filter((p: any) => p.functionCall);
                if (functionCalls.length === 0) break;

                // Execute all function calls
                const functionResponses = [];
                for (const part of functionCalls) {
                    const fc = (part as any).functionCall;
                    const result = await executeTool(fc.name, fc.args);
                    functionResponses.push({
                        functionResponse: {
                            name: fc.name,
                            response: { result },
                        },
                    });
                }

                // Send function results back to Gemini
                response = await chat.sendMessage({
                    message: functionResponses,
                });

                maxIterations--;
            }

            // Extract text response
            const responseText = response.candidates?.[0]?.content?.parts
                ?.filter((p: any) => p.text)
                ?.map((p: any) => p.text)
                ?.join('\n') || 'Sorry, I couldn\'t process your request. Please try again.';

            return responseText;
        });

        // Step 4: Save AI response to conversation
        await step.run('save-response', async () => {
            const messages = updatedMessages;
            messages.push({
                role: 'assistant',
                content: aiResponse,
                timestamp: new Date().toISOString(),
            });

            await supabase
                .from('conversations')
                .update({ messages })
                .eq('id', conversation.id);
        });

        // Step 5: Send response back via ManyChat
        await step.run('send-reply', async () => {
            const manychatApiKey = process.env.MANYCHAT_API_KEY;
            if (!manychatApiKey || !conversation.external_id) {
                console.log('ManyChat not configured or no external_id — response logged only');
                return { sent: false };
            }

            try {
                await fetch('https://api.manychat.com/fb/sending/sendContent', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${manychatApiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        subscriber_id: conversation.external_id,
                        data: {
                            version: 'v2',
                            content: {
                                messages: [{ type: 'text', text: aiResponse }],
                            },
                        },
                    }),
                });

                return { sent: true };
            } catch (error) {
                console.error('Failed to send ManyChat reply:', error);
                return { sent: false, error: String(error) };
            }
        });

        return {
            conversationId: conversation.id,
            response: aiResponse,
        };
    }
);
