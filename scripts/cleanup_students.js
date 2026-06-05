import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Missing Supabase environment variables! Check .env file.');
    console.log('Values found:', { supabaseUrl: !!supabaseUrl, supabaseKey: !!supabaseKey });
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanup() {
    console.log('--- Database Cleanup Started ---');

    console.log('1. Deleting students...');
    const { data: students, error: userError } = await supabase
        .from('users')
        .delete()
        .eq('role', 'STUDENT')
        .select('uid');

    if (userError) {
        console.error('Error deleting students:', userError.message);
    } else {
        console.log(`Successfully deleted ${students?.length || 0} students.`);
    }

    console.log('2. Clearing attendance logs...');
    const { data: logs, error: logError } = await supabase
        .from('attendance_logs')
        .delete()
        .neq('id', 0)
        .select('id');

    if (logError) {
        console.error('Error clearing attendance logs:', logError.message);
    } else {
        console.log(`Successfully cleared ${logs?.length || 0} attendance logs.`);
    }

    console.log('3. Clearing RFID scans...');
    const { data: scans, error: scanError } = await supabase
        .from('rfid_scans')
        .delete()
        .neq('id', 0)
        .select('id');

    if (scanError) {
        console.error('Error clearing RFID scans:', scanError.message);
    } else {
        console.log(`Successfully cleared ${scans?.length || 0} RFID scans.`);
    }

    console.log('--- Cleanup Complete ---');
}

cleanup().catch(err => {
    console.error('Unexpected error during cleanup:', err);
    process.exit(1);
});
