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
            const val = values.join('=').trim().replace(/(^"|"$)/g, '');
            envVars[key.trim()] = val;
        }
    });
}

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase URL or Service Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugRoles() {
    console.log('--- Debugging User Roles ---');

    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
        console.error('Error fetching auth users:', authError);
        return;
    }

    const { data: roles, error: roleError } = await supabase.from('user_roles').select('*');
    if (roleError) {
        console.error('Error fetching user roles:', roleError);
        return;
    }

    const { data: owners, error: ownerError } = await supabase.from('owners').select('*');

    console.log(`Found ${users.length} Auth Users, ${roles.length} Roles, ${owners?.length} Owners`);

    users.forEach(u => {
        const userRole = roles.find(r => r.user_id === u.id);
        const ownerProfile = owners?.find(o => o.user_id === u.id);

        console.log(`User: ${u.email} [${u.id}]`);
        console.log(` - Role Table: ${userRole ? userRole.role : 'NULL'}`);
        console.log(` - Owner Profile: ${ownerProfile ? 'Found' : 'Missing'}`);
        if (u.email?.includes('owner') || ownerProfile) {
            if (!userRole || userRole.role !== 'owner') {
                console.log('   *** WARNING: Missing or Incorrect Role! ***');
            }
        }
    });

    console.log('\n--- End Debug ---');
}

debugRoles();
