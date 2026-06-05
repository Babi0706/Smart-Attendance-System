import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oezelkllavaxwxxlugpt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lemVsa2xsYXZheHd4eGx1Z3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODc3OTQsImV4cCI6MjA4NjU2Mzc5NH0.GqgONKUQjQhdJ8v710wEqOjb3AehJ1cJiu1JTUg-Q-Y';
const supabase = createClient(supabaseUrl, supabaseKey);

async function removeSpecificTeachers() {
    console.log('--- REMOVING TEACHERS FOR FRESH SIGNUP ---');
    const teachers = ['TCH0001', 'TCH0002', 'TCH0003'];
    
    const { data, error } = await supabase
        .from('users')
        .delete()
        .in('uid', teachers);

    if (error) {
        console.error('Error deleting teachers:', error);
    } else {
        console.log(`Successfully removed teachers: ${teachers.join(', ')}`);
        console.log('Schedules were PRESERVED for mapping.');
    }
}

removeSpecificTeachers();
