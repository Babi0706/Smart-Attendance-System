import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oezelkllavaxwxxlugpt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lemVsa2xsYXZheHd4eGx1Z3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODc3OTQsImV4cCI6MjA4NjU2Mzc5NH0.GqgONKUQjQhdJ8v710wEqOjb3AehJ1cJiu1JTUg-Q-Y';
const supabase = createClient(supabaseUrl, supabaseKey);

async function updateCasing() {
    console.log('Updating "K.Nanda kishore Reddy" to "K.Nanda Kishore Reddy" in subjects table...');
    const { error } = await supabase
        .from('subjects')
        .update({ teacher: 'K.Nanda Kishore Reddy' })
        .eq('teacher', 'K.Nanda kishore Reddy');

    if (error) {
        console.error('Error updating casing:', error);
    } else {
        console.log('Successfully updated teacher name casing in the subjects table.');
    }
}

updateCasing();
