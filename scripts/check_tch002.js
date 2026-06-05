import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf8');

const getEnvVar = (name) => {
    const regex = new RegExp(`^${name}=(.*)$`, 'm');
    const match = envContent.match(regex);
    return match ? match[1].trim() : null;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
// Use the service key if available, else anon
const supabaseKey = getEnvVar('VITE_SUPABASE_SERVICE_ROLE_KEY') || getEnvVar('VITE_SUPABASE_ANON_KEY');
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAndFixTeachers() {
    console.log("Using key:", supabaseKey.substring(0, 15) + "...");

    // We are going to query the full list of users to see IF TCH002 is actually there.
    const { data: users, error } = await supabase.from('users').select('uid, name').in('role', ['TEACHER']);
    console.log("Teachers in DB:", users);

    if (error) {
        console.error("Error fetching teachers:", error);
    }
}

checkAndFixTeachers();
