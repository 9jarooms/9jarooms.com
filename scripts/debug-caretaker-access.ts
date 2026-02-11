import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Manual env parsing
const envPath = path.resolve(process.cwd(), '.env.local');
const envVars: Record<string, string> = {};

if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const [key, ...values] = line.split('=');
        if (key && values.length > 0) {
            // Simple parsing, handles basic KEY=VALUE and KEY="VALUE"
            const val = values.join('=').trim().replace(/(^"|"$)/g, '');
            envVars[key.trim()] = val;
        }
    });
}

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase URL or Service Key in .env.local');
    // console.log('Env vars found keys:', Object.keys(envVars));
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugAccess() {
    console.log('--- Debugging Caretaker Access ---');

    // 1. List all Caretakers
    const { data: caretakers, error: ctError } = await supabase.from('caretakers').select('*');
    if (ctError) {
        console.error('Error fetching caretakers:', ctError);
        return;
    }
    console.log(`Found ${caretakers.length} caretakers in table:`);
    caretakers.forEach(c => console.log(` - [${c.id}] ${c.name} (${c.email})`));

    // 2. List all Properties and their Caretaker IDs
    const { data: properties, error: propError } = await supabase.from('properties').select('id, name, caretaker_id');
    if (propError) {
        console.error('Error fetching properties:', propError);
        return;
    }
    console.log(`\nFound ${properties.length} properties:`);
    properties.forEach(p => {
        const assigned = caretakers.find(c => c.id === p.caretaker_id);
        console.log(` - Property: "${p.name}" assigned to: ${p.caretaker_id ? `[${p.caretaker_id}] ${assigned ? assigned.name : 'Unknown ID (Mismatch!)'}` : 'NULL'}`);
    });

    // 3. List Auth Users (Admin API) to verify IDs match Auth
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
        console.error('Error fetching auth users:', authError);
    } else {
        console.log(`\nFound ${users.length} Auth Users:`);
        users.forEach(u => {
            const isCaretaker = caretakers.find(c => c.id === u.id);
            if (isCaretaker || (u.email && u.email.includes('caretaker'))) {
                console.log(` - Auth User: ${u.email} [${u.id}] -> Matches Caretaker Table? ${!!isCaretaker}`);
            }
        });
    }

    console.log('\n--- End Debug ---');
}

debugAccess();
