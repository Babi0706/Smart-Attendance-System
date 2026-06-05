const fs = require('fs');

let code = fs.readFileSync('src/App.jsx', 'utf-8');

// Replace models and constants 1
const modelsConstantsRegex1 = /\/\/ ==========================================\r?\n\/\/ 2\. DATA MODELS & UTILS\r?\n\/\/ ==========================================\r?\n\r?\nconst getCurrentTimestamp = \(\) => Date\.now\(\);\r?\n\r?\n\/\/ Gate Time Restriction[\s\S]*?const INIT_IOT_NODES = \[\r?\n[\s\S]*?\];\r?\n/g;

code = code.replace(modelsConstantsRegex1, `import { Block, Blockchain } from './models/Blockchain';
import { getCurrentTimestamp, GATE_WINDOW, isGateTimeValid, INITIAL_USERS, INIT_IOT_NODES, STUDENT_SUBJECTS, parseTime, resolveSubjectAtTime } from './utils/constants';`);

// Replace STUDENT_SUBJECTS and parseTime + resolveSubjectAtTime
const studentSubjectsRegex = /const STUDENT_SUBJECTS = \[\r?\n[\s\S]*?\];\r?\n\r?\nconst parseTime = \([\s\S]*?};/g;
code = code.replace(studentSubjectsRegex, "");

const resolveSubjectRegex = /\/\*\*[\s\S]*?const resolveSubjectAtTime = \([\s\S]*?\) \|\| null;\r?\n};\r?\n/g;
code = code.replace(resolveSubjectRegex, "");

fs.writeFileSync('src/App.jsx', code);
console.log("App.jsx refactored successfully (Models and Utils).");
