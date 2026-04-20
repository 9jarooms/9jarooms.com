import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://9jarooms.com'),
  title: {
    default: "9jaRooms — Shortlets & Serviced Apartments in Abuja",
    template: "%s | 9jaRooms",
  },
  description: "Book clean, affordable shortlets and serviced apartments in Abuja. Find fully furnished stays in Maitama, Wuse II, Asokoro, Gwarinpa, Jabi and more. Instant booking, pay with Paystack.",
  keywords: [
    "shortlets in Abuja", "short let Abuja", "shortlet Abuja",
    "serviced apartments Abuja", "furnished apartments Abuja",
    "short stay Abuja", "Abuja accommodation", "apartments in Maitama",
    "apartments in Wuse II", "apartments in Asokoro", "apartments in Gwarinpa",
    "Abuja shortlet booking", "9jaRooms", "shortlets Nigeria",
  ],
  openGraph: {
    title: "9jaRooms — Shortlets & Serviced Apartments in Abuja",
    description: "Book clean, affordable shortlets in Abuja. Maitama, Wuse II, Asokoro, Gwarinpa and more. Instant booking.",
    type: "website",
    siteName: "9jaRooms",
    locale: "en_NG",
    images: [{ url: '/logo.png', width: 1200, height: 630, alt: '9jaRooms — Shortlets in Abuja' }],
  },
  twitter: {
    card: "summary_large_image",
    title: "9jaRooms — Shortlets & Serviced Apartments in Abuja",
    description: "Book clean, affordable shortlets in Abuja. Instant booking, pay with Paystack.",
    images: ['/logo.png'],
  },
  manifest: '/site.webmanifest',
  alternates: {
    canonical: '/',
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-gray-50 text-gray-900`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "LocalBusiness",
              "name": "9jaRooms",
              "description": "Shortlets and serviced apartments in Abuja, Nigeria. Find fully furnished stays in Maitama, Wuse II, Asokoro, Gwarinpa and more.",
              "url": process.env.NEXT_PUBLIC_SITE_URL || "https://9jarooms.com",
              "logo": `${process.env.NEXT_PUBLIC_SITE_URL || "https://9jarooms.com"}/logo.png`,
              "image": `${process.env.NEXT_PUBLIC_SITE_URL || "https://9jarooms.com"}/logo.png`,
              "address": {
                "@type": "PostalAddress",
                "addressLocality": "Abuja",
                "addressRegion": "FCT",
                "addressCountry": "NG",
              },
              "areaServed": {
                "@type": "City",
                "name": "Abuja",
              },
              "priceRange": "₦₦",
              "sameAs": [],
            }),
          }}
        />
        {children}

        {/* Google Tag (gtag.js) */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=AW-18080006205"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'AW-18080006205');
          `}
        </Script>
      </body>
    </html>
  );
}
