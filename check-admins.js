
const { createClient } = require('@supabase/supabase-js');

const fs = require('fs');
const path = require('path');

// Load environment variables manually
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    const envContent = fs.readFileSync(envLocalPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            // Remove quotes if present
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
            }
            process.env[key] = value;
        }
    });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase Environment Variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAdmins() {
    console.log('Checking Admin Users...');

    // 1. Get all roles
    const { data: roles, error: roleError } = await supabase
        .from('user_roles')
        .select('*');

    if (roleError) {
        console.error('Error fetching roles:', roleError);
        return;
    }

    console.log(`Found ${roles.length} role entries.`);

    // 2. Get users for these roles (optional, but good for context)
    for (const r of roles) {
        const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(r.user_id);
        if (user) {
            console.log(`- Role: ${r.role}, Email: ${user.email}, ID: ${r.user_id}`);
        } else {
            console.log(`- Role: ${r.role}, User ID: ${r.user_id} (User not found)`);
        }
    }

    if (roles.length === 0) {
        console.log('⚠️ No users found in user_roles table!');
    }
}

checkAdmins();
