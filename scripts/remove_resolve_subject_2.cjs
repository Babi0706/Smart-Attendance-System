const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf-8');

const targetStr = `/**
 * Resolves the subject for a given timestamp based on the Master Timetable.
 * @param {string|number} timestamp 
 * @returns {object|null} The matched subject or null
 */
const resolveSubjectAtTime = (timestamp) => {
    const date = new Date(Number(timestamp));
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const recordDay = dayNames[date.getDay()];
    const recordMinutes = date.getHours() * 60 + date.getMinutes();

    return STUDENT_SUBJECTS.find(s => {
        if (s.day !== recordDay) return false;
        const slotMinutes = parseTime(s.time);
        // Match if within 1 hour window of the slot start time
        return recordMinutes >= slotMinutes && recordMinutes < (slotMinutes + 60);
    });
};`;

// Replace targetStr handling possible \r\n differences
const targetRegex = /\/\*\*\r?\n \* Resolves the subject for a given timestamp based on the Master Timetable\.\r?\n \* @param \{string\|number\} timestamp \r?\n \* @returns \{object\|null\} The matched subject or null\r?\n \*\/\r?\nconst resolveSubjectAtTime = \(timestamp\) => \{\r?\n    const date = new Date\(Number\(timestamp\)\);\r?\n    const dayNames = \['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'\];\r?\n    const recordDay = dayNames\[date\.getDay\(\)\];\r?\n    const recordMinutes = date\.getHours\(\) \* 60 \+ date\.getMinutes\(\);\r?\n\r?\n    return STUDENT_SUBJECTS\.find\(s => \{\r?\n        if \(s\.day !== recordDay\) return false;\r?\n        const slotMinutes = parseTime\(s\.time\);\r?\n        \/\/ Match if within 1 hour window of the slot start time\r?\n        return recordMinutes >= slotMinutes && recordMinutes < \(slotMinutes \+ 60\);\r?\n    \}\);\r?\n\};\r?\n/g;

if (targetRegex.test(code)) {
    code = code.replace(targetRegex, '');
    fs.writeFileSync('src/App.jsx', code);
    console.log("Successfully removed resolveSubjectAtTime.");
} else {
    console.log("Could not find the target codeblock.");
}
