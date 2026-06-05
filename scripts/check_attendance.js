
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oezelkllavaxwxxlugpt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lemVsa2xsYXZheHd4eGx1Z3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODc3OTQsImV4cCI6MjA4NjU2Mzc5NH0.GqgONKUQjQhdJ8v710wEqOjb3AehJ1cJiu1JTUg-Q-Y';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
    console.log(`[${new Date().toISOString()}] Starting Database Check...`);

    try {
        // Check attendance_logs
        const { count: attendanceCount, error: attendanceError } = await supabase
            .from('attendance_logs')
            .select('*', { count: 'exact', head: true });
        if (attendanceError) throw attendanceError;
        console.log(`[${new Date().toISOString()}] attendance_logs count: ${attendanceCount}`);

        // Check rfid_scans
        const { count: rfidCount, error: rfidError } = await supabase
            .from('rfid_scans')
            .select('*', { count: 'exact', head: true });
        if (rfidError) throw rfidError;
        console.log(`[${new Date().toISOString()}] rfid_scans count: ${rfidCount}`);

        // Check users
        const { data: students, error: userError } = await supabase
            .from('users')
            .select('uid, name, role')
            .eq('role', 'STUDENT');
        if (userError) throw userError;
        console.log(`[${new Date().toISOString()}] Active Students: ${students.length}`);
        students.forEach(s => console.log(`  - ${s.uid}: ${s.name}`));

        // List some recent logs regardless of subject
        const { data: logs, error: logsError } = await supabase
            .from('attendance_logs')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(10);
        if (logsError) throw logsError;
        console.log(`[${new Date().toISOString()}] Recent Logs: ${logs.length}`);
        logs.forEach(l => console.log(`  - [${l.timestamp}] ${l.name} (${l.uid}) at ${l.subject}`));

    } catch (err) {
        console.error(`[${new Date().toISOString()}] CRITICAL ERROR:`, err.message);
    }
}

checkDatabase();
