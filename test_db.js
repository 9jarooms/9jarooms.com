const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking DB...");
    const { data, error } = await supabase.from('bookings').select('user_id').limit(1);
    if (error) {
        console.error("Error! Column may not exist:", error.message);
    } else {
        console.log("Success! user_id exists. Data:", data);
    }
}
check();
