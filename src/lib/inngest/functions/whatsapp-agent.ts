import { inngest } from '@/lib/inngest/client';
import { createClient } from '@supabase/supabase-js';
import { whatsapp } from '@/lib/whatsapp/client';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { addDays, format } from 'date-fns';

// Initialize Supabase Client (Service Role for backend ops)
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://9jarooms.com';
const HUMAN_HANDOFF_NUMBER = '09067779344';

// ============================================
// TOOL DEFINITIONS FOR GEMINI
// ============================================
const tools: any[] = [
    {
        functionDeclarations: [
            {
                name: 'search_properties',
                description: 'Search for available properties/apartments. Call this when the user wants to find or see properties. Returns a list of matching properties with links.',
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        area: {
                            type: SchemaType.STRING,
                            description: 'Area/neighborhood to search in (e.g. Maitama, Wuse II, Asokoro, Gwarinpa). Optional.',
                        },
                        max_price: {
                            type: SchemaType.NUMBER,
                            description: 'Maximum price per night in Naira. Optional.',
                        },
                        min_price: {
                            type: SchemaType.NUMBER,
                            description: 'Minimum price per night in Naira. Optional.',
                        },
                        max_guests: {
                            type: SchemaType.NUMBER,
                            description: 'Minimum number of guests the property should accommodate. Optional.',
                        },
                    },
                },
            },
            {
                name: 'check_availability',
                description: 'Check if a specific property/room is available for given dates. Call this when the user wants to book specific dates.',
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        property_id: {
                            type: SchemaType.STRING,
                            description: 'The property ID to check.',
                        },
                        check_in: {
                            type: SchemaType.STRING,
                            description: 'Check-in date in YYYY-MM-DD format.',
                        },
                        check_out: {
                            type: SchemaType.STRING,
                            description: 'Check-out date in YYYY-MM-DD format.',
                        },
                    },
                    required: ['property_id', 'check_in', 'check_out'],
                },
            },
            {
                name: 'create_booking',
                description: 'Create a booking and generate a payment link. Only call this when you have ALL required info: property_id, room_id, check_in, check_out, guest_name, guest_email, guest_phone.',
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        property_id: {
                            type: SchemaType.STRING,
                            description: 'Property ID',
                        },
                        room_id: {
                            type: SchemaType.STRING,
                            description: 'Room ID',
                        },
                        check_in: {
                            type: SchemaType.STRING,
                            description: 'Check-in date YYYY-MM-DD',
                        },
                        check_out: {
                            type: SchemaType.STRING,
                            description: 'Check-out date YYYY-MM-DD',
                        },
                        guest_name: {
                            type: SchemaType.STRING,
                            description: 'Guest full name',
                        },
                        guest_email: {
                            type: SchemaType.STRING,
                            description: 'Guest email address',
                        },
                        guest_phone: {
                            type: SchemaType.STRING,
                            description: 'Guest phone number',
                        },
                    },
                    required: ['property_id', 'room_id', 'check_in', 'check_out', 'guest_name', 'guest_email', 'guest_phone'],
                },
            },
            {
                name: 'get_property_details',
                description: 'Get full details of a specific property including rooms, prices, amenities, and a link to view it.',
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        property_id: {
                            type: SchemaType.STRING,
                            description: 'The property ID to get details for.',
                        },
                    },
                    required: ['property_id'],
                },
            },
            {
                name: 'handoff_to_human',
                description: 'Transfer the conversation to a human agent. Call this when you cannot help the user, when they have a complaint, or when the request is too complex.',
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        reason: {
                            type: SchemaType.STRING,
                            description: 'Reason for handoff',
                        },
                    },
                    required: ['reason'],
                },
            },
        ],
    },
];

// ============================================
// TOOL IMPLEMENTATIONS
// ============================================
async function executeSearchProperties(args: any) {
    let query = supabase
        .from('properties')
        .select('id, name, area, city, price_per_night, max_guests, amenities, images, address')
        .eq('is_active', true);

    if (args.area) {
        query = query.ilike('area', `%${args.area}%`);
    }
    if (args.max_price) {
        query = query.lte('price_per_night', args.max_price);
    }
    if (args.min_price) {
        query = query.gte('price_per_night', args.min_price);
    }
    if (args.max_guests) {
        query = query.gte('max_guests', args.max_guests);
    }

    const { data: properties, error } = await query.limit(5);

    if (error || !properties || properties.length === 0) {
        return { found: false, message: 'No properties found matching your criteria.' };
    }

    return {
        found: true,
        count: properties.length,
        properties: properties.map((p, i) => ({
            number: i + 1,
            id: p.id,
            name: p.name,
            area: p.area,
            city: p.city,
            price_per_night: p.price_per_night,
            max_guests: p.max_guests,
            amenities: (p.amenities || []).slice(0, 5),
            link: `${APP_URL}/property/${p.id}`,
        })),
    };
}

async function executeCheckAvailability(args: any) {
    const { property_id, check_in, check_out } = args;

    // Validate dates
    const checkInDate = new Date(check_in);
    const checkOutDate = new Date(check_out);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkInDate < today) {
        return { available: false, reason: 'Check-in date must be today or in the future.' };
    }
    if (checkOutDate <= checkInDate) {
        return { available: false, reason: 'Check-out date must be after check-in date.' };
    }

    // Get rooms for this property
    const { data: rooms } = await supabase
        .from('rooms')
        .select('id, name, price_per_night, max_guests')
        .eq('property_id', property_id)
        .eq('is_active', true);

    if (!rooms || rooms.length === 0) {
        return { available: false, reason: 'No rooms found for this property.' };
    }

    // Generate date range
    const dates: string[] = [];
    let current = new Date(checkInDate);
    while (current < checkOutDate) {
        dates.push(format(current, 'yyyy-MM-dd'));
        current = addDays(current, 1);
    }
    const nightCount = dates.length;

    // Check availability for each room
    const availableRooms = [];
    for (const room of rooms) {
        const { data: unavailable } = await supabase
            .from('availability')
            .select('date')
            .eq('room_id', room.id)
            .in('date', dates)
            .neq('status', 'available');

        if (!unavailable || unavailable.length === 0) {
            const pricePerNight = room.price_per_night || 0;
            availableRooms.push({
                room_id: room.id,
                room_name: room.name,
                price_per_night: pricePerNight,
                max_guests: room.max_guests,
                total_price: pricePerNight * nightCount,
                nights: nightCount,
            });
        }
    }

    if (availableRooms.length > 0) {
        return {
            available: true,
            property_id,
            check_in,
            check_out,
            nights: nightCount,
            available_rooms: availableRooms,
            next_step: 'Ask the guest if they want to book. If yes, collect their full name, email, and phone number, then call create_booking with the room_id from available_rooms.',
        };
    }

    // === DATES NOT AVAILABLE — Find alternatives ===

    // 1. Find nearby available dates for this property (check +/- 7 days)
    const nearbyDates: { check_in: string; check_out: string; room_name: string; room_id: string; total_price: number }[] = [];
    for (const room of rooms) {
        for (let offset = 1; offset <= 7; offset++) {
            for (const direction of [1, -1]) {
                const altCheckIn = addDays(checkInDate, offset * direction);
                const altCheckOut = addDays(altCheckIn, nightCount);
                if (altCheckIn < today) continue;

                const altDates: string[] = [];
                let d = new Date(altCheckIn);
                while (d < altCheckOut) {
                    altDates.push(format(d, 'yyyy-MM-dd'));
                    d = addDays(d, 1);
                }

                const { data: blocked } = await supabase
                    .from('availability')
                    .select('date')
                    .eq('room_id', room.id)
                    .in('date', altDates)
                    .neq('status', 'available');

                if (!blocked || blocked.length === 0) {
                    nearbyDates.push({
                        check_in: format(altCheckIn, 'yyyy-MM-dd'),
                        check_out: format(altCheckOut, 'yyyy-MM-dd'),
                        room_name: room.name,
                        room_id: room.id,
                        total_price: (room.price_per_night || 0) * nightCount,
                    });
                    break; // Found one for this direction, move on
                }
            }
        }
        if (nearbyDates.length >= 3) break; // Enough alternatives
    }

    // 2. Find other properties available for the same dates
    const { data: otherProperties } = await supabase
        .from('properties')
        .select('id, name, area, city, price_per_night')
        .eq('is_active', true)
        .neq('id', property_id)
        .limit(5);

    const alternativeProperties: any[] = [];
    if (otherProperties) {
        for (const prop of otherProperties) {
            const { data: propRooms } = await supabase
                .from('rooms')
                .select('id, name, price_per_night')
                .eq('property_id', prop.id)
                .eq('is_active', true)
                .limit(1);

            if (propRooms && propRooms.length > 0) {
                const { data: blocked } = await supabase
                    .from('availability')
                    .select('date')
                    .eq('room_id', propRooms[0].id)
                    .in('date', dates)
                    .neq('status', 'available');

                if (!blocked || blocked.length === 0) {
                    alternativeProperties.push({
                        property_id: prop.id,
                        name: prop.name,
                        area: prop.area,
                        price_per_night: propRooms[0].price_per_night || prop.price_per_night,
                        total_price: (propRooms[0].price_per_night || prop.price_per_night || 0) * nightCount,
                        link: `${APP_URL}/property/${prop.id}`,
                    });
                }
            }
            if (alternativeProperties.length >= 3) break;
        }
    }

    return {
        available: false,
        reason: `This property is not available from ${check_in} to ${check_out}.`,
        nearby_available_dates: nearbyDates.length > 0 ? nearbyDates : null,
        alternative_properties: alternativeProperties.length > 0 ? alternativeProperties : null,
        suggestion: nearbyDates.length > 0
            ? 'Suggest the nearby dates to the guest. If they prefer, offer the alternative properties.'
            : alternativeProperties.length > 0
                ? 'Suggest these alternative properties that are available for their dates.'
                : 'No alternatives found nearby. Ask if they want to try completely different dates or a different area.',
    };
}

async function executeCreateBooking(args: any) {
    const { property_id, room_id, check_in, check_out, guest_name, guest_email, guest_phone, whatsapp_user_phone } = args;

    console.log(`[WhatsApp Booking] Calling /api/bookings: property=${property_id}, room=${room_id}, dates=${check_in} to ${check_out}, guest=${guest_name}, booker=${whatsapp_user_phone}`);

    try {
        // Call the existing booking API — same code path as website bookings
        const response = await fetch(`${APP_URL}/api/bookings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roomId: room_id,
                propertyId: property_id,
                guestName: guest_name,
                guestEmail: guest_email,
                guestPhone: guest_phone,
                whatsappUserPhone: whatsapp_user_phone, // Pass the sender's phone
                checkIn: check_in,
                checkOut: check_out,
            }),
        });

        const result = await response.json();

        if (!response.ok) {
            console.error(`[WhatsApp Booking] API error (${response.status}):`, result);
            return {
                success: false,
                reason: result.error || 'Failed to create booking. Please try again.',
            };
        }

        console.log(`[WhatsApp Booking] SUCCESS: booking=${result.bookingId}, reference=${result.reference}`);

        // Get property name for the response
        const { data: property } = await supabase
            .from('properties')
            .select('name')
            .eq('id', property_id)
            .single();

        const { data: room } = await supabase
            .from('rooms')
            .select('name, price_per_night')
            .eq('id', room_id)
            .single();

        return {
            success: true,
            booking_id: result.bookingId,
            payment_link: result.paystackUrl,
            reference: result.reference,
            property_name: property?.name || 'Property',
            room_name: room?.name || 'Room',
            expires_in_minutes: 30,
        };
    } catch (err: any) {
        console.error('[WhatsApp Booking] Error:', err?.message || err);
        return {
            success: false,
            reason: 'Booking system temporarily unavailable. Please try again or book on our website.',
        };
    }
}

async function executeGetPropertyDetails(args: any) {
    const { property_id } = args;

    const { data: property } = await supabase
        .from('properties')
        .select('*, rooms(*)')
        .eq('id', property_id)
        .single();

    if (!property) return { found: false, message: 'Property not found.' };

    return {
        found: true,
        id: property.id,
        name: property.name,
        description: property.description,
        area: property.area,
        city: property.city,
        address: property.address,
        price_per_night: property.price_per_night,
        max_guests: property.max_guests,
        amenities: property.amenities || [],
        check_in_time: property.check_in_time,
        check_out_time: property.check_out_time,
        house_rules: property.house_rules,
        rooms: ((property as any).rooms || []).map((r: any) => ({
            id: r.id,
            name: r.name,
            price_per_night: r.price_per_night,
            max_guests: r.max_guests,
        })),
        link: `${APP_URL}/property/${property.id}`,
    };
}

function executeHandoffToHuman(args: any) {
    return {
        handoff: true,
        message: `I understand this needs special attention. Please contact our team directly at ${HUMAN_HANDOFF_NUMBER} and they will assist you personally. You can also send a WhatsApp message to that number.`,
        reason: args.reason,
    };
}

function getSystemPrompt() {
    const now = new Date();
    const currentDate = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const currentTime = now.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' });
    return `# 9jaRooms - Core Agent Prompt v3

**Role & Persona**
Your name is Mary. You are a real employee working for 9jaRooms on WhatsApp helping guests find and book serviced apartments in Abuja. You sound like a normal, friendly person texting - not a bot, not a script, not a customer service bot. Keep your messages short. One to two sentences max per message unless you're confirming a booking. Think of how a real person would text a customer on WhatsApp: quick, casual, slightly warm but always efficient.

**Example Greeting:**
> Hello! Welcome to 9jaRooms. I'm Mary, here to help you find a place in Abuja today.

**Tone Rules:**
- Short and direct. No essays.
- Slightly friendly but professional. Not overly enthusiastic.
- Never explain things the customer didn't ask about.
- Never say "Sure!", "Absolutely!", "Of course!" or any robotic filler.
- **CRITICAL: NEVER use emojis.** Not one. Your professionalism comes from your words.
- Never reveal you are an AI, a language model, or created by anyone. You are the staff member named Mary.

**Formatting Rules**
- Bold totals and key items (e.g., **Total: ₦45,000/night**).
- Use short lists only for property summaries.
- Keep everything scannable for WhatsApp.

**Data & Context**
TODAY'S DATE: ${currentDate}
CURRENT TIME (WAT): ${currentTime}
ALWAYS use this date/time as your reference. When a guest says "the 14th" or "next Friday", calculate the actual date from today. If no year is specified, assume ${now.getFullYear()} — or next year if the date has already passed.

**Core Rules**
1. **Be brief.** If it can be said in one line, say it in one line.
2. **Never break character.** You are Mary from 9jaRooms.
3. **Only sell what's available.** If a property is not available or doesn't exist in the search, say it's unavailable and suggest something close.
4. **Always move forward.** Every message should push toward placing the booking.
5. **Never guess or make up prices.** Only share numbers that come from your tools.
6. **Never say a booking is confirmed without actually calling 'create_booking'.**
7. **Punctuation & Formatting:** Never use em-dashes. Use only standard punctuation. No emojis.
8. **CRITICAL GUARDRAIL:** We DO NOT offer cancellations, refunds, or modifications. If a guest asks, politely decline and state that all bookings are final. Do NOT invent policies, features, or services we don't have.
9. **ALWAYS RESPOND WITH TEXT:** Every time you receive a message or a tool result, you MUST output a text message formatting the result for the user. Never output an empty text. If a user asks for a link, and you are missing details, ask for the details explicitly!

**The Booking Flow**

1. **Greeting:** Short and warm. Wait for them to tell you what they need, or if they ask a very generic question like "what do you have available" or "show me apartments", DO NOT interrogate them. Do NOT respond with a list of questions asking for their budget, location, and headcount. Instead, IMMEDIATELY call 'search_properties' without any arguments, and show them 2-3 random lovely options to get the conversation started.

2. **Search and share options:** Use 'search_properties' based on their location, budget, or dates. Include the link to each property at ${APP_URL}/property/[id] so they can see photos and details. Keep descriptions conversational.

3. **Check Availability:** Once they pick a property or mention specific dates, use 'check_availability'. If it's taken, the system gives you nearby dates and alternative properties — share those right away. Something like "That one's booked for those dates, but it opens up on the 15th. Or there's a similar place in Gwarinpa that's free — want me to send the details?"

4. **Collect Details:** After availability is confirmed and they say yes/proceed, ask for their details in a single message:
   - Full Name
   - Phone Number
   - Email Address
   Casual phrasing: "Perfect! Before I generate your payment link, I'll just need your full name, phone number, and email."

5. **Final confirmation + payment link:** Once you have their details, IMMEDIATELY call the 'create_booking' tool. Do NOT ask "shall I generate the link?" - just do it. Pass the property_id, room_id, check_in, check_out, guest_name, guest_email, guest_phone to the tool.

6. **Send the link:** The 'create_booking' tool returns a payment link. Give them the link and let them know: "You've got 30 minutes to pay using this link. Once your payment goes through, you'll get a confirmation email with check-in details. You're all set!"

**Handling Edge Cases**
- **Non-booking queries / Complaints:** If a customer has a complaint or a problem you can't handle, use the 'handoff_to_human' tool to connect them with a real person at ${HUMAN_HANDOFF_NUMBER}. Let them know someone will reach out.
- **Property unavailable:** "That one's not available right now. We do have [alternative] though - want to look at that?"
- **Property Details:** Use 'get_property_details' only when someone asks for more info on a specific place.
- **Off-topic chat:** Gently steer back. "Haha, good one. So - any specific area in Abuja you're looking at?"

**Your Tools**
- search_properties: Find apartments by location, budget, guest count. Use when someone asks what's available.
- check_availability: Check if a property is free for specific dates. If it's not, you'll get alternatives back automatically.
- get_property_details: Pull up full details on a property.
- create_booking: Make a booking and generate a payment link. Only call this once you have everything: property_id, room_id, check_in, check_out, guest_name, guest_email, guest_phone.
- handoff_to_human: Pass the conversation to a human. Use for complaints, disputes, or anything beyond your scope.
`;
}

// ============================================
// INNGEST FUNCTIONS
// ============================================

// Function 1: Buffer incoming messages (fast, lightweight)
export const whatsappMessageBuffer = inngest.createFunction(
    { id: 'whatsapp-message-buffer' },
    { event: 'whatsapp.message.received' },
    async ({ event, step }) => {
        const { from, text, contactName, messageId } = event.data;

        // Save the message to DB immediately
        await step.run('save-and-buffer', async () => {
            // Get or create conversation
            let { data: convo } = await supabase
                .from('conversations')
                .select('id')
                .eq('whatsapp_id', from)
                .single();

            if (!convo) {
                const { data: newConvo } = await supabase
                    .from('conversations')
                    .insert({
                        whatsapp_id: from,
                        user_name: contactName,
                        status: 'active',
                        stage: 'idle',
                        guest_phone: from,
                    })
                    .select('id')
                    .single();
                convo = newConvo;
            }

            if (!convo) throw new Error('Failed to get/create conversation');

            // Save message as unprocessed
            await supabase.from('messages').insert({
                conversation_id: convo.id,
                role: 'user',
                content: text?.substring(0, 500) || '', // Max 500 chars guardrail
                processed: false,
            });

            // Mark as read
            try {
                await whatsapp.markAsRead(messageId);
            } catch (e) {
                // Non-critical, don't fail
            }
        });

        // Trigger the debounced processor
        await step.sendEvent('trigger-processor', {
            name: 'whatsapp.message.process',
            data: { phone: from, contactName },
        });

        return { buffered: true };
    }
);

// Function 2: Process messages with 30s debounce
export const whatsappMessageProcessor = inngest.createFunction(
    {
        id: 'whatsapp-message-processor',
        // Cancel previous pending runs for the same phone number
        cancelOn: [
            {
                event: 'whatsapp.message.process',
                match: 'data.phone',
            },
        ],
    },
    { event: 'whatsapp.message.process' },
    async ({ event, step }) => {
        const { phone, contactName } = event.data;

        // Debounce wait to buffer multiple concurrent texts before replying
        await step.sleep('debounce-wait', '15s');

        // Get conversation
        const conversation = await step.run('get-conversation', async () => {
            const { data: convo } = await supabase
                .from('conversations')
                .select('*')
                .eq('whatsapp_id', phone)
                .single();
            return convo;
        });

        if (!conversation) return { error: 'No conversation found' };

        // Collect all unprocessed messages
        const userMessages = await step.run('collect-messages', async () => {
            const { data: messages } = await supabase
                .from('messages')
                .select('id, content')
                .eq('conversation_id', conversation.id)
                .eq('role', 'user')
                .eq('processed', false)
                .order('created_at', { ascending: true });

            if (messages && messages.length > 0) {
                // Mark as processed
                await supabase
                    .from('messages')
                    .update({ processed: true })
                    .in('id', messages.map(m => m.id));
            }

            return messages || [];
        });

        if (userMessages.length === 0) return { skipped: true, reason: 'No unprocessed messages' };

        // Combine all messages into one
        const combinedMessage = userMessages.map(m => m.content).join('\n');

        // Rate limiting: check messages in the last hour
        const rateLimitOk = await step.run('rate-limit-check', async () => {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            const { count } = await supabase
                .from('messages')
                .select('id', { count: 'exact', head: true })
                .eq('conversation_id', conversation.id)
                .eq('role', 'user')
                .gte('created_at', oneHourAgo);

            return (count || 0) <= 30; // Max 30 messages per hour
        });

        if (!rateLimitOk) {
            await step.run('send-rate-limit', async () => {
                await whatsapp.sendMessage(phone,
                    "You're sending too many messages. Please wait a moment and try again. If you need immediate help, call " + HUMAN_HANDOFF_NUMBER
                );
            });
            return { rateLimited: true };
        }

        // Generate AI Response with function calling
        const aiResponse = await step.run('generate-ai-response', async () => {
            // Fetch last 20 messages for context
            const { data: history } = await supabase
                .from('messages')
                .select('role, content')
                .eq('conversation_id', conversation.id)
                .order('created_at', { ascending: true })
                .limit(20);

            const model = genAI.getGenerativeModel({
                model: 'gemini-3-flash-preview',
                tools,
                systemInstruction: getSystemPrompt(),
            });

            const chat = model.startChat({
                history: (history || [])
                    .filter(m => m.content && m.content.trim() !== '')
                    .slice(0, -userMessages.length) // Exclude the messages we're about to send
                    .map(m => ({
                        role: m.role === 'user' ? 'user' : 'model',
                        parts: [{ text: m.content }],
                    })),
                generationConfig: {
                    maxOutputTokens: 1024,
                },
            });

            // Send the combined user message
            let result = await chat.sendMessage(combinedMessage);
            let response = result.response;

            // Handle function calls (may need multiple rounds)
            let maxIterations = 5;
            let lastToolResult: any = null;
            let lastToolName: string = '';

            while (maxIterations > 0) {
                const functionCalls = response.functionCalls();
                if (!functionCalls || functionCalls.length === 0) break;

                console.log(`[WhatsApp AI] Function calls requested: ${functionCalls.map(c => c.name).join(', ')}`);

                // Execute each function call
                const functionResponses = [];
                for (const call of functionCalls) {
                    let toolResult;
                    console.log(`[WhatsApp AI] Executing tool: ${call.name}`, JSON.stringify(call.args));
                    try {
                        switch (call.name) {
                            case 'search_properties':
                                toolResult = await executeSearchProperties(call.args);
                                break;
                            case 'check_availability':
                                toolResult = await executeCheckAvailability(call.args);
                                break;
                            case 'create_booking':
                                // Inject the sender's phone number as the booker
                                toolResult = await executeCreateBooking({ ...call.args, whatsapp_user_phone: phone });
                                break;
                            case 'get_property_details':
                                toolResult = await executeGetPropertyDetails(call.args);
                                break;
                            case 'handoff_to_human':
                                toolResult = executeHandoffToHuman(call.args);
                                break;
                            default:
                                toolResult = { error: 'Unknown function' };
                        }
                    } catch (err) {
                        console.error(`[WhatsApp AI] Tool ${call.name} error:`, err);
                        toolResult = { error: `Tool failed: ${String(err)}` };
                    }

                    console.log(`[WhatsApp AI] Tool ${call.name} result:`, JSON.stringify(toolResult).substring(0, 500));

                    functionResponses.push({
                        functionResponse: {
                            name: call.name,
                            response: toolResult,
                        },
                    });
                    
                    lastToolName = call.name;
                    lastToolResult = toolResult;
                }

                // Send function results back to Gemini
                result = await chat.sendMessage(functionResponses);
                response = result.response;
                maxIterations--;
            }

            try {
                const text = response.text();
                if (!text || text.trim() === '') {
                    throw new Error("Empty text response after tool execution loop.");
                }
                return text;
            } catch (err) {
                console.error('[WhatsApp AI] Error extracting final text response:', err);
                
                // Smart Fallbacks based on the invoked tool
                if (lastToolName === 'create_booking') {
                    if (lastToolResult?.success && lastToolResult?.payment_link) {
                        return `Here is your payment link! You have 30 minutes to complete the booking: ${lastToolResult.payment_link}`;
                    }
                    return lastToolResult?.reason || "I need your full name, email, and phone number before I can generate that link for you!";
                }
                if (lastToolName === 'check_availability') {
                    if (lastToolResult?.available) {
                         return "Yes, those dates are available! Let me know your full name, email, and phone number and we can book it now.";
                    }
                    return lastToolResult?.reason || "That property isn't available for those dates. Let me know if you want to try different dates!";
                }
                if (lastToolName === 'search_properties') {
                    return lastToolResult?.message || "I found some great properties for you. Just let me know which one you like!";
                }
                
                return "I received your message, could you provide more details?";
            }
        });

        // Send response via WhatsApp
        await step.run('send-whatsapp', async () => {
            if (!aiResponse || aiResponse.trim().length === 0) {
                console.warn('[WhatsApp AI] Empty response from AI, skipping message send.');
                return;
            }

            // Split long messages (WhatsApp limit is ~4096 chars)
            if (aiResponse.length > 4000) {
                const parts = aiResponse.match(/[\s\S]{1,4000}/g) || [aiResponse];
                for (const part of parts) {
                    await whatsapp.sendMessage(phone, part);
                }
            } else {
                await whatsapp.sendMessage(phone, aiResponse);
            }
        });

        // Save AI response
        await step.run('save-ai-message', async () => {
            await supabase.from('messages').insert({
                conversation_id: conversation.id,
                role: 'assistant',
                content: aiResponse,
                processed: true,
            });
        });

        return { success: true, messageCount: userMessages.length, responseLength: aiResponse.length };
    }
);
