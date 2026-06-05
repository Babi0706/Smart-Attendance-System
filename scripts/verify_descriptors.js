
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oezelkllavaxwxxlugpt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lemVsa2xsYXZheHd4eGx1Z3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODc3OTQsImV4cCI6MjA4NjU2Mzc5NH0.GqgONKUQjQhdJ8v710wEqOjb3AehJ1cJiu1JTUg-Q-Y';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyDescriptors() {
    console.log("Verifying face descriptors...");
    const { data: students, error } = await supabase
        .from('users')
        .select('uid, name, face_descriptor')
        .eq('role', 'STUDENT');

    if (error) {
        console.error("Error:", error.message);
        return;
    }

    students.forEach(s => {
        try {
            const desc = typeof s.face_descriptor === 'string' ? JSON.parse(s.face_descriptor) : s.face_descriptor;
            if (desc && Array.isArray(desc)) {
                console.log(`- ${s.name} (${s.uid}): VALID [Length: ${desc.length}]`);
            } else {
                console.log(`- ${s.name} (${s.uid}): INVALID FORMAT`);
            }
        } catch (e) {
            console.log(`- ${s.name} (${s.uid}): PARSE ERROR`);
        }
    });
}

verifyDescriptors();
