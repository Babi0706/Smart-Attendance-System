const fs = require('fs');

let code = fs.readFileSync('src/App.jsx', 'utf-8');

const biometricIndex = code.indexOf('function BiometricVerification');
const kioskIndex = code.indexOf('// ==========================================\r\n// CLASSROOM KIOSK');
if (kioskIndex === -1) { console.log('kiosk not found'); process.exit(1); }
const getCalendarIndex = code.indexOf('const getCalendarEvents');
const studentIndex = code.indexOf('function StudentDashboard');
const teacherIndex = code.indexOf('// --- Teacher View ---');
const adminIndex = code.indexOf('function AdminDashboard');

const biometricCode = code.slice(biometricIndex, kioskIndex);
const kioskCode = code.slice(kioskIndex, getCalendarIndex);
const getCalendarCode = code.slice(getCalendarIndex, studentIndex);
const studentCode = code.slice(studentIndex, teacherIndex);
const teacherCode = code.slice(teacherIndex, adminIndex);
const adminCode = code.slice(adminIndex);

const commonImports = `import React, { useState, useEffect, useRef } from 'react';
import GlobalStyles from '../ui/GlobalStyles';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { supabase } from '../../config/supabase';
import faceService from '../../services/faceService';
import rfidService from '../../services/rfidService';
import attendanceService from '../../services/attendanceService';
import attendanceBlockchain from '../../services/attendanceBlockchain';
import { STUDENT_SUBJECTS, parseTime, resolveSubjectAtTime, getCurrentTimestamp } from '../../utils/constants';\n`;

const calendarImports = `import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
const localizer = momentLocalizer(moment);\n`;

fs.writeFileSync('src/utils/calendarUtils.js', "import { STUDENT_SUBJECTS } from './constants';\nexport " + getCalendarCode);
fs.writeFileSync('src/components/dashboards/BiometricVerification.jsx', commonImports + "export default " + biometricCode);
fs.writeFileSync('src/components/dashboards/ClassroomKiosk.jsx', commonImports + "export default " + kioskCode);
fs.writeFileSync('src/components/dashboards/StudentDashboard.jsx', commonImports + calendarImports + "import { getCalendarEvents } from '../../utils/calendarUtils';\nimport BiometricVerification from './BiometricVerification';\nexport default " + studentCode);
fs.writeFileSync('src/components/dashboards/TeacherDashboard.jsx', commonImports + "import ClassroomKiosk from './ClassroomKiosk';\nexport default " + teacherCode);
fs.writeFileSync('src/components/dashboards/AdminDashboard.jsx', commonImports + "export default " + adminCode);

// Trim App.jsx and add imports at the top
const studentViewIndex = code.indexOf('// --- Student View ---');
let trimmedAppCode = code.slice(0, studentViewIndex);

// Add imports after the localizer line or AuthScreen import
const authImportIndex = trimmedAppCode.indexOf("import AuthScreen from './components/auth/AuthScreen';") + "import AuthScreen from './components/auth/AuthScreen';\n".length;

const newImports = `
import BiometricVerification from './components/dashboards/BiometricVerification';
import ClassroomKiosk from './components/dashboards/ClassroomKiosk';
import StudentDashboard from './components/dashboards/StudentDashboard';
import TeacherDashboard from './components/dashboards/TeacherDashboard';
import AdminDashboard from './components/dashboards/AdminDashboard';
`;

const finalAppCode = trimmedAppCode.slice(0, authImportIndex) + newImports + trimmedAppCode.slice(authImportIndex);

fs.writeFileSync('src/App.jsx', finalAppCode);
console.log("Dashboards extracted successfully!");
