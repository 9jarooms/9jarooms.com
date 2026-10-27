// Caretaker training: the eight lessons (video + written SOP) shown in /dashboard/training and /crm/training.
// Videos live in Supabase storage: public-assets/training/<file>.mp4 (+ .jpg poster), 720p, made by
// growth-team/output/creatives/9jarooms/caretaker-training. To change a lesson's words, edit it here.

const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/public-assets/training`;
const media = (file: string) => ({ video: `${BASE}/${file}.mp4`, poster: `${BASE}/${file}.jpg` });

export interface Lesson {
    n: string;
    slug: string;
    title: string;
    minutes: string;
    what: string;                       // one line: what this is for
    when: string;                       // when to use it
    steps: string[];
    tips?: string[];
    links: { label: string; href: string }[];
    video: string;
    poster: string;
}

export const GOLDEN_RULES = [
    { title: 'Never promise a room in chat', body: 'Check it in the app first. When the guest says yes, Hold it, then send the payment link.' },
    { title: 'Record money the moment you get it', body: 'Cash, transfer or POS: open the booking and tap Record payment. The balance and daily log update by themselves.' },
    { title: 'Check guests in and out on time', body: 'The website and the daily log only know a room is free once you tap Check out.' },
    { title: 'Block a room while it is cleaned or repaired', body: 'Then nobody can book it. Tap Mark as ready when it is done.' },
];

export const LESSONS: Lesson[] = [
    {
        n: '01', slug: 'today', title: 'Your Today screen', minutes: '0:42',
        what: 'Your home screen: tonight at a glance and every guest you need to act on today.',
        when: 'Open it first thing every morning and whenever a guest arrives or leaves.',
        steps: [
            'Pick your property at the top (or "All properties").',
            'Read the four boxes: free tonight, arriving, leaving, in house.',
            'Each guest has a card: call or WhatsApp them, or check them in with one tap.',
            'Units shows every room and what it is doing tonight. Tap a unit to book it or block it.',
            'Bookings lets you search any guest by name or phone number.',
        ],
        tips: ['Pull the Today screen down or tap the refresh button if something looks out of date.'],
        links: [{ label: 'Open Today', href: '/dashboard' }, { label: 'Open Units', href: '/dashboard?tab=units' }, { label: 'Open Bookings', href: '/dashboard?tab=bookings' }],
        ...media('9JR-Training-01-your-today-screen'),
    },
    {
        n: '02', slug: 'find', title: 'Find a room and share it', minutes: '0:34',
        what: 'Answer "do you have a room from X to Y?" in seconds, and send the options to the guest.',
        when: 'Every time a guest asks about dates on WhatsApp or by phone.',
        steps: [
            'Open Find.',
            'Pick the check-in date, then the number of nights.',
            'Every free room shows up with its price per night and the total for the stay.',
            'Tap Share all to send every option in one WhatsApp message, or Share option for just one.',
            'The guest opens the link, picks a room and pays on the website.',
        ],
        tips: ['Sharing holds nothing. You can send options to many guests at once; the first to pay gets the room.'],
        links: [{ label: 'Open Find', href: '/dashboard?tab=find' }],
        ...media('9JR-Training-02-find-a-room-and-share-it'),
    },
    {
        n: '03', slug: 'hold', title: 'Hold a unit and send the pay link', minutes: '0:52',
        what: 'Keep a room for a WhatsApp guest for 15 minutes while they pay.',
        when: 'The moment a guest says "yes, I will take it".',
        steps: [
            'In Find, tap Hold a unit on the room they chose.',
            'The unit and dates are filled in. Add the guest name and WhatsApp number.',
            'Tap Hold unit & get payment link. The room is now off the website for 15 minutes.',
            'Tap Send link on WhatsApp. On Today, the hold counts down.',
            'When the guest pays, the booking confirms itself (Paid in full) and you get a message.',
            'Guest changed their mind? Open the hold and tap Release hold. If they do not pay, it frees itself after 15 minutes.',
        ],
        tips: ['Paying by bank transfer instead? Open the hold and tap Record payment: it confirms the same way.'],
        links: [{ label: 'Open Find', href: '/dashboard?tab=find' }],
        ...media('9JR-Training-03-hold-a-unit-and-send-the-pay-link'),
    },
    {
        n: '04', slug: 'book-now', title: 'Walk-in or transfer: Book now', minutes: '0:36',
        what: 'Record a guest who is at the door, or who has already paid you.',
        when: 'Walk-ins, phone bookings, and anyone who paid by cash, transfer or POS.',
        steps: [
            'Tap New booking (green button, bottom right).',
            'Choose Book now. Pick the unit, the check-in date and the number of nights.',
            'Add the guest name, phone number and how they found us.',
            'Enter what they paid and how (cash, transfer, POS). Leave the price empty to use the standard rate, or type the price you agreed.',
            'Tap Create booking. They appear under Arriving today and the room is off the website.',
        ],
        links: [{ label: 'Open Today (New booking)', href: '/dashboard' }],
        ...media('9JR-Training-04-walk-in-or-transfer-book-now'),
    },
    {
        n: '05', slug: 'check-in-out', title: 'Check in, payments, check out', minutes: '0:31',
        what: 'Everything during a stay: arrival, money, extending, and leaving.',
        when: 'When a guest arrives, pays, wants to stay longer, or leaves.',
        steps: [
            'When the guest arrives, tap Check in on their card. They move to In house.',
            'Tap the guest any time to see the total, what they paid, and what they still owe.',
            'Money comes in? Tap Record payment, enter the amount and how they paid.',
            'Staying longer? Open Extend stay or change unit: add nights or move them to another room. The price updates by itself.',
            'When they leave, tap Check out. If they still owe, the app warns you first.',
        ],
        tips: ['Always check guests out when they leave. Until you do, the website thinks the room is taken.'],
        links: [{ label: 'Open Today', href: '/dashboard' }],
        ...media('9JR-Training-05-check-in-payments-check-out'),
    },
    {
        n: '06', slug: 'cleaning', title: 'Cleaning and maintenance', minutes: '0:26',
        what: 'Stop a room being booked while it is cleaned or repaired.',
        when: 'After every check-out, and whenever something needs fixing.',
        steps: [
            'Open Units and tap the room.',
            'Tap Block for cleaning today. For repairs, tap Block for maintenance and pick the dates.',
            'The room shows Cleaning and is off the website.',
            'When it is ready, open it again and tap Mark as ready. It is free and back on the website.',
        ],
        links: [{ label: 'Open Units', href: '/dashboard?tab=units' }],
        ...media('9JR-Training-06-cleaning-and-maintenance'),
    },
    {
        n: '07', slug: 'rooms', title: 'Group rooms, price and photos', minutes: '0:50',
        what: 'Put rooms that are the same in one group: one name, one price, one set of photos, one listing on the website.',
        when: 'Setting up a property, changing prices, adding photos, or putting rooms on the website.',
        steps: [
            'Open Rooms and pick the property. Every room is listed.',
            'Tap the rooms that are the same (for example 1A, 2A, 3A), then tap Group.',
            'Choose New group, type the name guests will see and the price per night (or add them to an existing group).',
            'Tap Group. Those rooms now share one listing. A room that is different stays on its own.',
            'Tap Photos & price on the group: add a few photos of one room, check the price, and switch Showing on the website on or off.',
            'When the property is ready, switch the property on at the top. Then guests can book it online.',
            'New room? Tap + Add rooms on the property, type the names (e.g. 9A, 9B, 9C), and put them in a group or give them a price.',
            'Room no longer used? Select it and tap the bin. Rooms with a current or upcoming booking cannot be removed until that stay is finished or moved.',
        ],
        tips: ['A guest books the group, and the app gives them whichever room in it is free. You never upload the same photos twice.'],
        links: [{ label: 'Open Rooms', href: '/dashboard/rooms' }],
        ...media('9JR-Training-07-group-rooms-price-and-photos'),
    },
    {
        n: '08', slug: 'daily-log', title: 'The daily log', minutes: '0:34',
        what: 'The occupancy sheet, written automatically from what you record in the app.',
        when: 'Every morning, for the team report, and whenever you need to know who owes what.',
        steps: [
            'Open Daily log. Today\'s sheet shows every unit, the guest, rate, dates, nights, total, paid and balance.',
            'Use the arrows (or the date box) to see any other day.',
            'Scroll down for future bookings and guests who still owe money.',
            'Tap Print / PDF to save it or share it with the team.',
        ],
        tips: ['Nobody types the log any more. If something is wrong in it, fix the booking (check in, payment, check out) and the log follows.'],
        links: [{ label: 'Open Daily log', href: '/dashboard/log' }],
        ...media('9JR-Training-08-the-daily-log'),
    },
];

export const FAQ = [
    { q: 'The guest paid after the 15 minutes ran out.', a: 'If the room is still free, the booking confirms itself. If someone else took it, you get a message: call the guest and offer another room or a refund.' },
    { q: 'A room shows taken, but it is empty.', a: 'Someone did not check the last guest out. Open the booking and tap Check out.' },
    { q: 'The guest wants to pay part now and the rest later.', a: 'Book or hold as normal, then Record payment for what they paid. The balance shows on their card and in the daily log until it is paid.' },
    { q: 'I need to move a guest to another room.', a: 'Open their booking, Extend stay or change unit, pick the new unit, Save.' },
];
