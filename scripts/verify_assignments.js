import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oezelkllavaxwxxlugpt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lemVsa2xsYXZheHd4eGx1Z3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODc3OTQsImV4cCI6MjA4NjU2Mzc5NH0.GqgONKUQjQhdJ8v710wEqOjb3AehJ1cJiu1JTUg-Q-Y';
const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    console.log('--- VERIFYING TEACHERS ---');
    const { data: users } = await supabase.from('users').select('*').in('uid', ['TCH_NANDA', 'TCH_TRIVEN', 'TCH_CHARAN']);
    users.forEach(u => console.log(`UID: ${u.uid}, Name: ${u.name}`));

    console.log('\n--- VERIFYING SUBJECTS (8 total) ---');
    const { data: subjects } = await supabase.from('subjects').select('*');
    console.log(`Total Subjects: ${subjects.length}`);
    subjects.forEach(s => console.log(`[${s.code}] ${s.name} - Teacher: ${s.teacher}`));

    console.log('\n--- VERIFYING SCHEDULES ---');
    const { data: schedules } = await supabase.from('schedules').select('*, subjects(*)').limit(5);
    schedules.forEach(s => console.log(`${s.day_of_week} ${s.start_time} | Subject: ${s.subjects?.name} (${s.subject_code}) | Teacher UID: ${s.teacher_uid}`));
}

verify();
