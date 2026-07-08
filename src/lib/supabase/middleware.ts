import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Refresh session if expired
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;

    // Define protected routes and their required roles
    const protectedRoutes = [
        { path: '/crm', roles: ['customer_rep', 'admin'] },
        { path: '/admin', roles: ['admin'] },
        { path: '/owner', roles: ['owner', 'admin'] },
        { path: '/operator', roles: ['call_operator', 'admin'] },
        { path: '/caretaker', roles: ['caretaker', 'admin'] },
        { path: '/dashboard', roles: ['caretaker', 'owner', 'admin'] },
    ];

    const matchedRoute = protectedRoutes.find(r => pathname.startsWith(r.path));

    if (matchedRoute) {
        // If not logged in, redirect to login
        if (!user) {
            const url = request.nextUrl.clone();
            url.pathname = '/login';
            return NextResponse.redirect(url);
        }

        // Fetch the user's role from the database
        const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .single();

        const userRole = roleData?.role; // undefined/null means they are a normal customer

        // If user doesn't have the required role, redirect them away
        if (!userRole || !matchedRoute.roles.includes(userRole)) {
            const url = request.nextUrl.clone();
            
            // Redirect based on actual role
            if (userRole === 'admin') url.pathname = '/crm';
            else if (userRole === 'customer_rep') url.pathname = '/crm';
            else if (userRole === 'owner') url.pathname = '/owner';
            else if (userRole === 'call_operator') url.pathname = '/operator';
            else if (userRole === 'caretaker') url.pathname = '/dashboard';
            else url.pathname = '/account'; // Customers

            // Prevent infinite redirect loops if something goes weird
            if (url.pathname !== pathname) {
                return NextResponse.redirect(url);
            }
        }
    }

    return supabaseResponse;
}
