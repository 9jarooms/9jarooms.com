'use client';

import { useEffect, useState } from 'react';
import { Share, PlusSquare, MoreVertical, Download, ArrowRight } from 'lucide-react';

type Platform = 'ios' | 'android' | 'other';
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function StaffWelcome({ valid, name, enterHref }: { valid: boolean; name: string | null; enterHref: string }) {
    const [platform, setPlatform] = useState<Platform>('other');
    const [inApp, setInApp] = useState(false);
    const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
    const [installed, setInstalled] = useState(false);

    useEffect(() => {
        const standalone = window.matchMedia('(display-mode: standalone)').matches
            || (navigator as unknown as { standalone?: boolean }).standalone === true;
        // opened from the home-screen icon: go straight in
        if (valid && standalone) { window.location.replace(enterHref); return; }

        const t = setTimeout(() => {
            const ua = navigator.userAgent;
            setPlatform(/iPhone|iPad|iPod/i.test(ua) ? 'ios' : /Android/i.test(ua) ? 'android' : 'other');
            // WhatsApp / Instagram / Facebook in-app browsers can't add to home screen
            setInApp(/WhatsApp|FBAN|FBAV|Instagram|; wv\)/i.test(ua));
        }, 0);
        const onPrompt = (e: Event) => { e.preventDefault(); setInstallEvent(e as InstallEvent); };
        const onInstalled = () => setInstalled(true);
        window.addEventListener('beforeinstallprompt', onPrompt);
        window.addEventListener('appinstalled', onInstalled);
        return () => {
            clearTimeout(t);
            window.removeEventListener('beforeinstallprompt', onPrompt);
            window.removeEventListener('appinstalled', onInstalled);
        };
    }, [valid, enterHref]);

    const install = async () => {
        if (!installEvent) return;
        await installEvent.prompt();
        const choice = await installEvent.userChoice;
        if (choice.outcome === 'accepted') setInstalled(true);
        setInstallEvent(null);
    };

    if (!valid) {
        return (
            <Shell>
                <h1 className="text-[24px] font-extrabold tracking-tight text-stone-900">This link no longer works</h1>
                <p className="mt-3 text-[16px] leading-relaxed text-stone-600">
                    Ask the 9jaRooms team to send you a new link on WhatsApp.
                </p>
            </Shell>
        );
    }

    const first = name ? name.split(/\s+/)[0] : null;

    return (
        <Shell>
            <h1 className="text-[28px] leading-tight font-extrabold tracking-tight text-stone-900">
                {first ? <>Hi {first},</> : <>Welcome,</>}<br />this is your 9jaRooms app
            </h1>
            <p className="mt-3 text-[16px] leading-relaxed text-stone-600">
                Check guests in and out, take walk-in bookings and record payments, all from this phone.
            </p>

            <a href={enterHref}
                className="mt-6 h-16 w-full rounded-2xl bg-[#008737] active:bg-[#00762e] text-white text-[18px] font-extrabold flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(0,135,55,0.3)]">
                Open my Today screen <ArrowRight size={20} strokeWidth={2.5} />
            </a>

            <div className="mt-8 rounded-2xl bg-white border border-stone-200 p-5">
                <h2 className="text-[17px] font-extrabold text-stone-900">Put it on your home screen</h2>
                <p className="mt-1 text-[14px] text-stone-500">Do this once. After that, tap the 9jaRooms icon like any other app. You stay signed in.</p>

                {installed ? (
                    <p className="mt-4 text-[15px] font-bold text-[#008737]">Done. Look for the 9jaRooms icon on your home screen.</p>
                ) : installEvent ? (
                    <button type="button" onClick={install}
                        className="mt-4 h-14 w-full rounded-xl border-2 border-[#008737] text-[#008737] text-[16px] font-extrabold flex items-center justify-center gap-2 active:bg-[#008737]/5">
                        <Download size={18} /> Add 9jaRooms to my phone
                    </button>
                ) : inApp ? (
                    <Steps items={[
                        <>You opened this inside WhatsApp. Tap <b>⋯</b> or the compass icon and choose <b>Open in {platform === 'ios' ? 'Safari' : 'Chrome'}</b>.</>,
                        <>Then follow the steps that appear there.</>,
                    ]} />
                ) : platform === 'ios' ? (
                    <Steps items={[
                        <>Tap the <b>Share</b> button <Share size={16} className="inline -mt-1" /> at the bottom of Safari.</>,
                        <>Scroll down and tap <b>Add to Home Screen</b> <PlusSquare size={16} className="inline -mt-1" />.</>,
                        <>Tap <b>Add</b>.</>,
                    ]} />
                ) : (
                    <Steps items={[
                        <>Tap the <b>menu</b> <MoreVertical size={16} className="inline -mt-1" /> at the top right of Chrome.</>,
                        <>Tap <b>Add to Home screen</b> or <b>Install app</b>.</>,
                        <>Tap <b>Add</b> or <b>Install</b>.</>,
                    ]} />
                )}
            </div>

            <p className="mt-6 text-[13px] text-stone-400 text-center">This link is only for you. Please don&apos;t forward it.</p>
        </Shell>
    );
}

function Shell({ children }: { children: React.ReactNode }) {
    return (
        <main className="min-h-screen bg-[#f4f5f1] px-5 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-10">
            <div className="max-w-md mx-auto">
                <div className="flex items-center gap-2 mb-8">
                    <img src="/logo-transparent.png" alt="" className="h-8 w-auto" />
                    <span className="font-extrabold text-[19px] tracking-tight">9ja<span className="text-[#008737]">Rooms</span></span>
                </div>
                {children}
            </div>
        </main>
    );
}

function Steps({ items }: { items: React.ReactNode[] }) {
    return (
        <ol className="mt-4 space-y-3">
            {items.map((it, i) => (
                <li key={i} className="flex gap-3 text-[15px] leading-snug text-stone-700">
                    <span className="w-7 h-7 shrink-0 rounded-full bg-[#7ed957]/30 text-[#02572a] font-extrabold text-[14px] flex items-center justify-center">{i + 1}</span>
                    <span className="pt-0.5">{it}</span>
                </li>
            ))}
        </ol>
    );
}
