import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: "Shortlets & Apartments in Abuja",
    description: "Browse shortlets and serviced apartments in Abuja. Filter by area, price, and dates. Fully furnished stays in Maitama, Wuse II, Asokoro, Gwarinpa, Jabi and more. Book instantly.",
    keywords: [
        "shortlets Abuja", "shortlet Abuja", "apartments Abuja",
        "serviced apartments Abuja", "Maitama shortlet", "Wuse II apartment",
        "Asokoro shortlet", "Gwarinpa shortlet", "furnished apartment Abuja",
    ],
    alternates: {
        canonical: '/properties',
    },
};

export default function PropertiesLayout({ children }: { children: React.ReactNode }) {
    return children;
}
