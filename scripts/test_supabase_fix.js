
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oezelkllavaxwxxlugpt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lemVsa2xsYXZheHd4eGx1Z3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODc3OTQsImV4cCI6MjA4NjU2Mzc5NH0.GqgONKUQjQhdJ8v710wEqOjb3AehJ1cJiu1JTUg-Q-Y';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testFix() {
    console.log("Testing attendance_log insertion WITH 'PENDING_BLOCKCHAIN' placeholder...");
    const { data, error } = await supabase
        .from('attendance_logs')
        .insert([{
            tx_hash: 'PENDING_BLOCKCHAIN_' + Date.now(),
            uid: 'FIX_TEST',
            name: 'Fix Test Student',
            subject: 'Student Plaza',
            method: 'FACE_RFID',
            timestamp: new Date().toISOString()
        }])
        .select();

    if (error) {
        console.error("Insertion FAILED:", error.message, error.code);
    } else {
        console.log("Insertion SUCCEEDED! Record:", data[0]);

        // Clean up test record
        await supabase.from('attendance_logs').delete().eq('uid', 'FIX_TEST');
        console.log("Cleanup complete.");
    }
}

testFix();
