import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google"; // Added Playfair_Display
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: "9jaRooms — Serviced Apartments in Abuja",
  description: "Book clean, comfortable serviced apartments in Abuja. Short-let stays in Maitama, Wuse II, Asokoro, and more.",
  keywords: ["Abuja apartments", "short-let Abuja", "serviced apartments Nigeria", "9jaRooms", "Maitama apartments", "Wuse II"],
  openGraph: {
    title: "9jaRooms — Serviced Apartments in Abuja",
    description: "Book clean, comfortable serviced apartments in Abuja.",
    type: "website",
  },
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
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
      <body className={`${inter.variable} ${playfair.variable} font-sans antialiased bg-gray-50 text-gray-900`}>
        {children}
      </body>
    </html>
  );
}
