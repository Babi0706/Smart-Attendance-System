import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oezelkllavaxwxxlugpt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lemVsa2xsYXZheHd4eGx1Z3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODc3OTQsImV4cCI6MjA4NjU2Mzc5NH0.GqgONKUQjQhdJ8v710wEqOjb3AehJ1cJiu1JTUg-Q-Y';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: subjects } = await supabase.from('subjects').select('*');
    const electiveSub = subjects.find(s => s.code === 'Elective' || s.name.toLowerCase().includes('elective'));
    const scsSub = subjects.find(s => s.code === 'SCSBLH63' || s.name.toLowerCase().includes('smart contracts'));

    console.log('--- SUBJECT FINDINGS ---');
    console.log('Elective Subject:', electiveSub ? JSON.stringify(electiveSub) : 'NOT FOUND');
    console.log('Smart Contracts Subject:', scsSub ? JSON.stringify(scsSub) : 'NOT FOUND');

    const { data: schedules } = await supabase.from('schedules').select('*, subjects(*)');
    const problemSchedules = schedules.filter(s => s.subject_code === 'Elective' || (s.subjects && s.subjects.code === 'Elective'));

    console.log('\n--- SCHEDULE FINDINGS ---');
    console.log('Schedules pointing to Elective:', problemSchedules.length);
    if (problemSchedules.length > 0) {
        console.log(JSON.stringify(problemSchedules, null, 2));
    }
}

check();
