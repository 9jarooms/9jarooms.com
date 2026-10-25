'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Play, ChevronDown, ChevronUp, ArrowRight, ShieldCheck, Lightbulb, HelpCircle, Check } from 'lucide-react';
import { LESSONS, GOLDEN_RULES, FAQ } from '@/lib/training';

const SEEN_KEY = 'training-seen';

// Training: every lesson as a short video plus the written SOP, with buttons that open the exact screen.
export default function Training() {
    const [open, setOpen] = useState<string | null>(null);
    const [seen, setSeen] = useState<Set<string>>(new Set());

    useEffect(() => {
        const t = setTimeout(() => {
            try { setSeen(new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'))); } catch { /* ignore */ }
            const hash = window.location.hash.replace('#', '');
            if (hash && LESSONS.some(l => l.slug === hash)) {
                setOpen(hash);
                setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
            }
        }, 0);
        return () => clearTimeout(t);
    }, []);

    const markSeen = (slug: string) => setSeen(s => {
        const n = new Set(s); n.add(slug);
        try { localStorage.setItem(SEEN_KEY, JSON.stringify([...n])); } catch { /* ignore */ }
        return n;
    });

    return (
        <div className="max-w-2xl mx-auto pb-10">
            <div className="rounded-2xl bg-gradient-to-br from-green-600 to-green-700 p-5 text-white shadow-md mb-6">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-green-200">Caretaker training</p>
                <h1 className="font-semibold text-[24px] leading-tight mt-1">How to run 9jaRooms from this app</h1>
                <p className="text-white/80 text-[14px] mt-2">Eight short lessons, under a minute each. Watch the video or read the steps, then tap the button to open that screen.</p>
                <p className="text-[12.5px] text-green-100 mt-3">{seen.size} of {LESSONS.length} lessons watched</p>
            </div>

            <section className="mb-7">
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 px-1 mb-2 flex items-center gap-1.5"><ShieldCheck size={13} /> The four rules</h2>
                <div className="grid sm:grid-cols-2 gap-2">
                    {GOLDEN_RULES.map((r, i) => (
                        <div key={r.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                            <p className="font-semibold text-[14.5px] text-gray-900"><span className="text-green-600 mr-1.5">{i + 1}.</span>{r.title}</p>
                            <p className="text-[13px] text-gray-500 mt-1 leading-snug">{r.body}</p>
                        </div>
                    ))}
                </div>
            </section>

            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 px-1 mb-2">Lessons</h2>
            <div className="space-y-3">
                {LESSONS.map(l => {
                    const isOpen = open === l.slug;
                    return (
                        <article key={l.slug} id={l.slug} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden scroll-mt-20">
                            <button type="button" onClick={() => setOpen(isOpen ? null : l.slug)} className="w-full text-left p-4 flex items-center gap-3">
                                <span className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-[13px] font-semibold ${seen.has(l.slug) ? 'bg-green-500 text-white' : 'bg-green-50 text-green-700'}`}>
                                    {seen.has(l.slug) ? <Check size={18} /> : l.n}
                                </span>
                                <span className="flex-1 min-w-0">
                                    <span className="block font-semibold text-[15.5px] text-gray-900">{l.title}</span>
                                    <span className="block text-[12.5px] text-gray-500 truncate">{l.what}</span>
                                </span>
                                <span className="text-[11px] text-gray-400 tabular-nums shrink-0">{l.minutes}</span>
                                {isOpen ? <ChevronUp size={18} className="text-gray-400 shrink-0" /> : <ChevronDown size={18} className="text-gray-400 shrink-0" />}
                            </button>

                            {isOpen && (
                                <div className="px-4 pb-5 space-y-4">
                                    <video src={l.video} poster={l.poster} controls playsInline preload="none"
                                        onPlay={() => markSeen(l.slug)}
                                        className="w-full max-w-[340px] mx-auto block aspect-[9/16] rounded-2xl bg-gray-900 object-cover" />

                                    <div className="rounded-xl bg-gray-50 px-4 py-3 text-[13.5px] text-gray-700">
                                        <p><b className="text-gray-900">What it is for:</b> {l.what}</p>
                                        <p className="mt-1"><b className="text-gray-900">When:</b> {l.when}</p>
                                    </div>

                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 mb-2">Step by step</p>
                                        <ol className="space-y-2">
                                            {l.steps.map((s, i) => (
                                                <li key={i} className="flex gap-3 text-[14px] text-gray-800 leading-snug">
                                                    <span className="w-6 h-6 rounded-full bg-green-50 text-green-700 text-[12px] font-semibold flex items-center justify-center shrink-0 mt-px">{i + 1}</span>
                                                    <span>{s}</span>
                                                </li>
                                            ))}
                                        </ol>
                                    </div>

                                    {l.tips?.map(t => (
                                        <p key={t} className="flex gap-2 text-[13px] text-amber-900 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5"><Lightbulb size={16} className="shrink-0 mt-px" />{t}</p>
                                    ))}

                                    <div className="flex flex-wrap gap-2">
                                        {l.links.map(k => (
                                            <Link key={k.href + k.label} href={k.href}
                                                className="h-11 px-4 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold text-[14px] flex items-center gap-2 transition-colors">
                                                {k.label} <ArrowRight size={16} />
                                            </Link>
                                        ))}
                                        <button type="button" onClick={() => { const v = document.querySelector<HTMLVideoElement>(`#${l.slug} video`); v?.play(); }}
                                            className="h-11 px-4 rounded-xl border border-gray-200 text-gray-700 font-semibold text-[14px] flex items-center gap-2 hover:border-gray-900">
                                            <Play size={15} /> Play video
                                        </button>
                                    </div>
                                </div>
                            )}
                        </article>
                    );
                })}
            </div>

            <section className="mt-8">
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 px-1 mb-2 flex items-center gap-1.5"><HelpCircle size={13} /> Common questions</h2>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                    {FAQ.map(f => (
                        <div key={f.q} className="px-4 py-3">
                            <p className="font-semibold text-[14px] text-gray-900">{f.q}</p>
                            <p className="text-[13px] text-gray-600 mt-1 leading-snug">{f.a}</p>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
