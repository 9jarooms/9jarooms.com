require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
    console.log('Checking user_roles table...');
    const { data, error } = await supabase.from('user_roles').select('*').limit(1);
    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('Table exists. Data:', data);
    }
}

check();
