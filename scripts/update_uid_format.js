import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oezelkllavaxwxxlugpt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lemVsa2xsYXZheHd4eGx1Z3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODc3OTQsImV4cCI6MjA4NjU2Mzc5NH0.GqgONKUQjQhdJ8v710wEqOjb3AehJ1cJiu1JTUg-Q-Y';
const supabase = createClient(supabaseUrl, supabaseKey);

async function updateUidFormat() {
    console.log('--- UPDATING UID FORMAT TO TCH000X ---');

    const mapping = {
        'tch001': 'TCH0001',
        'tch002': 'TCH0002',
        'tch003': 'TCH0003'
    };

    for (const [oldUid, newUid] of Object.entries(mapping)) {
        // 1. Update user table
        const { error: userError } = await supabase
            .from('users')
            .update({ uid: newUid })
            .eq('uid', oldUid);
        
        if (userError) {
            console.error(`Error updating user ${oldUid}:`, userError);
        } else {
            console.log(`Updated user ${oldUid} to ${newUid}`);
        }

        // 2. Update schedules table
        const { error: scheduleError } = await supabase
            .from('schedules')
            .update({ teacher_uid: newUid })
            .eq('teacher_uid', oldUid);
        
        if (scheduleError) {
            console.error(`Error updating schedules for ${oldUid}:`, scheduleError);
        } else {
            console.log(`Updated schedules for ${oldUid} to ${newUid}`);
        }
    }
}

updateUidFormat();
