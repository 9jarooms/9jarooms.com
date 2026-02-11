import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET() {
    try {
        const supabase = createServerClient();

        // Test database connection
        const { data, error } = await supabase
            .from('properties')
            .select('count')
            .limit(1);

        if (error) {
            return NextResponse.json(
                { status: 'error', message: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            status: 'ok',
            database: 'connected',
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        return NextResponse.json(
            { status: 'error', message: 'Failed to connect to database' },
            { status: 500 }
        );
    }
}
