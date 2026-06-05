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
const supabaseKey = getEnvVar('VITE_SUPABASE_SERVICE_ROLE_KEY') || getEnvVar('VITE_SUPABASE_ANON_KEY');
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTeachers() {
    // Quick map teacher name to uid
    const teachersToInsert = [
        { uid: 'TCH001', name: 'K.Nandha Kishore Reddy', role: 'TEACHER', password: '123', email: 'k.nandha@school.com', dept: 'CS' },
        { uid: 'TCH002', name: 'D.Chathurveda Reddy', role: 'TEACHER', password: '123', email: 'd.chathurveda@school.com', dept: 'CS' },
        { uid: 'TCH003', name: 'G.Trivendra Reddy', role: 'TEACHER', password: '123', email: 'g.trivendra@school.com', dept: 'CS' },
        { uid: 'TCH004', name: 'G.Trivindra Reddy', role: 'TEACHER', password: '123', email: 'g.trivindra.typo@school.com', dept: 'CS' }
    ];

    for (const t of teachersToInsert) {
        console.log(`Trying to insert ${t.uid}...`);
        const { data, error } = await supabase.from('users').insert(t).select();
        if (error) {
            console.error(`FAILED:`, error.message, error.details, error.hint);
        } else {
            console.log(`SUCCESS:`, data);
        }
    }
}

checkTeachers();
