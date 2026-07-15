import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
    return await updateSession(request);
}

export const config = {
    // Only run the auth/session middleware on the role-protected areas. It used
    // to run on EVERY request (public pages + all API routes), adding a Supabase
    // Auth round-trip to each one — the main source of site-wide lag. Public
    // pages need no session, and API routes do their own auth (requireCrm /
    // requireAdmin), so scoping this here removes a network hop from nearly
    // every request without weakening protection.
    matcher: [
        '/crm/:path*',
        '/admin/:path*',
        '/owner/:path*',
        '/operator/:path*',
        '/dashboard/:path*',
        '/caretaker/:path*',
    ],
};
