const { createClient } = require('@supabase/supabase-client');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
    const { data, error } = await supabase
        .from('users')
        .select('role');

    if (error) {
        console.error('Error fetching users:', error);
        return;
    }

    const counts = {};
    data.forEach(u => {
        counts[u.role] = (counts[u.role] || 0) + 1;
    });

    console.log('User counts by role:', counts);
    console.log('Total users:', data.length);
}

checkUsers();
