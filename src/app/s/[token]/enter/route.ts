import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyStaffToken, linkVersion } from '@/lib/auth/staff-link';

export const dynamic = 'force-dynamic';

const STAFF_ROLES = ['caretaker', 'admin', 'customer_rep'];

// Tap the personal link → signed in → Today screen. Also the start URL of
// the home-screen icon, so a phone whose session was cleared signs itself
// back in instead of showing a password form.
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const fail = (reason: string) => {
        const url = new URL('/login', request.url);
        url.searchParams.set('link', reason);
        return NextResponse.redirect(url);
    };

    const parsed = verifyStaffToken(token);
    if (!parsed) return fail('invalid');

    const admin = createAdminClient();
    const { data: found } = await admin.auth.admin.getUserById(parsed.userId);
    const staff = found?.user;
    if (!staff?.email) return fail('invalid');
    if (linkVersion(staff.app_metadata) !== parsed.version) return fail('expired');

    const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', staff.id);
    const have = new Set((roles || []).map(r => r.role as string));
    if (!STAFF_ROLES.some(r => have.has(r))) return fail('removed');
    const dest = have.has('caretaker') && !have.has('admin') && !have.has('customer_rep') ? '/dashboard' : '/crm/today';

    const response = NextResponse.redirect(new URL(dest, request.url));
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll: () => request.cookies.getAll(),
                setAll: cookies => cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
            },
        }
    );

    // already signed in as this person: just open the app
    const { data: { user: current } } = await supabase.auth.getUser();
    if (current?.id === staff.id) return response;
    if (current) await supabase.auth.signOut({ scope: 'local' });

    // Mint a one-time sign-in for this user and redeem it immediately on the
    // server; nothing is emailed.
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email: staff.email });
    const hashed = link?.properties?.hashed_token;
    if (linkError || !hashed) {
        console.error('[staff-link] generateLink failed:', linkError?.message);
        return fail('error');
    }
    const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: hashed, type: 'magiclink' });
    if (verifyError) {
        console.error('[staff-link] verifyOtp failed:', verifyError.message);
        return fail('error');
    }
    return response;
}
