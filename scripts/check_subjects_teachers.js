import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oezelkllavaxwxxlugpt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lemVsa2xsYXZheHd4eGx1Z3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODc3OTQsImV4cCI6MjA4NjU2Mzc5NH0.GqgONKUQjQhdJ8v710wEqOjb3AehJ1cJiu1JTUg-Q-Y';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('--- ALL SUBJECTS ---');
    const { data: subjects } = await supabase.from('subjects').select('*');
    if (subjects) {
        subjects.forEach(s => console.log(`Code: ${s.code}, Name: ${s.name}`));
    }

    console.log('\n--- ALL TEACHERS ---');
    const { data: users } = await supabase.from('users').select('*').eq('role', 'TEACHER');
    if (users) {
        users.forEach(u => console.log(`UID: ${u.uid}, Name: ${u.name}, Subject: ${u.subject}`));
    } else {
        console.log('No teachers found with role = TEACHER');
    }
}

check();
