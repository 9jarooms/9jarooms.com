import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const { data, error } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', '7c4160e4-8c53-47fb-9c99-7d9451aaf78d');
  
  console.log('Role Data:', data);
  console.log('Error:', error);
}

check();
