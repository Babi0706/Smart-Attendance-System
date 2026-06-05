import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oezelkllavaxwxxlugpt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lemVsa2xsYXZheHd4eGx1Z3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODc3OTQsImV4cCI6MjA4NjU2Mzc5NH0.GqgONKUQjQhdJ8v710wEqOjb3AehJ1cJiu1JTUg-Q-Y';
const supabase = createClient(supabaseUrl, supabaseKey);

async function resetTeachers() {
    console.log('--- RESETTING TEACHERS ---');

    // 1. Delete all teachers
    const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('role', 'TEACHER');

    if (deleteError) {
        console.error('Error deleting teachers:', deleteError);
        return;
    }
    console.log('Deleted all existing teachers.');

    // 2. Clear teacher_uid from schedules (optional but good for clean state)
    const { error: updateError } = await supabase
        .from('schedules')
        .update({ teacher_uid: null })
        .not('teacher_uid', 'is', null);

    if (updateError) {
        console.error('Error clearing teacher_uid in schedules:', updateError);
    } else {
        console.log('Cleared teacher_uid from all schedules.');
    }
}

resetTeachers();
