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
    console.log("Testing insert with NULL teacher_uid...");

    // We try to insert a fake schedule with a null teacher.
    const { error } = await supabase.from('schedules').insert({
        subject_code: 'Elective', // We assume Elective exists since we insert it
        teacher_uid: null,
        day_of_week: 'Monday',
        start_time: '9:00 AM'
    });

    if (error) {
        console.error("Error inserting NULL teacher:", error.message, error.details);
    } else {
        console.log("Successfully inserted NULL teacher.");
        // Clean up
        await supabase.from('schedules').delete().eq('subject_code', 'Elective').is('teacher_uid', null);
    }
}

checkTeachers();
