import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oezelkllavaxwxxlugpt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lemVsa2xsYXZheHd4eGx1Z3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODc3OTQsImV4cCI6MjA4NjU2Mzc5NH0.GqgONKUQjQhdJ8v710wEqOjb3AehJ1cJiu1JTUg-Q-Y';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: subjects, error: subError } = await supabase.from('subjects').select('*');
    console.log('--- SUBJECTS ---');
    console.log(JSON.stringify(subjects, null, 2));

    const { data: schedules, error: schError } = await supabase.from('schedules').select('*').limit(10);
    console.log('--- SCHEDULES (TOP 10) ---');
    console.log(JSON.stringify(schedules, null, 2));
}

check();
