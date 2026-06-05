import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://oezelkllavaxwxxlugpt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lemVsa2xsYXZheHd4eGx1Z3B0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODc3OTQsImV4cCI6MjA4NjU2Mzc5NH0.GqgONKUQjQhdJ8v710wEqOjb3AehJ1cJiu1JTUg-Q-Y';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    let output = '';
    const { data: subjects } = await supabase.from('subjects').select('*');
    output += '--- SUBJECTS ---\n';
    subjects.forEach(s => {
        output += `CODE: ${s.code} | NAME: ${s.name}\n`;
    });

    const { data: users } = await supabase.from('users').select('*');
    output += '\n--- TEACHERS ---\n';
    users.filter(u => u.role === 'TEACHER').forEach(u => {
        output += `UID: ${u.uid} | NAME: ${u.name} | SUBJECT: ${u.subject}\n`;
    });

    output += '\n--- ALL USERS ---\n';
    users.forEach(u => {
        output += `UID: ${u.uid} | NAME: ${u.name} | ROLE: ${u.role}\n`;
    });

    fs.writeFileSync('db_summary.txt', output, 'utf8');
    console.log('Summary written to db_summary.txt');
}

check();
