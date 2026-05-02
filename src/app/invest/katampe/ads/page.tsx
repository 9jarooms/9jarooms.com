import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Katampe — Meta Ads Package | 9jaRooms',
    robots: { index: false, follow: false },
};

export default function KatampeAdsPage() {
    return (
        <main className="bg-white min-h-screen font-sans">
            <div className="max-w-3xl mx-auto px-6 py-12 print:py-4">

                {/* Header */}
                <div className="border-b-2 border-gray-900 pb-6 mb-10">
                    <p className="text-xs font-bold tracking-widest uppercase text-gray-400 mb-1">9jaRooms — Internal Ads Package</p>
                    <h1 className="text-3xl font-bold text-gray-900">Katampe Investment Property</h1>
                    <p className="text-gray-500 mt-1">Meta Ads Campaign — Creatives, Scripts & Headlines</p>
                    <div className="flex gap-6 mt-4 text-sm text-gray-600">
                        <span><strong>Objective:</strong> Leads / Conversions</span>
                        <span><strong>Budget:</strong> ₦20,000/day</span>
                        <span><strong>Platform:</strong> Facebook + Instagram</span>
                    </div>
                </div>

                {/* Campaign Strategy */}
                <section className="mb-12">
                    <h2 className="text-lg font-bold mb-3 text-gray-900">Campaign Strategy</h2>
                    <div className="bg-gray-50 rounded-xl p-5 text-sm text-gray-700 space-y-2">
                        <p><strong>Ad Set:</strong> One ad set, full budget. Abuja targeting. Ages 28–50. Broad interests (Real estate, Investing, Business).</p>
                        <p><strong>Landing page:</strong> 9jarooms.com/invest/katampe</p>
                        <p><strong>Conversion event:</strong> WhatsApp click (Contact event) — tracked via Meta pixel</p>
                        <p><strong>Creative approach:</strong> Two angles — home buyer and investor. Run 2–3 ads, let Meta optimize.</p>
                        <p><strong>Do NOT split budget across angles.</strong> One ad set. Meta finds the audience. Give it 7 days before judging performance.</p>
                    </div>
                </section>

                {/* ─── AD 1 ─── */}
                <AdBlock
                    number={1}
                    angle="The Investment Angle"
                    format="Video Reel or Carousel (15–30 sec)"
                    headline="We Turned a 4-Bedroom in Garki Into ₦7 Million Every Month"
                    headlines={[
                        'We Turned a 4-Bedroom in Garki Into ₦7M/Month',
                        'A House That Was Earning ₦1M/Month Now Earns ₦7M',
                        'Same House. 7x the Income. We Did It. You Can Too.',
                    ]}
                    primaryText={`This property in Garki used to earn ₦12 million a year in rent.

After we converted it into 9 self-contained shortlet studios — it now generates ₦7 million every single month. After all expenses.

The same opportunity is now available in Katampe Main. A 2-bedroom apartment. ₦80M.

Buy it. We convert it into 4 shortlet studios for you. You own the property. You collect ₦2M+ every month. We manage it — or you do it yourself. Either way, the playbook is proven.

Tap the link. See the full numbers. Message us on WhatsApp — we will show you the Garki rooms, the bookings, and every naira.`}
                    description="9jaRooms — Shortlet Investment, Abuja"
                    cta="Learn More"
                    visual="Show Garki rooms on screen — clean, furnished, occupied. Then show text overlay: '₦12M/year → ₦7M/month. Same property.' End with 9jaRooms logo and link."
                    notes="The pivot is 'this is yours to take' — not 9jaRooms doing another project. Lead with the Garki proof, then make clear the buyer owns it and 9jaRooms is the operator/partner if they want."
                />

                {/* ─── AD 2 ─── */}
                <AdBlock
                    number={2}
                    angle="The FOMO / Scarcity Angle"
                    format="Single Image or Static"
                    headline="One Property. ₦80M. Katampe Main."
                    headlines={[
                        'One Property. ₦80M. Katampe Main, Abuja.',
                        'This Is Not Listed Anywhere Else.',
                        '₦80M in Katampe. Buy It. Live In It. Or Earn ₦2M Monthly.',
                    ]}
                    primaryText={`A 2-bedroom apartment in Katampe Main is on the market.

₦80,000,000. One unit only.

You can buy it as a home — prime address, Wuse 2 proximity, solid investment in land.

Or you convert it into 4 shortlet studios and let it generate ₦2 million every month. We handle everything. You collect the money.

This is not listed on Jiji. Not on PropertyPro. Not shared publicly.

If you are serious about it, message us now. We will send you the full investment breakdown.`}
                    description="9jaRooms — Abuja Shortlet Investment"
                    cta="Send Message"
                    visual="Clean property exterior photo or premium Abuja neighbourhood image. Text overlay: 'Katampe Main. ₦80M. One Unit Only.' 9jaRooms branding."
                    notes="Scarcity is real — it IS one unit. Lead with exclusivity. The CTA should go to WhatsApp directly."
                />

                {/* ─── AD 3 ─── */}
                <AdBlock
                    number={3}
                    angle="The Lifestyle / Home Buyer Angle"
                    format="Single Image or Carousel"
                    headline="Your Next Address in Katampe Main"
                    headlines={[
                        'Your Next Address in Katampe, Abuja',
                        'A Premium 2-Bedroom in Katampe. ₦80M.',
                        'Prime Abuja. Minutes from Wuse 2. ₦80M.',
                    ]}
                    primaryText={`If you have been looking for property in Abuja — Katampe Main is one of the most sought-after addresses.

Quiet. Established. Close to Wuse 2, Maitama, and the central business district.

This 2-bedroom is on the market at ₦80,000,000.

Move in and make it home. Or purchase it as an investment and let 9jaRooms convert and manage it for you — it generates ₦2M+ monthly as a shortlet operation.

Either way, this is one of the better opportunities available right now in Abuja.

Message us. We will arrange a viewing and walk you through both options.`}
                    description="9jaRooms — Premium Abuja Property"
                    cta="Contact Us"
                    visual="Aspirational Abuja imagery — clean neighbourhood, palm-lined streets, or well-furnished interior. Warm, premium feel. Not too corporate."
                    notes="Targets home buyers who might convert to investors once they see the numbers. The landing page does the investor pitch — let this ad be softer and lifestyle-driven."
                />

                {/* ─── VIDEO SCRIPT ─── */}
                <section className="mb-12">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-bold">▶</div>
                        <h2 className="text-lg font-bold text-gray-900">Video Script — 30 Seconds (Reel/Story)</h2>
                    </div>
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="bg-gray-900 text-gray-200 px-4 py-2 text-xs font-mono">Script — Ad 1 (Investment Angle)</div>
                        <div className="p-5 space-y-4 text-sm">
                            {[
                                { time: '0–5s', visual: 'Show Garki room — clean, furnished, occupied. Music: calm, confident.', voiceover: '"This house in Garki was making one million naira a month in rent."' },
                                { time: '5–12s', visual: 'Cut to multiple room shots — different units, guests checking in, 9jaRooms booking page.', voiceover: '"We converted it into 9 shortlet rooms. Now it makes seven million. Every month. After all expenses."' },
                                { time: '12–20s', visual: 'Text overlay on dark background: "Same playbook. Now available in Katampe Main. 2BR → 4 Studios. ₦2M/month."', voiceover: '"There is a 2-bedroom in Katampe for sale at 80 million. Buy it. We convert it for you. You own it. You earn from it — we manage, or you do it yourself."' },
                                { time: '20–27s', visual: '9jaRooms logo. Link on screen.', voiceover: '"One property. Serious buyers only. See the full numbers — link in bio."' },
                                { time: '27–30s', visual: 'End card: 9jaRooms logo + wa.me link', voiceover: '(silence or brand music)' },
                            ].map(s => (
                                <div key={s.time} className="grid grid-cols-[60px_1fr] gap-3">
                                    <span className="text-xs font-bold text-green-600 pt-0.5">{s.time}</span>
                                    <div>
                                        <p className="text-gray-500 text-xs mb-0.5 italic">Visual: {s.visual}</p>
                                        <p className="text-gray-900 font-medium">{s.voiceover}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ─── TARGETING ─── */}
                <section className="mb-12">
                    <h2 className="text-lg font-bold mb-4 text-gray-900">Targeting Setup</h2>
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { label: 'Location', value: 'Abuja, FCT — 25km radius' },
                            { label: 'Age', value: '28–55' },
                            { label: 'Gender', value: 'All' },
                            { label: 'Budget', value: '₦20,000/day — one ad set' },
                            { label: 'Placement', value: 'Advantage+ (Facebook + Instagram)' },
                            { label: 'Objective', value: 'Leads or Conversions' },
                            { label: 'Conversion Event', value: 'Contact (WhatsApp click)' },
                            { label: 'Interests (optional)', value: 'Real Estate, Investing, Entrepreneurship, Luxury Homes' },
                        ].map(r => (
                            <div key={r.label} className="bg-gray-50 rounded-xl p-3">
                                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{r.label}</p>
                                <p className="text-sm font-medium text-gray-900 mt-0.5">{r.value}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ─── NOTES ─── */}
                <section className="mb-8">
                    <h2 className="text-lg font-bold mb-3 text-gray-900">Campaign Notes</h2>
                    <ul className="space-y-2 text-sm text-gray-700">
                        {[
                            'Do NOT change budget, audience, or creative within the first 7 days. Let the learning phase complete.',
                            'Monitor WhatsApp click-through rate on the landing page — this is the primary conversion signal.',
                            'If Ad 1 (Garki story) significantly outperforms, pause the others and scale that angle only.',
                            'After 7 days of meaningful traffic, create a retargeting audience from page visitors for a second campaign.',
                            'The landing page handles conversion. The ad just needs to generate curiosity and a click.',
                            'Avoid overly polished or corporate creative — authentic room photos perform better in Nigeria.',
                        ].map((note, i) => (
                            <li key={i} className="flex items-start gap-2">
                                <span className="text-green-600 font-bold shrink-0">→</span>
                                {note}
                            </li>
                        ))}
                    </ul>
                </section>

                <div className="border-t border-gray-100 pt-6 text-xs text-gray-400 text-center">
                    9jaRooms — Katampe Investment Campaign · Confidential · {new Date().getFullYear()}
                </div>
            </div>
        </main>
    );
}

function AdBlock({
    number, angle, format, headline, headlines, primaryText, description, cta, visual, notes
}: {
    number: number; angle: string; format: string; headline: string;
    headlines: string[]; primaryText: string; description: string;
    cta: string; visual: string; notes: string;
}) {
    return (
        <section className="mb-14">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-bold">{number}</div>
                <div>
                    <h2 className="text-lg font-bold text-gray-900">Ad {number} — {angle}</h2>
                    <p className="text-xs text-gray-500">Format: {format}</p>
                </div>
            </div>

            <div className="space-y-4">
                {/* Headline options */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-2">Headline Options (pick one)</p>
                    <ol className="space-y-1">
                        {headlines.map((h, i) => (
                            <li key={i} className="text-sm font-semibold text-gray-900">
                                <span className="text-blue-400 mr-1.5">{i + 1}.</span>{h}
                            </li>
                        ))}
                    </ol>
                </div>

                {/* Primary text */}
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Primary Text</p>
                    <p className="text-sm text-gray-800 whitespace-pre-line">{primaryText}</p>
                </div>

                {/* Meta fields */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Description</p>
                        <p className="text-sm font-medium text-gray-900 mt-0.5">{description}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">CTA Button</p>
                        <p className="text-sm font-medium text-gray-900 mt-0.5">{cta}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Destination</p>
                        <p className="text-sm font-medium text-gray-900 mt-0.5">9jarooms.com/invest/katampe</p>
                    </div>
                </div>

                {/* Visual direction */}
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                    <p className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-1">Visual Direction</p>
                    <p className="text-sm text-gray-700">{visual}</p>
                </div>

                {/* Notes */}
                <div className="border-l-2 border-green-400 pl-4">
                    <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-1">Campaign Notes</p>
                    <p className="text-sm text-gray-600">{notes}</p>
                </div>
            </div>
        </section>
    );
}
