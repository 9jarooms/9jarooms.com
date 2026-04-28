'use client';

import { useState, useEffect } from 'react';
import { Eye, CalendarDays, MessageCircle, Phone, TrendingUp } from 'lucide-react';

interface FunnelData {
    counts: Record<string, number>;
    dailyCounts: Record<string, number>;
}

export default function FunnelWidget() {
    const [data, setData] = useState<FunnelData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/analytics/funnel')
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    if (loading) return (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="h-32 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-gray-200 border-t-green-500 rounded-full animate-spin" />
            </div>
        </div>
    );

    if (!data) return null;

    const { counts } = data;
    const steps = [
        { key: 'page_view', label: 'Page Views', icon: Eye, color: 'text-blue-600', bg: 'bg-blue-50', bar: 'bg-blue-400' },
        { key: 'dates_selected', label: 'Dates Selected', icon: CalendarDays, color: 'text-purple-600', bg: 'bg-purple-50', bar: 'bg-purple-400' },
        { key: 'whatsapp_click', label: 'WhatsApp Clicks', icon: MessageCircle, color: 'text-green-600', bg: 'bg-green-50', bar: 'bg-green-500' },
        { key: 'call_click', label: 'Call Clicks', icon: Phone, color: 'text-amber-600', bg: 'bg-amber-50', bar: 'bg-amber-400' },
    ];

    const maxVal = Math.max(...steps.map(s => counts[s.key] || 0), 1);
    const views = counts.page_view || 0;
    const waClicks = counts.whatsapp_click || 0;
    const datesSelected = counts.dates_selected || 0;

    const viewsToEnquiry = views > 0 ? ((waClicks / views) * 100).toFixed(1) : '0';
    const datesToEnquiry = datesSelected > 0 ? ((waClicks / datesSelected) * 100).toFixed(1) : '0';

    // Daily sparkline
    const dailyVals = Object.values(data.dailyCounts || {});
    const maxDaily = Math.max(...dailyVals, 1);

    return (
        <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <TrendingUp size={16} className="text-gray-400" />
                    <h3 className="font-semibold text-gray-900 text-sm">Visitor Funnel</h3>
                </div>
                <span className="text-[10px] text-gray-400">Last 30 days</span>
            </div>

            {/* Funnel steps */}
            <div className="space-y-3 mb-5">
                {steps.map((step, i) => {
                    const val = counts[step.key] || 0;
                    const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
                    const Icon = step.icon;
                    return (
                        <div key={step.key}>
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <div className={`w-6 h-6 rounded-md flex items-center justify-center ${step.bg}`}>
                                        <Icon size={12} className={step.color} />
                                    </div>
                                    <span className="text-xs font-medium text-gray-700">{step.label}</span>
                                </div>
                                <span className="text-sm font-bold text-gray-900">{val.toLocaleString()}</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                                <div className={`${step.bar} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                            </div>
                            {i < steps.length - 1 && val > 0 && (counts[steps[i + 1].key] || 0) > 0 && (
                                <p className="text-[10px] text-gray-400 mt-0.5 pl-8">
                                    {((counts[steps[i + 1].key] / val) * 100).toFixed(0)}% continued
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Conversion stats */}
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-50">
                <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-[10px] text-green-600 mb-0.5">Views → WA</p>
                    <p className="text-xl font-bold text-green-700">{viewsToEnquiry}%</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3">
                    <p className="text-[10px] text-purple-600 mb-0.5">Dates → WA</p>
                    <p className="text-xl font-bold text-purple-700">{datesToEnquiry}%</p>
                </div>
            </div>

            {/* Daily sparkline */}
            {dailyVals.some(v => v > 0) && (
                <div className="mt-4 pt-3 border-t border-gray-50">
                    <p className="text-[10px] text-gray-400 mb-2">Page views — last 14 days</p>
                    <div className="flex items-end gap-0.5 h-10">
                        {Object.entries(data.dailyCounts).map(([day, val]) => (
                            <div key={day} className="flex-1 flex flex-col items-center" title={`${day}: ${val}`}>
                                <div
                                    className="w-full bg-blue-300 rounded-t-sm"
                                    style={{ height: `${Math.max((val / maxDaily) * 40, val > 0 ? 3 : 0)}px` }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
