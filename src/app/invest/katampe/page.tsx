import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Katampe 2-Bedroom — ₦80M | 9jaRooms',
    description: 'Premium 2-bedroom apartment in Katampe Main, Abuja. Buy as a home or convert into 4 shortlet studios generating ₦2M+ monthly.',
    robots: { index: true, follow: true },
    openGraph: {
        title: 'Katampe 2-Bedroom — ₦80M | Buy or Invest',
        description: 'Own a premium home or generate ₦2.48M monthly net. We have already done this in Garki. The numbers are real.',
        siteName: '9jaRooms',
    },
};

const WA = '2349111101012';

function waHref(msg: string) {
    return `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`;
}

const homeBuyerWA = waHref(
    'Hi, I saw the Katampe 2-bedroom listing at ₦80M on 9jaRooms. I am interested in buying it as a home. Can you share more details and arrange a viewing?'
);

const investorWA = waHref(
    'Hi, I saw the Katampe investment opportunity on 9jaRooms. I want to understand the conversion plan and the numbers in detail. Can we talk?'
);

const generalWA = waHref(
    'Hi, I saw the Katampe property listing on 9jaRooms. I want to learn more before deciding.'
);

export default function KatampePage() {
    return (
        <main className="bg-white text-gray-900 font-sans">

            {/* ─── NAV ─── */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
                <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
                    <Link href="/">
                        <img src="/WHITE.jpg" alt="9jaRooms" className="h-8 w-auto object-contain" />
                    </Link>
                    <a
                        href={generalWA}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-4 py-2 rounded-full transition-colors"
                    >
                        Talk to Us
                    </a>
                </div>
            </nav>

            {/* ─── HERO ─── */}
            <section className="pt-14 bg-[#0c1a0e] text-white relative overflow-hidden min-h-[90vh] flex flex-col justify-end">
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-[#0c1a0e]" />
                <div className="absolute top-10 right-[-100px] w-[400px] h-[400px] bg-green-700/10 rounded-full blur-3xl" />

                <div className="relative z-10 max-w-5xl mx-auto px-4 pb-16 pt-24">
                    <span className="inline-block text-green-400 text-xs font-bold tracking-widest uppercase mb-4 bg-green-400/10 px-3 py-1 rounded-full border border-green-400/20">
                        Katampe Main, Abuja — ₦80,000,000
                    </span>
                    <h1 className="text-3xl sm:text-5xl font-bold leading-tight mb-4 max-w-2xl">
                        A Premium 2-Bedroom.<br />
                        Or an Asset That Pays<br />
                        <span className="text-green-400">₦2M+ Every Month.</span>
                    </h1>
                    <p className="text-white/70 text-base sm:text-lg max-w-xl mb-10">
                        Minutes from Wuse 2. Ready to move in — or ready to convert into 4 fully-furnished shortlet studios. We have done this before. The numbers are real.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <a
                            href="#proof"
                            className="flex-1 sm:flex-none text-center bg-white text-gray-900 hover:bg-gray-100 font-semibold px-6 py-4 rounded-2xl transition-colors text-sm"
                        >
                            Show me the property ↓
                        </a>
                        <a
                            href="#proof"
                            className="flex-1 sm:flex-none text-center bg-green-500 hover:bg-green-400 text-white font-semibold px-6 py-4 rounded-2xl transition-colors text-sm"
                        >
                            Show me the numbers ↓
                        </a>
                    </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent" />
            </section>

            {/* ─── TWO PATHS ─── */}
            <section className="max-w-5xl mx-auto px-4 py-16">
                <p className="text-center text-gray-400 text-xs font-bold tracking-widest uppercase mb-3">Two types of people are reading this</p>
                <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">Which one are you?</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Path A */}
                    <div className="rounded-3xl border border-gray-100 p-6 bg-gray-50">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-xl mb-4">🏠</div>
                        <h3 className="text-lg font-bold mb-2">The Home Buyer</h3>
                        <p className="text-gray-600 text-sm mb-4">
                            You want a solid address in Katampe Main. Quiet, secure, close to everything. A place you can move into, furnish to your taste, and call yours. ₦80M for prime Abuja real estate — well-priced.
                        </p>
                        <ul className="space-y-2 text-sm text-gray-700">
                            {[
                                '2 bedrooms, Katampe Main',
                                'Minutes from Wuse 2 & Maitama',
                                'Established neighbourhood',
                                'Capital appreciation over time',
                                'Move-in ready',
                            ].map(i => (
                                <li key={i} className="flex items-start gap-2">
                                    <span className="text-green-500 mt-0.5">✓</span>
                                    {i}
                                </li>
                            ))}
                        </ul>
                        <a
                            href="#proof"
                            className="mt-6 w-full block text-center bg-gray-900 hover:bg-gray-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
                        >
                            Tell me more ↓
                        </a>
                    </div>

                    {/* Path B */}
                    <div className="rounded-3xl border-2 border-green-500 p-6 bg-green-50 relative overflow-hidden">
                        <div className="absolute top-3 right-3 bg-green-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">POPULAR</div>
                        <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-xl mb-4">📈</div>
                        <h3 className="text-lg font-bold mb-2">The Investor</h3>
                        <p className="text-gray-600 text-sm mb-4">
                            You want your money working for you. Convert this 2-bedroom into 4 fully-furnished shortlet studios. Earn ₦2.48M+ net every month. The conversion playbook is already proven.
                        </p>
                        <ul className="space-y-2 text-sm text-gray-700">
                            {[
                                '4 studios after conversion',
                                '₦2.05M+ net monthly to owner',
                                'Conversion CapEx payback in ~9 months',
                                '~25% annual ROI on total investment',
                                'Already working in Garki — we run that too',
                            ].map(i => (
                                <li key={i} className="flex items-start gap-2">
                                    <span className="text-green-600 mt-0.5">✓</span>
                                    {i}
                                </li>
                            ))}
                        </ul>
                        <a
                            href="#proof"
                            className="mt-6 w-full block text-center bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
                        >
                            Show me the numbers ↓
                        </a>
                    </div>
                </div>
            </section>

            {/* ─── GARKI PROOF STORY ─── */}
            <section id="proof" className="bg-[#0c1a0e] text-white py-20 px-4 scroll-mt-14">
                <div className="max-w-5xl mx-auto">
                    <span className="inline-block text-green-400 text-xs font-bold tracking-widest uppercase mb-4 bg-green-400/10 px-3 py-1 rounded-full border border-green-400/20">
                        Proof of Concept — Garki, Abuja
                    </span>
                    <h2 className="text-2xl sm:text-4xl font-bold mb-6 max-w-2xl leading-tight">
                        We Already Did This.<br />
                        <span className="text-green-400">Here Is What Happened.</span>
                    </h2>
                    <p className="text-white/70 text-base sm:text-lg max-w-2xl mb-12">
                        A few years ago, there was a 4-bedroom house in Garki. The owner was collecting ₦12 million a year in rent — about ₦1 million a month. Standard landlord income. Then they handed it to us.
                    </p>

                    {/* Before / After */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                            <p className="text-white/40 text-xs font-bold tracking-widest uppercase mb-4">Before — Traditional Letting</p>
                            <p className="text-4xl font-bold text-white/60 mb-1">₦1M</p>
                            <p className="text-white/40 text-sm">per month (₦12M/year)</p>
                            <div className="mt-4 pt-4 border-t border-white/10 space-y-2 text-sm text-white/50">
                                <p>4-bedroom house</p>
                                <p>Single annual rent collection</p>
                                <p>One tenant, all the risk</p>
                            </div>
                        </div>
                        <div className="bg-green-500/10 border border-green-400/30 rounded-2xl p-6">
                            <p className="text-green-400 text-xs font-bold tracking-widest uppercase mb-4">After — 9jaRooms Full Management</p>
                            <p className="text-4xl font-bold text-green-400 mb-1">₦7M</p>
                            <p className="text-green-300/60 text-sm">per month, every month</p>
                            <div className="mt-4 pt-4 border-t border-green-400/20 space-y-2 text-sm text-white/70">
                                <p>9 fully-furnished studio rooms</p>
                                <p>We fill them — marketing, ads, platform</p>
                                <p>After all expenses paid, to the owner</p>
                            </div>
                        </div>
                    </div>

                    {/* The number */}
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center gap-6">
                        <div className="flex-1">
                            <p className="text-white/50 text-sm mb-2">The income went from</p>
                            <p className="text-xl sm:text-2xl font-bold">
                                ₦12M/year <span className="text-green-400">→ ₦84M/year</span>
                            </p>
                            <p className="text-white/50 text-sm mt-1">7x the income. Same property. Same land. We filled the rooms.</p>
                        </div>
                        <div className="w-full sm:w-px sm:h-16 h-px sm:w-px bg-white/10" />
                        <div className="shrink-0">
                            <p className="text-white/50 text-sm mb-2">You can verify this.</p>
                            <a
                                href={investorWA}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-400 text-white text-sm font-semibold px-5 py-3 rounded-xl transition-colors"
                            >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                                See the Garki Rooms on WhatsApp
                            </a>
                        </div>
                    </div>

                    <p className="text-white/40 text-sm mt-6 text-center">
                        The Garki property is listed on 9jarooms.com right now. You can see the bookings. The numbers are not speculation.
                    </p>
                </div>
            </section>

            {/* ─── KATAMPE CONVERSION PLAN ─── */}
            <section id="investment-plan" className="max-w-5xl mx-auto px-4 py-20 scroll-mt-16">
                <span className="inline-block text-green-600 text-xs font-bold tracking-widest uppercase mb-4 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                    The Plan — Katampe
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold mb-3">You Buy It. We Run It. You Collect.</h2>
                <p className="text-gray-500 mb-10 max-w-xl">
                    We convert the 2-bedroom into 4 fully self-contained studio shortlet units. We handle marketing, fill the rooms, manage guests and operations. Every month, you collect the profit.
                </p>

                {/* Numbers grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-12">
                    {[
                        { label: 'Studios After Conversion', value: '4', sub: 'self-contained units', color: 'bg-gray-50' },
                        { label: 'Nightly Rate', value: '₦30K', sub: 'per studio per night', color: 'bg-gray-50' },
                        { label: 'Projected Monthly Revenue', value: '₦2.88M', sub: 'at 80% occupancy', color: 'bg-green-50 border border-green-100' },
                        { label: 'Net Monthly to Owner', value: '₦2.05M', sub: 'after all expenses + management', color: 'bg-green-50 border border-green-100' },
                    ].map(s => (
                        <div key={s.label} className={`rounded-2xl p-4 ${s.color}`}>
                            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{s.value}</p>
                            <p className="text-[10px] text-green-700 font-semibold uppercase tracking-wide mt-1">{s.label}</p>
                            <p className="text-xs text-gray-500 mt-1">{s.sub}</p>
                        </div>
                    ))}
                </div>

                {/* Financial table */}
                <div className="rounded-3xl border border-gray-100 overflow-hidden mb-10">
                    <div className="bg-gray-50 px-5 py-3 border-b border-gray-100">
                        <h3 className="font-semibold text-sm">Monthly Financials — Full Management (Projected)</h3>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {[
                            { label: 'Gross Monthly Revenue', value: '₦2,880,000', highlight: false },
                            { label: 'Operating Expenses (caretakers, utilities, internet, maintenance)', value: '−₦400,000', highlight: false },
                            { label: '9jaRooms Management Fee (15% of gross)', value: '−₦432,000', highlight: false },
                            { label: 'Net Monthly Profit to Owner', value: '₦2,048,000', highlight: true },
                        ].map(row => (
                            <div key={row.label} className={`flex justify-between items-center px-5 py-4 ${row.highlight ? 'bg-green-50' : 'bg-white'}`}>
                                <span className={`text-sm ${row.highlight ? 'font-bold text-gray-900' : 'text-gray-600'}`}>{row.label}</span>
                                <span className={`text-sm font-bold ${row.highlight ? 'text-green-700 text-base' : 'text-gray-800'}`}>{row.value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* CapEx */}
                <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 sm:p-8">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
                        <div className="flex-1">
                            <p className="text-amber-800 text-xs font-bold tracking-widest uppercase mb-2">One-Time Conversion Investment</p>
                            <p className="text-3xl font-bold text-gray-900 mb-1">₦18,495,000</p>
                            <p className="text-gray-600 text-sm">Covers full construction, furnishing, appliances, AC units, solar inverter system — everything move-in ready for guests.</p>
                        </div>
                        <div className="flex-1 sm:border-l sm:border-amber-200 sm:pl-8">
                            <p className="text-amber-800 text-xs font-bold tracking-widest uppercase mb-2">Payback Period on CapEx</p>
                            <p className="text-3xl font-bold text-gray-900 mb-1">~9 months</p>
                            <p className="text-gray-600 text-sm">At ₦2.05M/month net, the ₦18.5M conversion cost pays for itself in under a year — then it is pure income.</p>
                        </div>
                    </div>
                </div>

                {/* Total ROI summary */}
                <div className="mt-6 bg-gray-900 text-white rounded-3xl p-6 sm:p-8">
                    <p className="text-white/50 text-xs font-bold tracking-widest uppercase mb-4">Total Investment Summary</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        {[
                            { label: 'Property Purchase', value: '₦80,000,000' },
                            { label: 'Conversion CapEx', value: '₦18,495,000' },
                            { label: 'Total Investment', value: '₦98,495,000' },
                        ].map(r => (
                            <div key={r.label}>
                                <p className="text-white/40 text-xs mb-1">{r.label}</p>
                                <p className="text-xl font-bold">{r.value}</p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-6">
                        {[
                            { label: 'Monthly Net to Owner', value: '₦2,048,000' },
                            { label: 'Annual Net to Owner', value: '~₦24,600,000' },
                            { label: 'Annual ROI', value: '~25%', highlight: true },
                        ].map(r => (
                            <div key={r.label}>
                                <p className="text-white/40 text-xs mb-1">{r.label}</p>
                                <p className={`text-xl font-bold ${r.highlight ? 'text-green-400' : ''}`}>{r.value}</p>
                            </div>
                        ))}
                    </div>
                    <p className="text-white/30 text-xs mt-4">Projections based on 80% occupancy and ₦30,000/night. Numbers are conservative and verifiable.</p>
                </div>
            </section>

            {/* ─── PROPERTY DETAILS ─── */}
            <section id="property-details" className="bg-gray-50 py-20 px-4 scroll-mt-16">
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-2xl sm:text-3xl font-bold mb-10">Property Details</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            {[
                                { label: 'Location', value: 'Katampe Main, Abuja' },
                                { label: 'Type', value: '2-Bedroom Apartment' },
                                { label: 'After Conversion', value: '4 Studio Shortlet Units' },
                                { label: 'Proximity', value: 'Minutes from Wuse 2 & Maitama' },
                                { label: 'Asking Price', value: '₦80,000,000' },
                                { label: 'Conversion Cost', value: '₦18,495,000 (one-time)' },
                                { label: 'Estimated Build Time', value: '4–7 weeks' },
                            ].map(d => (
                                <div key={d.label} className="flex justify-between items-center py-3 border-b border-gray-200">
                                    <span className="text-sm text-gray-500">{d.label}</span>
                                    <span className="text-sm font-semibold text-gray-900 text-right max-w-[55%]">{d.value}</span>
                                </div>
                            ))}
                        </div>
                        <div className="bg-white rounded-3xl p-6 flex flex-col justify-between border border-gray-100">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Each Studio Will Have</p>
                                <ul className="grid grid-cols-2 gap-2">
                                    {[
                                        'Private bathroom', 'Air conditioning',
                                        'Smart TV', 'Mini fridge',
                                        'Microwave', 'Electric kettle',
                                        'Bed & wardrobe', 'Work desk',
                                        'Fast internet', 'Solar power backup',
                                        'Decor & curtains', 'Standing fan',
                                    ].map(item => (
                                        <li key={item} className="flex items-center gap-1.5 text-xs text-gray-700">
                                            <span className="text-green-500">✓</span>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <a
                                href={investorWA}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-6 block text-center bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
                            >
                                Request Full Proposal on WhatsApp
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── QUALIFY + FINAL CTA ─── */}
            <section className="bg-[#0c1a0e] text-white py-20 px-4">
                <div className="max-w-3xl mx-auto text-center">
                    <span className="inline-block text-green-400 text-xs font-bold tracking-widest uppercase mb-6 bg-green-400/10 px-3 py-1 rounded-full border border-green-400/20">
                        One Property. Serious Buyers Only.
                    </span>
                    <h2 className="text-2xl sm:text-4xl font-bold mb-4">
                        If You Are Ready to Move, <br />
                        <span className="text-green-400">We Are Ready to Talk.</span>
                    </h2>
                    <p className="text-white/60 mb-10 max-w-lg mx-auto">
                        This property is not listed on any public platform. When you message us, come ready to have a real conversation about the numbers.
                    </p>

                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 mb-10 text-left">
                        <p className="text-white/50 text-xs font-bold uppercase tracking-wider mb-4">When You Message Us, We Will Ask You:</p>
                        <ul className="space-y-3">
                            {[
                                'Are you buying as a home or as an investment?',
                                'Are you ready to move within 30–60 days of agreement?',
                                'Do you want to see the Garki conversion numbers first-hand?',
                                'Would you like help converting and operating the property after purchase?',
                            ].map((q, i) => (
                                <li key={i} className="flex items-start gap-3 text-sm text-white/70">
                                    <span className="text-green-400 font-bold shrink-0">{i + 1}.</span>
                                    {q}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <a
                            href={homeBuyerWA}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 sm:flex-none text-center bg-white text-gray-900 hover:bg-gray-100 font-semibold px-8 py-4 rounded-2xl transition-colors"
                        >
                            I Want the Home
                        </a>
                        <a
                            href={investorWA}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 sm:flex-none text-center bg-green-500 hover:bg-green-400 text-white font-semibold px-8 py-4 rounded-2xl transition-colors"
                        >
                            I Want the Investment
                        </a>
                    </div>
                </div>
            </section>

            {/* ─── MANAGEMENT OPTIONS (revealed after engagement) ─── */}
            <section className="bg-white py-20 px-4 border-t border-gray-100">
                <div className="max-w-5xl mx-auto">
                    <span className="inline-block text-green-600 text-xs font-bold tracking-widest uppercase mb-4 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                        After You Buy — Your Options
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-bold mb-3">You Choose How Involved You Want to Be</h2>
                    <p className="text-gray-500 mb-10 max-w-xl">
                        We manage 60+ properties in Abuja. You can hand everything to us, use us only for marketing, or go completely independent. The numbers above apply to all three paths.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                            {
                                tier: 'Full Management',
                                price: '15%',
                                sub: 'of monthly gross revenue',
                                desc: 'We handle everything. Guest communications, check-ins, cleaning scheduling, maintenance, booking management, and marketing. You collect monthly profit.',
                                items: ['Guest management', 'Booking + payments', 'Cleaning coordination', 'Maintenance oversight', 'Marketing & ads', 'Monthly reports'],
                                cta: 'This Is What I Want',
                                ctaWa: investorWA,
                                highlight: true,
                                note: null,
                            },
                            {
                                tier: 'Marketing Only',
                                price: '10%',
                                sub: 'of bookings we bring you',
                                desc: 'We list your property and run ads to drive bookings. You manage operations yourself. We earn nothing until guests start paying.',
                                items: ['Listed on 9jaRooms', 'Meta ads campaigns', 'Booking leads sent to you', 'You manage guests & ops'],
                                cta: 'Tell Me More',
                                ctaWa: investorWA,
                                highlight: false,
                                note: 'We earn nothing until you earn.',
                            },
                            {
                                tier: 'Independent',
                                price: '0%',
                                sub: 'No ongoing fee',
                                desc: 'Buy the property, convert it, and run it completely on your own. We build it, hand it over, and step back.',
                                items: ['Full ownership control', 'List anywhere you like', 'No ongoing commitment', 'Advisory support available'],
                                cta: 'I Will Run It Myself',
                                ctaWa: homeBuyerWA,
                                highlight: false,
                                note: null,
                            },
                        ].map(tier => (
                            <div
                                key={tier.tier}
                                className={`rounded-3xl p-6 flex flex-col ${tier.highlight ? 'bg-green-600 text-white' : 'bg-gray-50 border border-gray-100'}`}
                            >
                                {tier.highlight && (
                                    <span className="self-start text-[10px] font-bold bg-white text-green-700 px-2.5 py-0.5 rounded-full mb-3">RECOMMENDED</span>
                                )}
                                <p className={`text-xs font-bold tracking-widest uppercase mb-2 ${tier.highlight ? 'text-green-200' : 'text-gray-400'}`}>{tier.tier}</p>
                                <p className={`text-3xl font-bold mb-0.5 ${tier.highlight ? 'text-white' : 'text-gray-900'}`}>{tier.price}</p>
                                <p className={`text-xs mb-4 ${tier.highlight ? 'text-green-200' : 'text-gray-500'}`}>{tier.sub}</p>
                                {tier.note && (
                                    <p className={`text-xs font-semibold mb-3 ${tier.highlight ? 'text-green-100' : 'text-green-700'} bg-green-50 border border-green-100 px-2.5 py-1.5 rounded-lg`}>
                                        {tier.note}
                                    </p>
                                )}
                                <p className={`text-sm mb-6 flex-1 ${tier.highlight ? 'text-green-100' : 'text-gray-600'}`}>{tier.desc}</p>
                                <ul className="space-y-1.5 mb-6">
                                    {tier.items.map(item => (
                                        <li key={item} className={`text-xs flex items-center gap-2 ${tier.highlight ? 'text-green-100' : 'text-gray-600'}`}>
                                            <span className={tier.highlight ? 'text-green-300' : 'text-green-500'}>✓</span>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                                <a
                                    href={tier.ctaWa}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`text-center text-sm font-semibold py-3 rounded-xl transition-colors ${tier.highlight ? 'bg-white text-green-700 hover:bg-green-50' : 'bg-gray-900 text-white hover:bg-gray-700'}`}
                                >
                                    {tier.cta}
                                </a>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── FOOTER ─── */}
            <footer className="bg-white border-t border-gray-100 py-8 px-4 text-center">
                <Link href="/">
                    <img src="/WHITE.jpg" alt="9jaRooms" className="h-8 w-auto object-contain mx-auto mb-3" />
                </Link>
                <p className="text-xs text-gray-400">
                    All projections are based on conservative estimates and are not guaranteed. Numbers are verifiable on request.
                </p>
                <p className="text-xs text-gray-400 mt-1">
                    © {new Date().getFullYear()} 9jaRooms. All rights reserved.
                </p>
            </footer>
        </main>
    );
}
