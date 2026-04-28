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

// Force frontend links to always use the real domain
const FRONTEND_URL = 'https://9jarooms.com';

function getAppUrl() {
    let url = process.env.NEXT_PUBLIC_APP_URL || 'https://9jarooms.com';
    if (url.includes('ngrok')) return 'https://9jarooms.com'; // Bypass accidental ngrok leaks in production
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`; // Fix Vercel configs missing protocols (prevents Node fetch "failed to parse URL" crash)
    }
    return url;
}
const APP_URL = getAppUrl();
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
            link: `${FRONTEND_URL}/property/${p.id}`,
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
                        room_id: propRooms[0].id,
                        name: prop.name,
                        area: prop.area,
                        price_per_night: propRooms[0].price_per_night || prop.price_per_night,
                        total_price: (propRooms[0].price_per_night || prop.price_per_night || 0) * nightCount,
                        link: `${FRONTEND_URL}/property/${prop.id}`,
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
        // Prepare autofills in case Gemini fails to completely extract contact details
        const safeGuestName = guest_name && guest_name.trim() !== '' ? guest_name : 'WhatsApp Guest';
        const safeGuestEmail = guest_email && guest_email.trim() !== '' ? guest_email : `${whatsapp_user_phone.replace('+', '')}@whatsapp.9jarooms.com`;
        const safeGuestPhone = guest_phone && guest_phone.trim() !== '' ? guest_phone : whatsapp_user_phone;

        // Call the existing booking API — same code path as website bookings
        const response = await fetch(`${APP_URL}/api/bookings`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-internal-secret': process.env.SUPABASE_SERVICE_ROLE_KEY! 
            },
            body: JSON.stringify({
                roomId: room_id,
                propertyId: property_id,
                guestName: safeGuestName,
                guestEmail: safeGuestEmail,
                guestPhone: safeGuestPhone,
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
                reason: `Our system encountered an error: ${result.error || 'Unknown'}. If you haven't provided all details, please let me know your full name and email so I can fix it!`,
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
        const errorMsg = err?.message || err;
        console.error('[WhatsApp Booking] Error:', errorMsg);
        return {
            success: false,
            reason: `System error (${errorMsg}). Please tell the user exactly this error so my developer can fix it. Also provide the website link: ${FRONTEND_URL}/property/${property_id}`,
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
        link: `${FRONTEND_URL}/property/${property.id}`,
    };
}

// Removed executeHandoffToHuman

function getSystemPrompt() {
    const now = new Date();
    const currentDate = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const currentTime = now.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' });
    return `# 9jaRooms - Core Agent Prompt v4

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

**Conversation Continuity**
You may see session gap notes in the conversation history showing how much time has passed between messages. Use YOUR JUDGMENT based on the guest's actual message to decide whether this is a new conversation or a continuation:

- **New conversation signals:** Generic greetings like "Hello", "Hi", "Good morning", or unrelated topics. In this case, greet them warmly ("Hey again! What can I help with today?") and let them lead. Do NOT bring up old topics.
- **Continuation signals:** The guest references a specific property, dates, booking, or picks up mid-flow (e.g. "What about April 6-13?", "I'll take the Wuse one", "Here's my email"). In this case, continue naturally as if no time has passed.
- **Ambiguous:** If you're unsure, default to a light re-greeting like "Hey! Still looking at places in Abuja?" — this lets them either continue or start fresh.

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
10. **ALWAYS FORMAT SEARCH RESULTS:** When 'search_properties' returns results, you MUST list each property with its name, area, price, and link. NEVER say "I found properties" without listing them. If the tool returns no results, say so clearly.

**The Booking Flow**

1. **Greeting:** Short and warm. Wait for them to tell you what they need. If they ask a very generic question like "what do you have available" or "show me apartments", DO NOT interrogate them with questions about budget, location, and headcount. Instead, IMMEDIATELY call 'search_properties' without any arguments and show them 2-3 options to get the conversation started.

2. **Search and share options:** Use 'search_properties' based on their location, budget, or dates. For EACH property in the results, include the name, area, price per night, and the link to ${FRONTEND_URL}/property/[id]. Keep it scannable.

3. **Date & Availability Check (IMPORTANT - follow this exact flow):**
   Once they pick a property or ask about dates, use 'check_availability' to check their requested dates.

   a. **If AVAILABLE:** Tell them it's available with the total price. Then ask for their booking details (name, email, phone).

   b. **If NOT AVAILABLE - Step 1 (Show available dates for THIS property):**
      The check_availability tool returns 'nearby_available_dates' - these are dates close to what they asked for that ARE available on this same property. Tell the guest:
      "That property isn't free for [their dates], but it's available from [date] to [date]. Do those dates work for you?"

   c. **If NOT AVAILABLE - Step 2 (Same area alternatives):**
      If the guest says the alternative dates don't work for them, ask: "Would you like to see other stays we have in [same area]?"
      If they say yes, call 'search_properties' with the area filter set to the same area, then for each result call 'check_availability' with their original dates to confirm availability. Only show them properties that are actually available for their dates.

   d. **If NOT AVAILABLE - Step 3 (Nearby areas):**
      If nothing is available in the same area for their dates, list 2-3 nearby areas where we have properties. For example: "We don't have anything in Wuse for those dates, but we have great stays in Maitama, Jabi, and Asokoro. Want me to check any of those?"
      Once they pick an area, search that area and check availability, then show the results.

   **KEY RULE:** Always exhaust each step before moving to the next. Don't skip straight to "try different dates or another area" - guide them through the options one step at a time.

4. **Collect Details:** After availability is confirmed and they say yes/proceed, ask for their details in a single message:
   - Full Name
   - Phone Number
   - Email Address
   Casual phrasing: "Perfect! Before I generate your payment link, I'll just need your full name, phone number, and email."

5. **Final confirmation + payment link:** Once you have their details, IMMEDIATELY call the 'create_booking' tool. Do NOT ask "shall I generate the link?" - just do it. Pass the property_id, room_id, check_in, check_out, guest_name, guest_email, guest_phone to the tool.

6. **Send the link:** The 'create_booking' tool returns a payment link. Give them the link and let them know: "You've got 30 minutes to pay using this link. Once your payment goes through, you'll get a confirmation email with check-in details. You're all set!"

**Handling Edge Cases**
- **Property unavailable:** Follow the 3-step availability flow above. Do NOT jump straight to suggesting random alternatives.
- **Property Details:** Use 'get_property_details' only when someone asks for more info on a specific place.
- **Off-topic chat:** Gently steer back. "Haha, good one. So - any specific area in Abuja you're looking at?"
- **Errors:** If you encounter an error calling a tool or missing details, EXPLAIN the specific error back to the user and ask them for the missing details. You MUST resolve issues yourself. Do not pass them to human support.

**Your Tools**
- search_properties: Find apartments by location, budget, guest count. Use when someone asks what's available.
- check_availability: Check if a property is free for specific dates. Returns nearby_available_dates and alternative_properties when unavailable.
- get_property_details: Pull up full details on a property.
- create_booking: Make a booking and generate a payment link. Only call this once you have everything: property_id, room_id, check_in, check_out, guest_name, guest_email, guest_phone.
`;
}

// ============================================
// INNGEST FUNCTIONS
// ============================================

// Function 1: Buffer incoming messages (fast, lightweight)
export const whatsappMessageBuffer = (inngest as any).createFunction(
    { 
        id: 'whatsapp-message-buffer',
        triggers: { event: 'whatsapp.message.received' },
    },
    async ({ event, step }: any) => {
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
export const whatsappMessageProcessor = (inngest as any).createFunction(
    {
        id: 'whatsapp-message-processor',
        triggers: { event: 'whatsapp.message.process' },
        // Cancel previous pending runs for the same phone number
        cancelOn: [
            {
                event: 'whatsapp.message.process',
                match: 'data.phone',
            },
        ],
    },
    async ({ event, step }: any) => {
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
                    .in('id', messages.map((m: any) => m.id));
            }

            return messages || [];
        });

        if (userMessages.length === 0) return { skipped: true, reason: 'No unprocessed messages' };

        // Combine all messages into one
        const combinedMessage = userMessages.map((m: any) => m.content).join('\n');

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
            // Fetch last 20 messages for context (include timestamps for session detection)
            const { data: history } = await supabase
                .from('messages')
                .select('role, content, created_at')
                .eq('conversation_id', conversation.id)
                .order('created_at', { ascending: true })
                .limit(20);

            // Build chat history with session boundary detection
            const filteredHistory = (history || []).filter((m: any) => m.content && m.content.trim() !== '');
            // Exclude the current batch of messages we're about to send
            const currentBatchContents = new Set(userMessages.map((m: any) => m.content));
            let excludeRemaining = userMessages.length;
            const pastHistory = [];
            for (let i = filteredHistory.length - 1; i >= 0; i--) {
                if (excludeRemaining > 0 && filteredHistory[i].role === 'user' && currentBatchContents.has(filteredHistory[i].content)) {
                    excludeRemaining--;
                    continue;
                }
                pastHistory.unshift(filteredHistory[i]);
            }

            // Detect session gaps (>2 hours between messages) and inject boundary markers
            const processedHistory: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
            for (let i = 0; i < pastHistory.length; i++) {
                const msg = pastHistory[i];
                if (i > 0 && msg.created_at && pastHistory[i - 1].created_at) {
                    const prevTime = new Date(pastHistory[i - 1].created_at).getTime();
                    const currTime = new Date(msg.created_at).getTime();
                    const gapHours = (currTime - prevTime) / (1000 * 60 * 60);
                    if (gapHours > 1) {
                        // Insert a session boundary with time info — let the AI decide how to handle based on message content
                        const gapLabel = gapHours >= 24 ? `${Math.round(gapHours / 24)} day(s)` : `${Math.round(gapHours)} hour(s)`;
                        processedHistory.push({
                            role: 'model',
                            parts: [{ text: `[Time gap: ${gapLabel} have passed since the previous message. Read the guest's next message carefully to decide if they are starting a new conversation or continuing the previous one.]` }],
                        });
                    }
                }
                processedHistory.push({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.content }],
                });
            }

            // Ensure history alternates roles (Gemini requires this)
            const sanitizedHistory: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
            for (const msg of processedHistory) {
                if (sanitizedHistory.length > 0 && sanitizedHistory[sanitizedHistory.length - 1].role === msg.role) {
                    // Merge consecutive same-role messages
                    sanitizedHistory[sanitizedHistory.length - 1].parts[0].text += '\n' + msg.parts[0].text;
                } else {
                    sanitizedHistory.push({ ...msg });
                }
            }

            const model = genAI.getGenerativeModel({
                model: 'gemini-3-flash-preview',
                tools,
                systemInstruction: getSystemPrompt(),
            });

            const chat = model.startChat({
                history: sanitizedHistory,
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

                console.log(`[WhatsApp AI] Function calls requested: ${functionCalls.map((c: any) => c.name).join(', ')}`);

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
                    if (lastToolResult?.found && lastToolResult?.properties?.length > 0) {
                        const props = lastToolResult.properties.map((p: any) =>
                            `${p.number}. *${p.name}* in ${p.area} - *₦${(p.price_per_night || 0).toLocaleString()}/night*\n   ${p.link}`
                        ).join('\n\n');
                        return `Here are some options:\n\n${props}\n\nWhich one catches your eye? I can check dates for you.`;
                    }
                    return lastToolResult?.message || "No properties found matching what you're looking for. Want to try a different area or budget?";
                }
                if (lastToolName === 'get_property_details') {
                    if (lastToolResult?.found) {
                        return `*${lastToolResult.name}* in ${lastToolResult.area}\n*₦${(lastToolResult.price_per_night || 0).toLocaleString()}/night*\nMax guests: ${lastToolResult.max_guests}\n\nSee it here: ${lastToolResult.link}\n\nWant me to check availability for specific dates?`;
                    }
                    return "I couldn't find that property. Could you double-check and try again?";
                }
                
                return "I got your message. Could you give me a bit more detail on what you're looking for?";
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
