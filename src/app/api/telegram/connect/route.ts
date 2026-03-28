import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/server';
import crypto from 'crypto';

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
        const { data: caretaker } = await admin
            .from('caretakers')
            .select('id')
            .eq('id', user.id)
            .single();

        if (!caretaker) return NextResponse.json({ error: 'Not a caretaker' }, { status: 403 });

        // Generate unique token
        const token = crypto.randomBytes(16).toString('hex');

        // Cleanup old tokens for this caretaker
        await admin
            .from('telegram_connect_tokens')
            .delete()
            .eq('caretaker_id', user.id);

        // Insert new token
        await admin
            .from('telegram_connect_tokens')
            .insert({
                token,
                caretaker_id: user.id,
            });

        const deepLink = `https://t.me/${BOT_USERNAME}?start=${token}`;

        return NextResponse.json({ url: deepLink });
    } catch (error) {
        console.error('Telegram connect POST error:', error);
        return NextResponse.json({ error: 'Failed to generate link' }, { status: 500 });
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
