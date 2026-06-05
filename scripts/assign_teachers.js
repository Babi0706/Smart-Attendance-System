import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Target Mapping
// K.Nanda Kishore Reddy (TCH001): SCSBOB1661, S613BLH62
// T.Charan Teja (TCH002): SCSB1662, SCSB081661
// G.Trivendra Reddy (TCH003): SCSB3855, S614BLH61

const mappings = [
    { codes: ['SCSBOB1661', 'S613BLH62'], uid: 'TCH001' },
    { codes: ['SCSB1662', 'SCSB081661'], uid: 'TCH002' },
    { codes: ['SCSB3855', 'S614BLH61'], uid: 'TCH003' }
];

async function updateSchedules() {
    console.log("Starting schedule assignments...");
    let totalUpdated = 0;

    for (const mapping of mappings) {
        for (const subjectCode of mapping.codes) {
             const { data, error } = await supabase
                .from('schedules')
                .update({ teacher_uid: mapping.uid })
                .eq('subject_code', subjectCode)
                .select('id');

             if (error) {
                 console.error(`Error updating ${subjectCode}:`, error);
             } else {
                 console.log(`Updated ${subjectCode} to ${mapping.uid} (${data.length} records)`);
                 totalUpdated += data.length;
             }
        }
    }
    console.log(`Finished updates! Total records modified: ${totalUpdated}`);
}

updateSchedules();
