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
const supabaseKey = getEnvVar('VITE_SUPABASE_ANON_KEY');
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTeachers() {
    const { data: users, error } = await supabase.from('users').select('*').in('role', ['TEACHER']);
    if (error) {
        console.error("Error fetching users:", error);
    } else {
        console.log("Teachers in DB:", users.map(u => ({ uid: u.uid, name: u.name })));
    }
}

checkTeachers();
