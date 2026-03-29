import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/server';

const BOT_USERNAME = 'naijaroomsbot';

// GET — Check if caretaker is connected
export async function GET() {
    try {
        const supabase = await createAuthClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const admin = createAdminClient();
        const { data: caretaker } = await admin
            .from('caretakers')
            .select('telegram_chat_id')
            .eq('id', user.id)
            .single();

        return NextResponse.json({
            connected: !!caretaker?.telegram_chat_id,
            chatId: caretaker?.telegram_chat_id || null,
        });
    } catch (error) {
        console.error('Telegram connect GET error:', error);
        return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
    }
}

// POST — Generate a deep-link token and return the bot URL
export async function POST() {
    try {
        const supabase = await createAuthClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const admin = createAdminClient();

        // Verify they are a caretaker
        const { data: caretaker, error: caretakerError } = await admin
            .from('caretakers')
            .select('id')
            .eq('id', user.id)
            .single();

        if (caretakerError) {
            console.error('Caretaker fetch error:', caretakerError);
            return NextResponse.json({ error: 'Database error fetching caretaker: ' + caretakerError.message }, { status: 500 });
        }
        if (!caretaker) return NextResponse.json({ error: 'Not a caretaker' }, { status: 403 });

        // Generate unique token (using web crypto for Edge compatibility)
        const token = crypto.randomUUID().replace(/-/g, '');

        // Cleanup old tokens for this caretaker
        const { error: deleteError } = await admin
            .from('telegram_connect_tokens')
            .delete()
            .eq('caretaker_id', user.id);

        if (deleteError) {
            console.error('Token delete error:', deleteError);
            return NextResponse.json({ error: 'Database error cleaning up tokens: ' + deleteError.message }, { status: 500 });
        }

        // Insert new token
        const { error: insertError } = await admin
            .from('telegram_connect_tokens')
            .insert({
                token,
                caretaker_id: user.id,
            });

        if (insertError) {
            console.error('Token insert error:', insertError);
            return NextResponse.json({ error: 'Database error inserting token: ' + insertError.message }, { status: 500 });
        }

        const deepLink = `https://t.me/${BOT_USERNAME}?start=${token}`;

        return NextResponse.json({ url: deepLink });
    } catch (error: any) {
        console.error('Telegram connect POST error:', error);
        return NextResponse.json({ error: error.message || 'Failed to generate link' }, { status: 500 });
    }
}

// DELETE — Disconnect Telegram
export async function DELETE() {
    try {
        const supabase = await createAuthClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const admin = createAdminClient();
        await admin
            .from('caretakers')
            .update({ telegram_chat_id: null })
            .eq('id', user.id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Telegram disconnect error:', error);
        return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
    }
}
