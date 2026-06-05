import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
    console.log("Inspecting 'users' table...");
    // Just select everything to see what keys we get
    const { data, error } = await supabase.from('users').select('*').limit(1);

    if (error) {
        console.error("Error fetching users:", error);
        // Try a broader query
        const { error: error2 } = await supabase.from('users').select('id').limit(1);
        if (error2) console.error("Error fetching only id:", error2);
    } else if (data && data.length > 0) {
        console.log("Success! Found user:", data[0].uid);
        console.log("All keys in user object:", Object.keys(data[0]));
    } else {
        console.log("Table 'users' is empty.");
    }
}

inspect();
