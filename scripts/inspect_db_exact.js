import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
    const { data, error } = await supabase.from('users').select('*').limit(1);

    if (error) {
        console.error("Fetch error:", error);
        return;
    }

    if (data && data.length > 0) {
        const columns = Object.keys(data[0]);
        console.log("EXACT COLUMNS FOUND:", JSON.stringify(columns, null, 2));
    } else {
        console.log("No users found.");
    }
}

inspect();
