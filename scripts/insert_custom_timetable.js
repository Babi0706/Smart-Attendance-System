import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oezelkllavaxwxxlugpt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lemVsa2xsYXZheHd4eGx1Z3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODc3OTQsImV4cCI6MjA4NjU2Mzc5NH0.GqgONKUQjQhdJ8v710wEqOjb3AehJ1cJiu1JTUg-Q-Y';
const supabase = createClient(supabaseUrl, supabaseKey);

const subjects = [
    { code: 'S613BLH62', name: 'Data Structures', color: '#00e5ff', credits: 4, teacher: 'K.Nanda Kishore Reddy' },
    { code: 'SCSB1662', name: 'Database Systems', color: '#00e676', credits: 4, teacher: 'G.Trivendra Reddy' },
    { code: 'S614BLH61', name: 'Computer Networks', color: '#ffd600', credits: 4, teacher: 'K.Nanda Kishore Reddy' },
    { code: 'SCSB081661', name: 'Operating Systems', color: '#ff1744', credits: 4, teacher: 'G.Trivendra Reddy' },
    { code: 'SCSBLH63', name: 'Smart Contracts', color: '#b388ff', credits: 3, teacher: 'K.Nanda Kishore Reddy' },
    { code: 'SCSB3855', name: 'Discrete Mathematics', color: '#00bca5', credits: 3, teacher: 'T.Charan Teja' },
    { code: 'S613BIPROJ', name: 'Major Project', color: '#ff4081', credits: 6, teacher: 'T.Charan Teja' },
    { code: 'SCSBOB1661', name: 'Object Oriented Programming', color: '#ff9100', credits: 3, teacher: 'G.Trivendra Reddy' }
];

const scheduleSlots = [
    // MON
    { day: 'Mon', time: '09:00:00', code: 'S613BLH62', teacher_uid: 'TCH_NANDA' },
    { day: 'Mon', time: '10:00:00', code: 'SCSB1662', teacher_uid: 'TCH_TRIVEN' },
    { day: 'Mon', time: '11:15:00', code: 'S614BLH61', teacher_uid: 'TCH_NANDA' },
    { day: 'Mon', time: '13:15:00', code: 'S614BLH61', teacher_uid: 'TCH_NANDA' },
    { day: 'Mon', time: '14:15:00', code: 'SCSB081661', teacher_uid: 'TCH_TRIVEN' },

    // TUE
    { day: 'Tue', time: '09:00:00', code: 'SCSBLH63', teacher_uid: 'TCH_NANDA' },
    { day: 'Tue', time: '10:00:00', code: 'S613BLH62', teacher_uid: 'TCH_NANDA' },
    { day: 'Tue', time: '11:15:00', code: 'SCSB3855', teacher_uid: 'TCH_CHARAN' },
    { day: 'Tue', time: '13:15:00', code: 'S614BLH61', teacher_uid: 'TCH_NANDA' },
    { day: 'Tue', time: '14:15:00', code: 'SCSB081661', teacher_uid: 'TCH_TRIVEN' },

    // WED
    { day: 'Wed', time: '09:00:00', code: 'SCSBLH63', teacher_uid: 'TCH_NANDA' },
    { day: 'Wed', time: '10:00:00', code: 'SCSB081661', teacher_uid: 'TCH_TRIVEN' },
    { day: 'Wed', time: '11:15:00', code: 'SCSB1662', teacher_uid: 'TCH_TRIVEN' },
    { day: 'Wed', time: '13:15:00', code: 'S613BLH62', teacher_uid: 'TCH_NANDA' },
    { day: 'Wed', time: '14:15:00', code: 'SCSBOB1661', teacher_uid: 'TCH_TRIVEN' },

    // THU
    { day: 'Thu', time: '09:00:00', code: 'SCSBLH63', teacher_uid: 'TCH_NANDA' },
    { day: 'Thu', time: '10:00:00', code: 'S614BLH61', teacher_uid: 'TCH_NANDA' },
    { day: 'Thu', time: '11:15:00', code: 'SCSB3855', teacher_uid: 'TCH_CHARAN' },
    { day: 'Thu', time: '13:15:00', code: 'S613BIPROJ', teacher_uid: 'TCH_CHARAN' },
    { day: 'Thu', time: '14:15:00', code: 'S613BIPROJ', teacher_uid: 'TCH_CHARAN' },

    // FRI
    { day: 'Fri', time: '09:00:00', code: 'S614BLH61', teacher_uid: 'TCH_NANDA' },
    { day: 'Fri', time: '10:00:00', code: 'SCSB3855', teacher_uid: 'TCH_CHARAN' },
    { day: 'Fri', time: '11:15:00', code: 'S613BLH62', teacher_uid: 'TCH_NANDA' },
    { day: 'Fri', time: '13:15:00', code: 'SCSB081661', teacher_uid: 'TCH_TRIVEN' },
    { day: 'Fri', time: '14:15:00', code: 'SCSB1662', teacher_uid: 'TCH_TRIVEN' }
];

async function insertData() {
    try {
        console.log('Clearing existing subjects and schedules...');

        // Fetch all schedule IDs to delete explicitly
        const { data: schData } = await supabase.from('schedules').select('id');
        if (schData && schData.length > 0) {
            const ids = schData.map(s => s.id);
            await supabase.from('schedules').delete().in('id', ids);
        }

        // Fetch all subject codes to delete explicitly
        const { data: subData } = await supabase.from('subjects').select('code');
        if (subData && subData.length > 0) {
            const codes = subData.map(s => s.code);
            await supabase.from('subjects').delete().in('code', codes);
        }

        console.log('Inserting Subjects...');
        const { error: subjError } = await supabase.from('subjects').upsert(subjects, { onConflict: 'code' });
        if (subjError) throw subjError;

        console.log('Inserting Schedules...');
        const dayFullMap = {
            'Mon': 'Monday',
            'Tue': 'Tuesday',
            'Wed': 'Wednesday',
            'Thu': 'Thursday',
            'Fri': 'Friday',
            'Sat': 'Saturday'
        };
        const newSchedules = scheduleSlots.map(slot => ({
            day_of_week: dayFullMap[slot.day],
            start_time: slot.time,
            subject_code: slot.code,
            teacher_uid: slot.teacher_uid
        }));

        const { error: schError } = await supabase.from('schedules').insert(newSchedules);
        if (schError) throw schError;

        console.log('Successfully updated timetable and teacher assignments!');
    } catch (error) {
        console.error('Error:', error);
    }
}

insertData();
