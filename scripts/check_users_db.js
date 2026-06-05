import { supabase } from '../src/config/supabase.js';

async function check() {
    const { data, error } = await supabase.from('users').select('*');
    if (error) {
        console.error("Error:", error);
    } else {
        console.log(`Found ${data.length} users in DB.`);
        console.log("First user:", JSON.stringify(data[0] || {}, null, 2));
    }
}
check();
