import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oezelkllavaxwxxlugpt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lemVsa2xsYXZheHd4eGx1Z3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODc3OTQsImV4cCI6MjA4NjU2Mzc5NH0.GqgONKUQjQhdJ8v710wEqOjb3AehJ1cJiu1JTUg-Q-Y';
const supabase = createClient(supabaseUrl, supabaseKey);

async function clean() {
    console.log('--- CLEANING SUBJECTS ---');

    // First, check if Elective exists
    const { data: elective } = await supabase.from('subjects').select('*').eq('code', 'Elective');
    if (elective && elective.length > 0) {
        console.log('Found Elective subject. Attempting to delete...');
        const { error: delError } = await supabase.from('subjects').delete().eq('code', 'Elective');
        if (delError) {
            console.error('DELETE ERROR (likely foreign key):', delError);
            console.log('Attempting to UPDATE instead...');
            const { error: updError } = await supabase.from('subjects').update({ code: 'SCSBLH63', name: 'Smart Contracts' }).eq('code', 'Elective');
            if (updError) console.error('UPDATE ERROR:', updError);
            else console.log('Successfully updated Elective to Smart Contracts');
        } else {
            console.log('Successfully deleted Elective subject');
        }
    } else {
        console.log('Elective subject not found.');
    }

    // Now re-run insertion
    console.log('\n--- RE-INSERTING DATA ---');
    // We'll just run the insert_custom_timetable.js script again after this
}

clean();
