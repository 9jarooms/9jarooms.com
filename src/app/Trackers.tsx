'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Script from 'next/script';

// Meta Pixel and Google tag for the public website only. Never on staff pages (next to login cookies
// and guest data) or the payment page. On the confirmation page they load after the page has removed
// the payment reference from the address, so it is never sent to them.
const PRIVATE = ['/crm', '/dashboard', '/owner', '/operator', '/admin', '/login', '/account', '/booking/pay', '/forgot-password'];

export default function Trackers() {
    const pathname = usePathname() || '/';
    const delayed = pathname.startsWith('/booking');
    const [ready, setReady] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setReady(true), delayed ? 1500 : 0);
        return () => clearTimeout(t);
    }, [delayed]);
    if (!ready || PRIVATE.some(p => pathname.startsWith(p))) return null;
    return (
        <>
            {/* Meta Pixel */}
            <Script id="meta-pixel" strategy="afterInteractive">{`
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window,document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init','1306721788058369');
              fbq('track','PageView');
            `}</Script>

            {/* Google Tag (gtag.js) */}
            <Script src="https://www.googletagmanager.com/gtag/js?id=AW-18080006205" strategy="afterInteractive" />
            <Script id="gtag-init" strategy="afterInteractive">{`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'AW-18080006205');
            `}</Script>
        </>
    );
}
