import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oezelkllavaxwxxlugpt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lemVsa2xsYXZheHd4eGx1Z3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODc3OTQsImV4cCI6MjA4NjU2Mzc5NH0.GqgONKUQjQhdJ8v710wEqOjb3AehJ1cJiu1JTUg-Q-Y';
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectData() {
    console.log('--- START INSPECTION ---');
    
    // Check users table
    const { data: users, error: userError } = await supabase.from('users').select('role, uid, name');
    if (userError) {
        console.error('Users error:', userError);
    } else {
        console.log('Total in users table:', users.length);
        const roles = users.reduce((acc, u) => {
            acc[u.role] = (acc[u.role] || 0) + 1;
            return acc;
        }, {});
        console.log('Roles found:', roles);
    }

    // Check if there is a separate students table
    const { data: students, error: studentError } = await supabase.from('students').select('uid, name');
    if (studentError) {
        if (studentError.code === 'PGRST116' || studentError.message.includes('not found')) {
            console.log('No separate students table found.');
        } else {
            console.error('Students error:', studentError);
        }
    } else {
        console.log('Total in students table:', students.length);
    }
    
    console.log('--- END INSPECTION ---');
}

inspectData();
