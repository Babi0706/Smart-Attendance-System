import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const columnsToTest = ['uid', 'name', 'email', 'role', 'dept', 'year', 'section', 'subject', 'created_at', 'last_login_at', 'face_data', 'face_descriptor', 'rfid_uid'];

async function testColumns() {
    for (const col of columnsToTest) {
        const { error } = await supabase.from('users').select(col).limit(1);
        if (error) {
            console.log(`❌ Column "${col}" FAILED: ${error.message}`);
        } else {
            console.log(`✅ Column "${col}" OK`);
        }
    }
}

testColumns();
