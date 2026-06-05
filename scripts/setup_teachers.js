import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oezelkllavaxwxxlugpt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lemVsa2xsYXZheHd4eGx1Z3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODc3OTQsImV4cCI6MjA4NjU2Mzc5NH0.GqgONKUQjQhdJ8v710wEqOjb3AehJ1cJiu1JTUg-Q-Y';
const supabase = createClient(supabaseUrl, supabaseKey);

async function setupTeachers() {
    console.log('--- SETTING UP NEW TEACHERS ---');

    const teachers = [
        { uid: 'tch001', name: 'T.Charan Teja', role: 'TEACHER', email: 'charan@school.com', password: '123', dept: 'CS' },
        { uid: 'tch002', name: 'G.V.Trivendra Reddy', role: 'TEACHER', email: 'trivendra@school.com', password: '123', dept: 'CS' },
        { uid: 'tch003', name: 'K.Nanda Kishore Reddy', role: 'TEACHER', email: 'nanda@school.com', password: '123', dept: 'CS' }
    ];

    // 1. Insert new teachers
    const { error: insertError } = await supabase.from('users').insert(teachers);
    if (insertError) {
        console.error('Error inserting teachers:', insertError);
        return;
    }
    console.log('Inserted new teachers (tch001, tch002, tch003).');

    // 2. Allocate subjects to tch001
    const sub1 = ['SCSBOB1661', 'SCSB081661', 'S613BLH62'];
    const { error: err1 } = await supabase.from('schedules').update({ teacher_uid: 'tch001' }).in('subject_code', sub1);
    
    // 3. Allocate subjects to tch002
    const sub2 = ['SCSB1662', 'S614BLH61'];
    const { error: err2 } = await supabase.from('schedules').update({ teacher_uid: 'tch002' }).in('subject_code', sub2);

    // 4. Allocate subjects to tch003
    const sub3 = ['SCSBLH63', 'SCSB3855', 'S613BIPROJ'];
    const { error: err3 } = await supabase.from('schedules').update({ teacher_uid: 'tch003' }).in('subject_code', sub3);

    if (err1 || err2 || err3) {
        console.error('Error updating schedules:', err1 || err2 || err3);
    } else {
        console.log('Successfully allocated all subjects to the new teachers.');
    }
}

setupTeachers();
