
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oezelkllavaxwxxlugpt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lemVsa2xsYXZheHd4eGx1Z3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODc3OTQsImV4cCI6MjA4NjU2Mzc5NH0.GqgONKUQjQhdJ8v710wEqOjb3AehJ1cJiu1JTUg-Q-Y';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEnrollment() {
    console.log("Checking student face enrollment status...");
    const { data: students, error } = await supabase
        .from('users')
        .select('uid, name, face_descriptor')
        .eq('role', 'STUDENT');

    if (error) {
        console.error("Error:", error.message);
        return;
    }

    console.log(`Total students: ${students.length}`);
    students.forEach(s => {
        const enrolled = s.face_descriptor && s.face_descriptor.length > 0;
        console.log(`- ${s.name} (${s.uid}): ${enrolled ? 'ENROLLED' : 'MISSING FACE DATA'}`);
    });
}

checkEnrollment();
