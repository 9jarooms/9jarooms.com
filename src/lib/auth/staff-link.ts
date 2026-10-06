import { createHmac, timingSafeEqual } from 'crypto';

// Personal sign-in links for staff who live on their phones. The admin
// sends a caretaker one link on WhatsApp; tapping it signs them straight
// into the Today screen, and the home-screen icon made from it keeps them
// signed in. No web address to remember, no password to type.
//
// Token = <user id, no dashes>.<version>.<signature>. The version lives in
// the auth user's app_metadata.staff_link_v; bumping it ("Reset link")
// makes every earlier link for that person stop working.

function secret(): string {
    const own = process.env.STAFF_LINK_SECRET;
    if (own) return own;
    const base = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!base) throw new Error('STAFF_LINK_SECRET or SUPABASE_SERVICE_ROLE_KEY must be set');
    // derived, so the raw service key is never what signs a public URL
    return createHmac('sha256', base).update('9jarooms-staff-link-v1').digest('base64url');
}

function sign(payload: string, key = secret()): string {
    return createHmac('sha256', key).update(payload).digest('base64url').slice(0, 24);
}

export function linkVersion(appMetadata: Record<string, unknown> | null | undefined): number {
    const v = Number(appMetadata?.staff_link_v);
    return Number.isInteger(v) && v > 0 ? v : 1;
}

export function makeStaffToken(userId: string, version: number, key?: string): string {
    const id = userId.replace(/-/g, '').toLowerCase();
    const payload = `${id}.${version.toString(36)}`;
    return `${payload}.${sign(payload, key)}`;
}

export function verifyStaffToken(token: string, key?: string): { userId: string; version: number } | null {
    const m = /^([0-9a-f]{32})\.([0-9a-z]{1,6})\.([A-Za-z0-9_-]{24})$/.exec(token || '');
    if (!m) return null;
    const [, id, v, sig] = m;
    const expected = sign(`${id}.${v}`, key);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const userId = `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
    return { userId, version: parseInt(v, 36) };
}

export function staffLinkPath(userId: string, version: number): string {
    return `/s/${makeStaffToken(userId, version)}`;
}

// 0803 123 4567 / +234 803… / 234803… → 2348031234567 (for wa.me links)
export function waNumber(phone: string | null | undefined): string | null {
    let d = String(phone || '').replace(/\D/g, '');
    if (!d) return null;
    if (d.startsWith('0')) d = '234' + d.slice(1);
    if (d.length === 10 && /^[789]/.test(d)) d = '234' + d;
    return d.length >= 11 ? d : null;
}
