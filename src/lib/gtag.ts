export const GA_TAG_ID = 'AW-18080006205';

declare global {
    interface Window {
        gtag: (...args: unknown[]) => void;
    }
}

export function trackConversion(label: string, value?: number) {
    if (typeof window === 'undefined' || !window.gtag) return;
    window.gtag('event', 'conversion', {
        send_to: `${GA_TAG_ID}/${label}`,
        ...(value !== undefined && { value, currency: 'NGN' }),
    });
}
