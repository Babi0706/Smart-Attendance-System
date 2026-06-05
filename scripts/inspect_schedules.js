import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectSchedules() {
    const { data: schedules, error } = await supabase
        .from('schedules')
        .select(`
            id,
            day_of_week,
            start_time,
            subject_code,
            teacher_uid
        `)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

    if (error) {
        console.error("Fetch error:", error);
        return;
    }

    fs.writeFileSync('schedules_dump.json', JSON.stringify(schedules, null, 2));
    console.log("Dumped to schedules_dump.json");
}

inspectSchedules();
