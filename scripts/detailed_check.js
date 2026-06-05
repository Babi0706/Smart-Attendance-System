import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oezelkllavaxwxxlugpt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lemVsa2xsYXZheHd4eGx1Z3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODc3OTQsImV4cCI6MjA4NjU2Mzc5NH0.GqgONKUQjQhdJ8v710wEqOjb3AehJ1cJiu1JTUg-Q-Y';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('--- SUBJECTS ---');
    const { data: subjects } = await supabase.from('subjects').select('*');
    subjects.forEach(s => console.log(`${s.code}: ${s.name}`));

    console.log('\n--- SCHEDULES FOR TUE 09:00 ---');
    const { data: schedules } = await supabase.from('schedules').select('*').eq('day_of_week', 'Tuesday').eq('start_time', '09:00:00');
    schedules.forEach(s => console.log(`${s.day_of_week} ${s.start_time} -> ${s.subject_code}`));

    console.log('\n--- TEACHERS BY SUBJECT ---');
    const { data: users } = await supabase.from('users').select('uid, name, role, subject').eq('role', 'TEACHER');
    users.forEach(u => console.log(`${u.name} (${u.uid}): ${u.subject}`));
}

check();
