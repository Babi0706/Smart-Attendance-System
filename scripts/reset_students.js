import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oezelkllavaxwxxlugpt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lemVsa2xsYXZheHd4eGx1Z3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODc3OTQsImV4cCI6MjA4NjU2Mzc5NH0.GqgONKUQjQhdJ8v710wEqOjb3AehJ1cJiu1JTUg-Q-Y';

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetStudents() {
    console.log("Fetching all students...");
    const { data: students, error: fetchError } = await supabase
        .from('users')
        .select('uid')
        .eq('role', 'STUDENT');

    if (fetchError) {
        console.error("Error fetching students:", fetchError);
        return;
    }

    if (!students || students.length === 0) {
        console.log("No students found.");
        return;
    }

    console.log(`Found ${students.length} students. Deleting...`);

    const uids = students.map(s => s.uid);

    // Check if attendance_logs exists and has these users
    console.log("Attempting to delete associated attendance logs...");
    const { error: logError } = await supabase
        .from('attendance_logs')
        .delete()
        .in('uid', uids);

    if (logError) {
        console.error("Error deleting attendance logs (might not exist):", logError);
    } else {
        console.log("Deleted associated attendance logs.");
    }

    const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .in('uid', uids);

    if (deleteError) {
        console.error("Error deleting students:", deleteError);
    } else {
        console.log("Successfully deleted all students!");
    }
}

resetStudents();
