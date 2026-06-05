import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oezelkllavaxwxxlugpt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lemVsa2xsYXZheHd4eGx1Z3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODc3OTQsImV4cCI6MjA4NjU2Mzc5NH0.GqgONKUQjQhdJ8v710wEqOjb3AehJ1cJiu1JTUg-Q-Y';
const supabase = createClient(supabaseUrl, supabaseKey);

async function refineCharanProfile() {
    console.log('--- REFINING T. CHARAN TEJA PROFILE ---');

    // 1. Update Name (trim space), Dept (Teacher -> CS)
    const { error: userError } = await supabase
        .from('users')
        .update({ 
            name: 'T.Charan Teja',
            dept: 'CS' 
        })
        .eq('uid', 'TCH0001');

    if (userError) {
        console.error('Error updating user record:', userError);
    } else {
        console.log('Successfully updated name and department for TCH0001.');
    }

    // 2. Re-assign Database Systems (SCSB1662) to Charan
    const { error: scheduleError } = await supabase
        .from('schedules')
        .update({ teacher_uid: 'TCH0001' })
        .eq('subject_code', 'SCSB1662');

    if (scheduleError) {
        console.error('Error re-assigning Database Systems:', scheduleError);
    } else {
        console.log('Successfully assigned Database Systems (SCSB1662) to TCH0001.');
    }
}

refineCharanProfile();
