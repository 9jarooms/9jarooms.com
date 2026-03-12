import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { error } = await supabase.rpc('execute_sql', {
    sql_string: 'ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;'
  });
  console.log("RPC result:", error);
  
  // Test if it works by selecting
  const { data, error: selectErr } = await supabase.from('properties').select('id, is_deleted').limit(1);
  console.log("Select result:", data, selectErr);
}
run();
