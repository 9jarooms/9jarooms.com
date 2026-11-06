import { NextRequest } from 'next/server';

// What the watch-only security policy would have blocked. Written to the server log only, never to
// the database, and only the two fields needed, so it cannot be used to fill anything up.
export async function POST(request: NextRequest) {
    const text = (await request.text().catch(() => '')).slice(0, 4000);
    try {
        const r = JSON.parse(text)['csp-report'] || {};
        const clean = (x: unknown) => String(x || '').replace(/[?#].*$/, '').replace(/[\r\n]/g, ' ').slice(0, 200);
        console.warn('[csp]', clean(r['effective-directive'] || r['violated-directive']), clean(r['blocked-uri']));
    } catch { /* not a report */ }
    return new Response(null, { status: 204 });
}
