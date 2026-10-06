import { NextResponse } from 'next/server';
import { verifyStaffToken } from '@/lib/auth/staff-link';

export const dynamic = 'force-dynamic';

// Per-person install manifest: the home-screen icon opens the personal
// link, which signs the phone back in if its session was ever cleared.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    if (!verifyStaffToken(token)) return new NextResponse('Not found', { status: 404 });
    return NextResponse.json(
        {
            name: '9jaRooms Today',
            short_name: '9jaRooms',
            start_url: `/s/${token}/enter`,
            scope: '/',
            display: 'standalone',
            theme_color: '#008737',
            background_color: '#f4f5f1',
            icons: [
                { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
                { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
            ],
        },
        { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-store' } }
    );
}
