'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { useLiveUpdates } from './shared';

// A pop-up (with a short sound and a buzz) the moment someone else books, locks a room or money
// comes in: on every signed-in phone and computer, without refreshing. When the app is in the
// background and alerts are allowed, the phone shows a notification instead.
interface Ev { id: string; at: string; kind: string; who: string; text: string; detail?: string; amount?: number; by?: string | null }
const ALERT_KINDS = ['booking', 'online', 'lock', 'payment'];
const naira = (n?: number) => `₦${Math.round(Number(n || 0)).toLocaleString('en-NG')}`;

function chime() {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(880, ctx.currentTime); o.frequency.setValueAtTime(1320, ctx.currentTime + 0.12);
        g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
        o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.36);
    } catch { /* no sound available */ }
    try { navigator.vibrate?.([120, 60, 120]); } catch { /* ignore */ }
}

// Phone notifications (even with the app closed): register this device with the server.
export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
function keyBytes(b64: string) {
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
export async function subscribeDevice() {
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!pushSupported() || !key || Notification.permission !== 'granted') return false;
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
    const res = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub.toJSON()) }).catch(() => null);
    return !!res?.ok;
}

export default function LiveAlerts({ href }: { href: string }) {
    const [toasts, setToasts] = useState<Ev[]>([]);
    const seen = useRef<Set<string> | null>(null);   // null until the first load (nothing old pops up)
    const [askAlerts, setAskAlerts] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => {
            try { setAskAlerts('Notification' in window && Notification.permission === 'default' && localStorage.getItem('alerts-asked') !== '1'); } catch { /* ignore */ }
            // already allowed on this device: make sure the server still knows it (keys can change)
            subscribeDevice().catch(() => {});
        }, 0);
        return () => clearTimeout(t);
    }, []);

    const check = useCallback(async () => {
        const res = await fetch('/api/crm/activity?days=1', { cache: 'no-store' }).catch(() => null);
        if (!res?.ok) return;
        const j = await res.json();
        const events: Ev[] = (j.events || []).filter((e: Ev) => ALERT_KINDS.includes(e.kind) && e.by !== j.me);
        if (!seen.current) { seen.current = new Set(events.map(e => e.id)); return; }
        const fresh = events.filter(e => !seen.current!.has(e.id) && Date.now() - new Date(e.at).getTime() < 30 * 60 * 1000);
        events.forEach(e => seen.current!.add(e.id));
        if (!fresh.length) return;
        chime();
        setToasts(t => [...fresh.slice(0, 3), ...t].slice(0, 3));
        fresh.slice(0, 3).forEach(e => setTimeout(() => setToasts(t => t.filter(x => x.id !== e.id)), 9000));
        if (!pushSupported() && document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted') {
            for (const e of fresh.slice(0, 3)) {
                try { new Notification('9jaRooms', { body: `${e.who ? e.who + ' ' : ''}${e.text}${e.amount ? ` · ${naira(e.amount)}` : ''}`, icon: '/logo-transparent.png', tag: e.id }); } catch { /* ignore */ }
            }
        }
    }, []);
    useEffect(() => { check(); }, [check]);
    useLiveUpdates(check);

    const allow = async () => {
        try { localStorage.setItem('alerts-asked', '1'); } catch { /* ignore */ }
        setAskAlerts(false);
        try {
            const p = await Notification.requestPermission();
            if (p === 'granted') await subscribeDevice();
        } catch { /* ignore */ }
    };

    return (
        <div className="fixed top-2 inset-x-2 sm:left-auto sm:right-4 sm:w-96 z-[60] space-y-2 pointer-events-none">
            {askAlerts && (
                <div className="pointer-events-auto rounded-2xl bg-white border border-gray-200 shadow-lg px-4 py-3 text-[13px] text-gray-700 flex items-center gap-3">
                    <BellRing size={18} className="text-green-600 shrink-0" />
                    <span className="flex-1">Get a phone notification when a booking or payment comes in (even when the app is closed)?</span>
                    <button onClick={allow} className="font-semibold text-green-700">Allow</button>
                    <button onClick={() => { setAskAlerts(false); try { localStorage.setItem('alerts-asked', '1'); } catch { /* ignore */ } }} aria-label="Not now" className="text-gray-400"><X size={16} /></button>
                </div>
            )}
            {toasts.map(e => (
                <a key={e.id} href={href} className="pointer-events-auto block rounded-2xl bg-gray-900 text-white shadow-xl px-4 py-3">
                    <p className="text-[10.5px] font-semibold uppercase tracking-wider text-green-300">{e.kind === 'payment' ? 'Payment in' : e.kind === 'lock' ? 'Room locked' : 'New booking'}</p>
                    <p className="text-[14px] leading-snug mt-0.5">{e.who && <b>{e.who} </b>}{e.text}{e.amount ? <b> · {naira(e.amount)}</b> : null}</p>
                    {e.detail && <p className="text-[12px] text-white/60 truncate">{e.detail}</p>}
                </a>
            ))}
        </div>
    );
}

// "Phone notifications" on the account page: turn on, see the state, and the iPhone instructions
export function NotificationsSetting() {
    const [state, setState] = useState<'checking' | 'on' | 'off' | 'blocked' | 'iphone' | 'unsupported'>('checking');
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        const t = setTimeout(async () => {
            const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
            const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
            if (!pushSupported()) { setState(ios && !standalone ? 'iphone' : 'unsupported'); return; }
            if (Notification.permission === 'denied') { setState('blocked'); return; }
            if (Notification.permission !== 'granted') { setState('off'); return; }
            const reg = await navigator.serviceWorker.getRegistration('/sw.js');
            setState((await reg?.pushManager.getSubscription()) ? 'on' : 'off');
        }, 0);
        return () => clearTimeout(t);
    }, []);
    const turnOn = async () => {
        setBusy(true);
        try {
            const p = await Notification.requestPermission();
            setState(p === 'granted' ? ((await subscribeDevice()) ? 'on' : 'off') : p === 'denied' ? 'blocked' : 'off');
        } finally { setBusy(false); }
    };
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2"><BellRing size={17} className="text-green-600" /> Phone notifications</h2>
            <p className="text-sm text-gray-500 mt-1">A notification on this phone for every new booking, room lock and payment, even when the app is closed.</p>
            <div className="mt-4 text-sm">
                {state === 'checking' && <p className="text-gray-400">Checking…</p>}
                {state === 'on' && (
                    <div className="flex items-center gap-3 flex-wrap">
                        <p className="text-green-700 font-semibold">On for this phone.</p>
                        <button onClick={async () => { const r = await fetch('/api/push/test', { method: 'POST' }).then(x => x.json()).catch(() => null); alert(r?.sent ? 'Sent. It should appear in a few seconds.' : 'Could not send. Turn notifications off and on in the phone settings, then try again.'); }}
                            className="px-3 py-2 rounded-xl border border-gray-200 text-gray-700 font-semibold">Send a test notification</button>
                    </div>
                )}
                {state === 'off' && <button onClick={turnOn} disabled={busy} className="px-4 py-2.5 rounded-xl bg-green-600 text-white font-semibold">{busy ? 'Turning on…' : 'Turn on notifications'}</button>}
                {state === 'blocked' && <p className="text-amber-800">Notifications are blocked for this site. Open the phone&apos;s Settings → apps / site settings → 9jaRooms → Notifications → Allow, then come back here.</p>}
                {state === 'iphone' && <p className="text-amber-800">On iPhone: tap Share → “Add to Home Screen”, open 9jaRooms from that new icon, then come back to this page and turn notifications on. (Needs iOS 16.4 or newer.)</p>}
                {state === 'unsupported' && <p className="text-gray-500">This browser cannot show notifications. Use Chrome on Android, or the Home Screen app on iPhone.</p>}
            </div>
        </div>
    );
}
