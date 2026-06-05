import { createClient } from '@supabase/supabase-js';
import { INITIAL_USERS, INIT_IOT_NODES, STUDENT_SUBJECTS } from '../src/utils/constants.js';

import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf8');

const getEnvVar = (name) => {
    const regex = new RegExp(`^${name}=(.*)$`, 'm');
    const match = envContent.match(regex);
    return match ? match[1].trim() : null;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseKey = getEnvVar('VITE_SUPABASE_SERVICE_ROLE_KEY') || getEnvVar('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY must be set in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateData() {
    console.log("Migrating Users...");
    for (const user of INITIAL_USERS) {
        await supabase.from('users').upsert({
            uid: user.uid, name: user.name, role: user.role, password: user.password,
            email: user.email, dept: user.dept, subject: user.subject || null,
            year: user.year || null, section: user.section || null
        }, { onConflict: 'uid' });
    }

    console.log("Migrating IoT Nodes...");
    for (const node of INIT_IOT_NODES) {
        await supabase.from('iot_nodes').upsert({
            node_id: node.id, location: node.location, status: node.status, signal: node.signal
        }, { onConflict: 'node_id' });
    }

    console.log("Migrating Subjects...");
    const uniqueSubjectsMap = new Map();
    for (const s of STUDENT_SUBJECTS) {
        if (!uniqueSubjectsMap.has(s.code)) {
            uniqueSubjectsMap.set(s.code, { code: s.code, name: s.name || s.code, credits: s.credits || 3, color: s.color || '#ffffff' });
        }
    }

    for (const sub of uniqueSubjectsMap.values()) {
        const { error } = await supabase.from('subjects').upsert(sub, { onConflict: 'code' });
        if (error) console.error(`Failed to insert subject ${sub.code}:`, error.message);
    }

    console.log("Migrating Timetable Schedules...");
    await supabase.from('schedules').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    const teacherMap = {
        'K.Nandha Kishore Reddy': 'TCH001',
        'D.Chathurveda Reddy': 'TCH002',
        'G.Trivendra Reddy': 'TCH003',
        'G.Trivindra Reddy': 'TCH003'
    };

    const teachersToInsert = [
        { uid: 'TCH001', name: 'K.Nandha Kishore Reddy', role: 'TEACHER', password: '123', email: 'k.nandha@school.com', dept: 'CS' },
        { uid: 'TCH002', name: 'D.Chathurveda Reddy', role: 'TEACHER', password: '123', email: 'd.chathurveda@school.com', dept: 'CS' },
        { uid: 'TCH003', name: 'G.Trivendra Reddy', role: 'TEACHER', password: '123', email: 'g.trivendra@school.com', dept: 'CS' },
        { uid: 'TCH004', name: 'G.Trivindra Reddy', role: 'TEACHER', password: '123', email: 'g.trivindra.typo@school.com', dept: 'CS' }
    ];

    for (const t of teachersToInsert) {
        const { error } = await supabase.from('users').upsert(t, { onConflict: 'uid' });
        if (error) console.error(`Failed to insert teacher ${t.uid}:`, error.message, error.details);
    }

    for (const s of STUDENT_SUBJECTS) {
        let teacherUid = teacherMap[s.teacher] || null;

        // Double check if subject code exists in DB before inserting schedule
        const { data: subCheck } = await supabase.from('subjects').select('code').eq('code', s.code).single();
        if (!subCheck) {
            console.error(`ERROR: Subject ${s.code} does not exist in the DB! Skipping schedule...`);
            continue;
        }

        const { error } = await supabase.from('schedules').insert({
            subject_code: s.code,
            teacher_uid: teacherUid,
            day_of_week: s.day,
            start_time: s.time
        });

        if (error) {
            console.error(`Failed to insert schedule for ${s.code} on ${s.day} with teacher ${teacherUid}:`, error.message);
        } else {
            console.log(`Inserted schedule for ${s.code} on ${s.day}`);
        }
    }

    console.log("Migration Complete!");
}

migrateData();
