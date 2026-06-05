import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oezelkllavaxwxxlugpt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lemVsa2xsYXZheHd4eGx1Z3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODc3OTQsImV4cCI6MjA4NjU2Mzc5NH0.GqgONKUQjQhdJ8v710wEqOjb3AehJ1cJiu1JTUg-Q-Y';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: subjects } = await supabase.from('subjects').select('*');
    console.log('---SUBJECT_LIST_START---');
    subjects.forEach(s => console.log(`SUBJECT|${s.code}|${s.name}`));
    console.log('---SUBJECT_LIST_END---');

    const { data: users } = await supabase.from('users').select('*');
    console.log('---USER_LIST_START---');
    users.forEach(u => console.log(`USER|${u.uid}|${u.name}|${u.role}|${u.subject}`));
    console.log('---USER_LIST_END---');
}

check();
