import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://oezelkllavaxwxxlugpt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lemVsa2xsYXZheHd4eGx1Z3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODc3OTQsImV4cCI6MjA4NjU2Mzc5NH0.GqgONKUQjQhdJ8v710wEqOjb3AehJ1cJiu1JTUg-Q-Y';
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    const { data: teachers } = await supabase.from('users').select('*').eq('role', 'TEACHER');
    const { data: subjects } = await supabase.from('subjects').select('*');
    const { data: schedules } = await supabase.from('schedules').select('*');
    const { data: allUsers } = await supabase.from('users').select('*');

    const results = {
        teachers,
        subjects,
        schedules,
        allUsersCount: allUsers.length
    };

    fs.writeFileSync('db_inspection.json', JSON.stringify(results, null, 2));
    console.log('Results written to db_inspection.json');
}

inspect();
