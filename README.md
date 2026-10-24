# 9jaRooms

Booking and operations app for 9jaRooms shortlets in Abuja: public site (search, property pages, Paystack checkout), caretaker Today screen (`/dashboard`), CRM (`/crm`), WhatsApp bot (unused since Oct 2026).

## Status (24 Oct 2026)

**Going live with website bookings.** Until now every booking came through WhatsApp and lived in caretakers' heads; the app's availability table was empty. The rule from here: **a room is never promised in chat, it is held in the app first.** Both channels (website and caretakers) claim nights in the same `availability` table, and the database settles ties.

Built on branch `booking-holds` (24 Oct 2026):
- `src/lib/booking/hold.ts`: `claimDates` is the one atomic path for claiming nights (insert-only, so a racing booking can never overwrite another's nights). `HOLD_MINUTES = 15`. `stayDates` is timezone-safe. Proven by `scripts/test-claim-race.mjs` (6 simultaneous bookings, one winner) and `hold.test.ts`.
- Caretaker **Find** tab (`FindRoomPanel`): enter dates, see free units with stay prices, *Share option* to the guest's WhatsApp (link opens the property page with dates pre-filled: `/property/<id>?in=&out=`), or *Hold a unit*.
- **Hold & send pay link** in `NewBookingSheet`: 15-minute hold (`pending`/`held`) + Paystack link sent to the guest on WhatsApp; confirms itself on payment or when a caretaker records a transfer; frees itself on expiry (existing Inngest cron). *Release hold* and *Send link again* in `BookingSheet`.
- Late payments (`payment-confirmed.ts`): a Paystack payment arriving after the hold expired re-claims the nights; if they are gone the booking is cancelled, flagged `PAID AFTER HOLD EXPIRED`, and the team is alerted to refund.
- WhatsApp alerts to the property's caretaker (`notify-caretakers.ts`): website hold started, booking paid, refund needed. Needs `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID`; outside Meta's 24h window set `WHATSAPP_ALERT_TEMPLATE` to an approved template. Optional `TEAM_NOTIFY_PHONES`.
- **Local demo mode:** `PAYSTACK_MOCK=1` in `.env.local` (ignored in production) swaps Paystack for `/booking/mock-pay`, so the hold → pay → confirm flow runs end to end with no money. The team training videos (6 short MP4s) are built from phone screenshots by `demos/make_demo.py` from `demos/*.json`; outputs in `demos/out/` (not in git).
- Payments go to the main Paystack account; an owner sub-account is used only if set (9jaRooms manages all properties itself now).

**Before switching a property on:** a caretaker enters everyone currently in the building (unit, name, paid-until) via *New booking → Book now*, and checks out the 43 stale `occupancy_log` guests still marked in-house from September.

**Open:** Vercel env vars (Paystack, Resend, Gemini, WhatsApp) are not in the local `.env.local`; the test admin login `claude-test@9jarooms.internal` can be deleted once no longer needed.

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
