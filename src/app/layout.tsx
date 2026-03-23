import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "9jaRooms — The Right Room, Every Time",
  description: "9jaRooms: The Right Room, Every Time. Book clean, comfortable serviced apartments in Abuja. Short-let stays in Maitama, Wuse II, Asokoro, and more.",
  keywords: ["Abuja apartments", "short-let Abuja", "serviced apartments Nigeria", "9jaRooms", "Maitama apartments", "Wuse II"],
  openGraph: {
    title: "9jaRooms — The Right Room, Every Time",
    description: "Book clean, comfortable serviced apartments in Abuja.",
    type: "website",
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
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-gray-50 text-gray-900`}>
        {children}
      </body>
    </html>
  );
}
