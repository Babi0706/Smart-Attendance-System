
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oezelkllavaxwxxlugpt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lemVsa2xsYXZheHd4eGx1Z3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODc3OTQsImV4cCI6MjA4NjU2Mzc5NH0.GqgONKUQjQhdJ8v710wEqOjb3AehJ1cJiu1JTUg-Q-Y';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsertion() {
    console.log("Testing attendance_log insertion WITHOUT tx_hash...");
    const { data, error } = await supabase
        .from('attendance_logs')
        .insert([{
            uid: 'TEST_UID',
            name: 'Test Student',
            subject: 'Test Subject',
            method: 'TEST_METHOD',
            timestamp: new Date().toISOString()
        }]);

    if (error) {
        console.error("Insertion failed as expected:", error.message, error.code);
    } else {
        console.log("Insertion SUCCEEDED (unexpected). Data:", data);
    }
}

testInsertion();
