// test-db.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function test() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing Supabase credentials in .env.local');
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Verify caretakers table works
    const { data: caretakers, error: fetchError } = await supabase
        .from('caretakers')
        .select('*')
        .limit(1);

    if (fetchError) {
        console.error('❌ Failed to fetch caretakers:', fetchError.message);
        return;
    }
    console.log('✅ Caretakers table exists. Found:', caretakers.length);

    if (caretakers.length === 0) {
        console.log('No caretakers found to test with.');
        return;
    }

    const testCaretakerId = caretakers[0].id;

    // 2. Test inserting into telegram_connect_tokens
    const fakeToken = require('crypto').randomUUID().replace(/-/g, '');
    
    console.log(`Testing insert for caretaker ${testCaretakerId} with token ${fakeToken}...`);

    const { error: insertError } = await supabase
        .from('telegram_connect_tokens')
        .insert({
            token: fakeToken,
            caretaker_id: testCaretakerId,
        });

    if (insertError) {
        console.error('❌ Failed to insert token. Did you run the SQL migration? Error:', insertError.message);
        return;
    }
    
    console.log('✅ Successfully inserted token into telegram_connect_tokens!');

    // Cleanup
    await supabase.from('telegram_connect_tokens').delete().eq('token', fakeToken);
    console.log('✅ Cleanup successful.');
}

test();
