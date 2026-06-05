import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oezelkllavaxwxxlugpt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lemVsa2xsYXZheHd4eGx1Z3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODc3OTQsImV4cCI6MjA4NjU2Mzc5NH0.GqgONKUQjQhdJ8v710wEqOjb3AehJ1cJiu1JTUg-Q-Y';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fix() {
    console.log('--- STARTING DATABASE REPAIR ---');

    // 1. Delete all schedules (clean slate)
    console.log('Deleting all schedules...');
    const { error: schDelErr } = await supabase.from('schedules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (schDelErr) console.error('Schedule Delete Error:', schDelErr);

    // 2. Delete all subjects (clean slate)
    console.log('Deleting all subjects...');
    const { error: subDelErr } = await supabase.from('subjects').delete().neq('code', 'STAY_AWAY');
    if (subDelErr) {
        console.error('Subject Delete Error (likely FB constraint):', subDelErr);
        console.log('Attempting to update "Elective" to "SCSBLH63" instead...');
        const { error: subUpdErr } = await supabase.from('subjects').update({ code: 'SCSBLH63', name: 'Smart Contracts' }).eq('code', 'Elective');
        if (subUpdErr) console.error('Subject Update Error:', subUpdErr);
    }

    console.log('--- DATABASE REPAIR FINISHED ---');
    console.log('Now run node scripts/insert_custom_timetable.js');
}

fix();
