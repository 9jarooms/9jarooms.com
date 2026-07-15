'use client';

import { useState } from 'react';
import { FileDown, Loader2, FileText } from 'lucide-react';

interface Property { id: string; name: string; area: string | null }

function naira(n: number) {
    return 'NGN ' + Math.round(Number(n || 0)).toLocaleString('en-NG');
}

function iso(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// preset ranges — `to` is exclusive
function presets() {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const thisMonthStart = new Date(y, m, 1);
    const nextMonthStart = new Date(y, m + 1, 1);
    const lastMonthStart = new Date(y, m - 1, 1);
    const yearStart = new Date(y, 0, 1);
    const nextYearStart = new Date(y + 1, 0, 1);
    return {
        thisMonth: { from: iso(thisMonthStart), to: iso(nextMonthStart) },
        lastMonth: { from: iso(lastMonthStart), to: iso(thisMonthStart) },
        thisYear: { from: iso(yearStart), to: iso(nextYearStart) },
    };
}

export default function ReportGenerator({ properties, unitsByProperty = {} }: {
    properties: Property[];
    unitsByProperty?: Record<string, { id: string; label: string }[]>;
}) {
    const P = presets();
    const [propertyId, setPropertyId] = useState(properties[0]?.id || '');
    const [roomId, setRoomId] = useState(''); // '' = all units
    const [from, setFrom] = useState(P.thisMonth.from);
    const [to, setTo] = useState(iso(new Date())); // inclusive-feeling default: today
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [report, setReport] = useState<any>(null);

    const units = unitsByProperty[propertyId] || [];

    const generate = async () => {
        setBusy(true); setError(null); setReport(null);
        // API treats `to` as exclusive; add a day so the picked end date is included
        const toExclusive = iso(new Date(new Date(to + 'T00:00:00').getTime() + 86400000));
        const res = await fetch(`/api/crm/reports/property?propertyId=${propertyId}&from=${from}&to=${toExclusive}${roomId ? `&roomId=${roomId}` : ''}`);
        const json = await res.json();
        setBusy(false);
        if (!res.ok) { setError(json.error); return; }
        setReport(json);
    };

    const download = async () => {
        if (!report) return;
        const { jsPDF } = await import('jspdf');
        const autoTable = (await import('jspdf-autotable')).default;

        const doc = new jsPDF({ unit: 'pt', format: 'a4' });
        const green: [number, number, number] = [2, 87, 42];
        const lime: [number, number, number] = [126, 217, 87];
        const W = doc.internal.pageSize.getWidth();

        // header band
        doc.setFillColor(...green);
        doc.rect(0, 0, W, 70, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
        doc.text('9jaRooms', 40, 34);
        doc.setTextColor(...lime); doc.text('Property Report', 128, 34);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
        doc.text(`${report.property.name}${report.property.area ? ' — ' + report.property.area : ''}${report.property.unit ? ' · Unit ' + report.property.unit : ''}`, 40, 52);
        const rangeLabel = `${report.range.from}  to  ${to}  (${report.range.days} nights window)`;
        doc.text(rangeLabel, 40, 64);

        // summary cards
        const s = report.summary;
        const cards = [
            ['Revenue', naira(s.revenue)],
            ['Bookings', String(s.bookings)],
            ['Nights sold', String(s.nightsSold)],
            ['Occupancy', `${s.occupancy}%`],
            ['Avg nightly rate', naira(s.adr)],
            ['Outstanding', naira(s.outstanding)],
        ];
        let cx = 40, cy = 92;
        const cardW = (W - 80 - 20) / 3, cardH = 46;
        cards.forEach((c, i) => {
            const col = i % 3, row = Math.floor(i / 3);
            const x = 40 + col * (cardW + 10), y = cy + row * (cardH + 10);
            doc.setFillColor(244, 249, 241);
            doc.roundedRect(x, y, cardW, cardH, 6, 6, 'F');
            doc.setTextColor(120, 120, 120); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
            doc.text(c[0].toUpperCase(), x + 10, y + 16);
            doc.setTextColor(20, 30, 20); doc.setFontSize(13);
            doc.text(c[1], x + 10, y + 34);
        });
        cx = cx; // noop
        let yAfter = cy + 2 * (cardH + 10) + 8;

        // by source
        if (report.bySource.length) {
            autoTable(doc, {
                startY: yAfter,
                head: [['Revenue by source', 'Amount']],
                body: report.bySource.map((r: any) => [r.source, naira(r.amount)]),
                theme: 'grid',
                headStyles: { fillColor: green, halign: 'left' },
                columnStyles: { 1: { halign: 'right' } },
                styles: { fontSize: 9, cellPadding: 5 },
                margin: { left: 40, right: 40 },
            });
            yAfter = (doc as any).lastAutoTable.finalY + 14;
        }

        // by room type
        if (report.byRoomType.length) {
            autoTable(doc, {
                startY: yAfter,
                head: [['Revenue by room type', 'Nights', 'Amount']],
                body: report.byRoomType.map((r: any) => [r.name, String(r.nights), naira(r.revenue)]),
                theme: 'grid',
                headStyles: { fillColor: green, halign: 'left' },
                columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
                styles: { fontSize: 9, cellPadding: 5 },
                margin: { left: 40, right: 40 },
            });
            yAfter = (doc as any).lastAutoTable.finalY + 14;
        }

        // bookings list
        autoTable(doc, {
            startY: yAfter,
            head: [['Guest', 'Unit', 'Check-in', 'Check-out', 'Status', 'Total', 'Paid', 'Balance']],
            body: report.bookings.map((b: any) => [
                b.guest, b.unit, b.checkIn, b.checkOut, b.status.replace('_', ' '),
                naira(b.total), naira(b.paid), naira(b.balance),
            ]),
            theme: 'striped',
            headStyles: { fillColor: green },
            columnStyles: { 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } },
            styles: { fontSize: 8, cellPadding: 4 },
            margin: { left: 40, right: 40 },
        });

        // footer
        const pages = doc.getNumberOfPages();
        for (let i = 1; i <= pages; i++) {
            doc.setPage(i);
            doc.setTextColor(150, 150, 150); doc.setFontSize(8); doc.setFont('helvetica', 'normal');
            doc.text(`Generated ${new Date().toLocaleString('en-NG')} · 9jaRooms CRM · page ${i} of ${pages}`,
                40, doc.internal.pageSize.getHeight() - 20);
        }

        const safe = `${report.property.name}${report.property.unit ? '-' + report.property.unit : ''}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
        doc.save(`9jarooms-${safe}-${report.range.from}-to-${to}.pdf`);
    };

    return (
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)] mb-5">
            <h2 className="px-4 sm:px-5 py-3.5 text-sm font-bold text-stone-700 border-b border-stone-200 flex items-center gap-2">
                <FileText size={15} className="text-[#008737]" /> Generate property report (PDF)
            </h2>
            <div className="px-4 sm:px-5 py-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <label className="block">
                        <span className="text-xs text-stone-500">Property</span>
                        <select value={propertyId} onChange={e => { setPropertyId(e.target.value); setRoomId(''); }}
                            className="mt-1 w-full border border-stone-300 rounded-lg px-2.5 py-2 text-sm bg-white">
                            {properties.map(p => <option key={p.id} value={p.id}>{p.name}{p.area ? ` — ${p.area}` : ''}</option>)}
                        </select>
                    </label>
                    <label className="block">
                        <span className="text-xs text-stone-500">Unit</span>
                        <select value={roomId} onChange={e => setRoomId(e.target.value)}
                            disabled={units.length === 0}
                            className="mt-1 w-full border border-stone-300 rounded-lg px-2.5 py-2 text-sm bg-white disabled:bg-stone-50 disabled:text-stone-400">
                            <option value="">All units</option>
                            {units.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
                        </select>
                    </label>
                    <label className="block">
                        <span className="text-xs text-stone-500">From</span>
                        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                            className="mt-1 w-full border border-stone-300 rounded-lg px-2.5 py-2 text-sm" />
                    </label>
                    <label className="block">
                        <span className="text-xs text-stone-500">To</span>
                        <input type="date" value={to} onChange={e => setTo(e.target.value)}
                            className="mt-1 w-full border border-stone-300 rounded-lg px-2.5 py-2 text-sm" />
                    </label>
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                    <button onClick={() => { setFrom(P.thisMonth.from); setTo(iso(new Date())); }}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-600 hover:bg-stone-200">This month</button>
                    <button onClick={() => { setFrom(P.lastMonth.from); setTo(iso(new Date(new Date(P.thisMonth.from + 'T00:00:00').getTime() - 86400000))); }}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-600 hover:bg-stone-200">Last month</button>
                    <button onClick={() => { setFrom(P.thisYear.from); setTo(iso(new Date())); }}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-600 hover:bg-stone-200">This year</button>
                </div>

                {error && <p className="mt-3 text-xs text-[#c75146] bg-red-50 rounded-lg px-3 py-2">{error}</p>}

                <div className="flex flex-wrap items-center gap-2.5 mt-4">
                    <button onClick={generate} disabled={busy || !propertyId}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#008737] text-white text-sm font-bold disabled:opacity-50 hover:bg-[#02572a]">
                        {busy ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                        {busy ? 'Generating…' : 'Generate report'}
                    </button>
                    {report && (
                        <button onClick={download}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#02572a] text-white text-sm font-bold hover:bg-[#03471f]">
                            <FileDown size={16} /> Download PDF
                        </button>
                    )}
                </div>

                {report && (
                    <div className="mt-4 rounded-xl border border-[#7ed957]/40 bg-[#f4f9f1] p-4">
                        <p className="text-xs font-bold text-[#02572a] mb-2">
                            {report.property.name}{report.property.unit ? ` · Unit ${report.property.unit}` : ''} · {report.range.from} → {to}
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-sm">
                            <Stat label="Revenue" value={naira(report.summary.revenue).replace('NGN', '₦')} />
                            <Stat label="Bookings" value={String(report.summary.bookings)} />
                            <Stat label="Nights sold" value={String(report.summary.nightsSold)} />
                            <Stat label="Occupancy" value={`${report.summary.occupancy}%`} />
                            <Stat label="Avg rate" value={naira(report.summary.adr).replace('NGN', '₦')} />
                            <Stat label="Outstanding" value={naira(report.summary.outstanding).replace('NGN', '₦')} alert={report.summary.outstanding > 0} />
                        </div>
                        <p className="text-[11px] text-stone-400 mt-3">Preview above. The PDF also includes revenue by source, by room type, and the full booking list.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function Stat({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
    return (
        <div className="bg-white rounded-lg px-3 py-2 border border-stone-200/70">
            <p className="text-[10px] uppercase tracking-wide text-stone-400">{label}</p>
            <p className={`font-bold [font-variant-numeric:tabular-nums] ${alert ? 'text-[#c75146]' : 'text-stone-900'}`}>{value}</p>
        </div>
    );
}
