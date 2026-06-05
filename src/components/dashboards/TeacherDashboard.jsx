import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GlobalStyles from '../ui/GlobalStyles';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { supabase } from '../../config/supabase';
import faceService from '../../services/faceService';
import rfidService from '../../services/rfidService';
import attendanceService from '../../services/attendanceService';
import attendanceBlockchain from '../../services/attendanceBlockchain';
import { parseTime, resolveSubjectAtTime, getCurrentTimestamp } from '../../utils/constants';
import ClassroomKiosk from './ClassroomKiosk';
import notificationService from '../../services/notificationService';
import userService from '../../services/userService';
import BiometricVerification from './BiometricVerification';

export default function TeacherDashboard({ user, blockchain, logs, onRefresh, onMarkAttendance, onMarkAttendanceBatch, studentSubjects, walletAddress, recentlyScannedUids, lastScannedLogId, iotNodes = [] }) {
    const [activeTab, setActiveTab] = useState('LOGS');
    const [filter, setFilter] = useState('ALL');
    const [classStudents, setClassStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [kioskActive, setKioskActive] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [verifyingSelf, setVerifyingSelf] = useState(false);

    // Derive all subjects this teacher teaches from master schedule
    const mySubjects = studentSubjects.filter(s => s.teacher === user.name || (user.subject && (s.name || '').toLowerCase().includes((user.subject || '').toLowerCase())));
    // Deduplicate by subject code
    const uniqueSubjects = mySubjects.reduce((acc, s) => {
        if (!acc.find(x => x.code === s.code)) acc.push(s);
        return acc;
    }, []);
    const [selectedSubject, setSelectedSubject] = useState(null);
    // Auto-select first subject if not set
    const activeSubject = selectedSubject || (uniqueSubjects.length > 0 ? uniqueSubjects[0] : null);

    useEffect(() => {
        const fetchClassData = async () => {
            setLoading(true);
            const { success, users } = await userService.getAllUsers('STUDENT');
            if (success) {
                // Filter students by teacher's department or subject
                let filtered = users.filter(s => {
                    const studentDept = (s.dept || '').toUpperCase().trim();
                    const teacherDept = (user.dept || '').toUpperCase().trim();
                    const studentSubj = (s.subject || '').toUpperCase().trim();
                    const teacherSubj = (user.subject || '').toUpperCase().trim();

                    // Flexible matching
                    const deptMatch = studentDept === teacherDept || !studentDept || !teacherDept;
                    const subjMatch = !teacherSubj || studentSubj === teacherSubj || studentSubj === '--';

                    return deptMatch && subjMatch;
                });

                // FALLBACK: If no students found in department, show all students to prevent lockout
                if (filtered.length === 0 && users.length > 0) {
                    console.warn(`[TeacherDashboard] No students found matching Dept: ${user.dept}, Subject: ${user.subject}. Falling back to all students.`);
                    filtered = users;
                }

                setClassStudents(filtered);
            }
            setLoading(false);
        };
        fetchClassData();
    }, [user]);



    const now = new Date();
    const currentDayFull = now.toLocaleDateString('en-US', { weekday: 'long' });
    const currentDayShort = currentDayFull.substring(0, 3); // "Mon", "Tue"...
    const currentTimeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    const currentMins = parseTime(currentTimeStr);

    // Verify if the current user is the scheduled teacher for the active subject AT THIS MOMENT
    const scheduledSubject = activeSubject ? studentSubjects.find(s =>
        s.code === activeSubject.code &&
        s.day.includes(currentDayShort)
    ) : null;

    // [TEST_MODE] Bypassing time-locks for verification
    const isTimeSlotMatch = true;
    const scheduleStatus = "TEST MODE: UNLOCKED";
    const scheduledTeacher = null;

    // Check if the current teacher has marked their own attendance today
    const hasTeacherMarkedAttendance = blockchain.chain.some(b => {
        if (b.index === 0) return false;
        const ts = Number(b.timestamp);
        const date = ts < 1e12 ? new Date(ts * 1000) : new Date(ts);
        const blockDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const todayStr = new Date().toISOString().split('T')[0];
        return blockDate === todayStr && b.data && b.data.uid === user.uid;
    });

    // Handle Background RFID Scans for Self-Attendance
    useEffect(() => {
        const unsubscribe = rfidService.subscribeToScans((scan) => {
            const storedUid = (user.rfid_uid || user.rfid_tag || '').toUpperCase().trim();
            const scanUid = (scan.uid || '').toUpperCase().trim();

            if (scanUid === storedUid) {
                console.log('[TeacherDashboard] RFID Trigger detected for self-attendance');
                setVerifyingSelf(true);
            }
        });
        return () => unsubscribe();
    }, [user]);

    // Filter blockchain records to only show students in this teacher's subject/class
    // 1. CLASS RECORDS: Records specifically for this teacher's subject
    const classRecords = blockchain.chain.filter(b => {
        if (b.index === 0) return false;
        // Fix: Use local date and timestamp multiplier for subject attendance
        const ts = Number(b.timestamp);
        const date = ts < 1e12 ? new Date(ts * 1000) : new Date(ts);
        const blockDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        if (blockDate !== selectedDate) return false;

        const teacherName = user.name;
        const teacherSubj = activeSubject ? activeSubject.name.toUpperCase() : (user.subject || '').toUpperCase();
        const teacherCode = activeSubject ? activeSubject.code : '';

        // Match by subject code first (most specific)
        if (teacherCode && b.data.subjectCode === teacherCode) return true;

        // Match if assigned to this teacher AND matches selected subject
        if (b.data.teacher && b.data.teacher === teacherName && (b.data.subject || '').toUpperCase() === teacherSubj) return true;

        // Or if it's the teacher's subject but no teacher assigned (fallback)
        if (!b.data.teacher && (b.data.subject || '').toUpperCase() === teacherSubj) return true;

        return false;
    }).map(b => {
        // ENRICH WITH LATE STATUS
        const subject = studentSubjects.find(s => s.code === b.data.subjectCode || s.name === b.data.subject);
        if (subject) {
            const scheduledMins = parseTime(subject.time);
            const scanTime = new Date(Number(b.timestamp));
            const scanMins = scanTime.getHours() * 60 + scanTime.getMinutes();
            const isLate = scanMins > (scheduledMins + 15);
            return { ...b, statusLabel: isLate ? 'LATE' : 'PRESENT' };
        }
        return { ...b, statusLabel: 'PRESENT' };
    }).sort((a, b) => b.timestamp - a.timestamp);

    // 2. EVENT RECORDS / CAMPUS SCANS
    const CAMPUS_LOCATIONS = ['STUDENT PLAZA'];
    const EVENT_LOCATIONS = ['AUDITORIUM', 'SEMINAR HALL', 'SPORTS COMPLEX', 'LIBRARY', 'INNOVATION HUB'];

    // Track campus presence records
    const campusRecords = blockchain.chain.filter(b => {
        if (b.index === 0) return false;
        // Fix: Use local date with timestamp multiplier support
        const ts = Number(b.timestamp);
        const date = ts < 1e12 ? new Date(ts * 1000) : new Date(ts);
        const blockDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        if (blockDate !== selectedDate) return false;
        if (!classStudents.some(s => s.uid === b.data.uid)) return false;

        const loc = (b.data.subject || '').toUpperCase();
        return CAMPUS_LOCATIONS.includes(loc);
    }).map(b => ({ ...b, statusLabel: 'CAMPUS' }));

    const eventRecords = blockchain.chain.filter(b => {
        if (b.index === 0) return false;
        const ts = Number(b.timestamp);
        const date = ts < 1e12 ? new Date(ts * 1000) : new Date(ts);
        const blockDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        if (blockDate !== selectedDate) return false;
        if (!classStudents.some(s => s.uid === b.data.uid)) return false;
        const loc = (b.data.subject || '').toUpperCase();
        return EVENT_LOCATIONS.includes(loc);
    }).map(b => ({ ...b, statusLabel: 'EVENT' }));

    // AUTO-PRESENT: Students with BOTH campus + event scans get subject attendance
    const campusUids = new Set(campusRecords.map(r => r.data.uid));
    const eventUids = new Set(eventRecords.map(r => r.data.uid));
    const autoPresentUids = new Set([...campusUids].filter(uid => eventUids.has(uid)));

    // Build auto-present records from event records for students who have both scans
    const autoPresentRecords = eventRecords
        .filter(r => autoPresentUids.has(r.data.uid))
        .map(r => ({ ...r, statusLabel: 'PRESENT' }))
        // Deduplicate by uid - keep only the latest event scan per student
        .reduce((acc, r) => {
            if (!acc.find(x => x.data.uid === r.data.uid)) acc.push(r);
            return acc;
        }, []);

    // Helper UIDs for separation logic
    const subjectPresentUids = new Set(classRecords.filter(r => r.statusLabel === 'PRESENT').map(r => r.data.uid));
    const subjectLateUids = new Set(classRecords.filter(r => r.statusLabel === 'LATE').map(r => r.data.uid));
    const finalPresentUids = new Set([...subjectPresentUids, ...autoPresentUids]);

    // Filter logic for the table
    // TODAY = campus scans ONLY (no event scan, no subject scan)
    // PRESENT = class records + auto-present (campus+event)
    // EVENT = Students with BOTH campus and event scans
    const filteredDisplay = filter === 'ALL' ? classStudents :
        filter === 'TODAY' ? campusRecords.filter(r => !eventUids.has(r.data.uid) && !subjectPresentUids.has(r.data.uid) && !subjectLateUids.has(r.data.uid)).sort((a, b) => b.timestamp - a.timestamp) :
            filter === 'PRESENT' ? [...classRecords.filter(r => r.statusLabel === 'PRESENT'), ...autoPresentRecords].sort((a, b) => b.timestamp - a.timestamp) :
                filter === 'LATE' ? classRecords.filter(r => r.statusLabel === 'LATE') :
                    eventRecords.filter(r => campusUids.has(r.data.uid)).sort((a, b) => b.timestamp - a.timestamp);

    return (
        <div className="dashboard-layout-alt">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <Card>
                    <div style={{ textAlign: 'center' }}>
                        {user.face_data ? (
                            <div style={{ position: 'relative', display: 'inline-block', marginBottom: '10px' }}>
                                <img src={user.face_data} alt="Profile" style={{ width: '80px', height: '80px', borderRadius: '50%', border: '2px solid var(--gold)', objectFit: 'cover', display: 'block' }} />
                                <div style={{ position: 'absolute', bottom: '2px', right: '2px', width: '14px', height: '14px', background: 'var(--green)', borderRadius: '50%', border: '2px solid var(--bg)' }} />
                            </div>
                        ) : (
                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', border: '2px solid var(--gold)', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', background: '#000' }}>👨‍🏫</div>
                        )}
                        <h3 className="font-heading">{user.name}</h3>
                        <p className="font-code" style={{ color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 'bold' }}>{activeSubject ? activeSubject.name : (user.subject || '--')}</p>
                        <p className="font-code" style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>{user.dept || 'Computer Science'} Department</p>
                        {uniqueSubjects.length > 1 && (
                            <div style={{ marginTop: '10px' }}>
                                <div className="font-code" style={{ fontSize: '0.6rem', color: 'var(--text-dim)', marginBottom: '6px', letterSpacing: '1px' }}>SELECT SUBJECT</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {uniqueSubjects.map(s => (
                                        <button
                                            key={s.code}
                                            onClick={() => setSelectedSubject(s)}
                                            className="btn-cyber"
                                            style={{
                                                padding: '6px 10px',
                                                fontSize: '0.7rem',
                                                textAlign: 'left',
                                                opacity: activeSubject && activeSubject.code === s.code ? 1 : 0.45,
                                                borderColor: activeSubject && activeSubject.code === s.code ? 'var(--primary)' : 'var(--border)',
                                                background: activeSubject && activeSubject.code === s.code ? 'rgba(0,229,255,0.08)' : 'transparent'
                                            }}
                                        >
                                            <span style={{ color: s.color, fontWeight: 'bold' }}>{s.code}</span>
                                            <span style={{ marginLeft: '6px', color: 'var(--text-dim)' }}>{s.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
                <Card>
                    <h4 className="font-heading" style={{ color: 'var(--accent)' }}>CLASS STATS</h4>
                    <div className="responsive-grid-2" style={{ gap: '10px', marginTop: '15px' }}>
                        <div style={{ background: 'var(--surface)', padding: '10px', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.5rem', color: 'var(--white)' }}>
                                {loading ? '...' : classStudents.length}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>CLASS STUDENTS</div>
                        </div>
                        <div style={{ background: 'var(--surface)', padding: '10px', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.5rem', color: 'var(--green)' }}>
                                {loading ? '...' :
                                    (classStudents.length > 0 ?
                                        Math.round((new Set(classRecords.map(r => r.data.uid)).size / classStudents.length) * 100) : 0
                                    )}%
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>ATTENDANCE RATE</div>
                        </div>
                    </div>
                </Card>
                <Card style={{ border: isTimeSlotMatch ? '1px solid var(--green)' : '1px solid var(--red)', background: isTimeSlotMatch ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255, 23, 68, 0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h4 className="font-heading" style={{ color: isTimeSlotMatch ? 'var(--green)' : 'var(--red)', fontSize: '0.8rem' }}>KIOSK STATUS</h4>
                        <Badge type={isTimeSlotMatch ? 'green' : 'red'}>{scheduleStatus}</Badge>
                    </div>

                    {!isTimeSlotMatch && (
                        <div style={{ marginBottom: '15px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', border: '1px dotted var(--red)' }}>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '4px' }}>ACCESS DENIED</p>
                            <p style={{ fontSize: '0.8rem', color: 'var(--red)', fontWeight: 'bold' }}>
                                {scheduledTeacher ? `Currently assigned to: ${scheduledTeacher}` : "No session scheduled for this time slot."}
                            </p>
                            <p className="font-code" style={{ fontSize: '0.65rem', marginTop: '6px', color: 'var(--primary)' }}>
                                SYSTEM TIME: {currentDayFull}, {currentTimeStr}
                            </p>
                        </div>
                    )}

                    {isTimeSlotMatch && !hasTeacherMarkedAttendance && (
                        <div style={{ marginBottom: '15px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', border: '1px dotted var(--gold)' }}>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '4px' }}>TEACHER VERIFICATION REQUIRED</p>
                            <p style={{ fontSize: '0.8rem', color: 'var(--gold)', fontWeight: 'bold' }}>
                                You must mark your own attendance for today before opening the Kiosk.
                            </p>
                        </div>
                    )}

                    <button
                        className="btn-cyber"
                        disabled={!isTimeSlotMatch || !hasTeacherMarkedAttendance}
                        onClick={() => {
                            if (!walletAddress) {
                                alert("🦊 WALLET NOT CONNECTED\n\nPlease connect your MetaMask wallet using the button in the top bar before starting the scanner.");
                                return;
                            }
                            setKioskActive(true);
                        }}
                        style={{
                            width: '100%',
                            borderColor: (isTimeSlotMatch && hasTeacherMarkedAttendance) ? 'var(--primary)' : 'var(--border)',
                            color: (isTimeSlotMatch && hasTeacherMarkedAttendance) ? 'var(--primary)' : 'var(--text-dim)',
                            cursor: (isTimeSlotMatch && hasTeacherMarkedAttendance) ? 'pointer' : 'not-allowed',
                            filter: (isTimeSlotMatch && hasTeacherMarkedAttendance) ? 'none' : 'grayscale(1)',
                            opacity: (isTimeSlotMatch && hasTeacherMarkedAttendance) ? 1 : 0.6
                        }}
                    >
                        {(isTimeSlotMatch && hasTeacherMarkedAttendance) ? '🚀 START CLASS SCANNER' : '🔒 SCANNER LOCKED'}
                    </button>

                    {isTimeSlotMatch && hasTeacherMarkedAttendance && (
                        <p className="font-code" style={{ fontSize: '0.6rem', color: 'var(--green)', marginTop: '8px', textAlign: 'center', animate: 'pulse 2s infinite' }}>
                            ● SESSION AUTHORIZED
                        </p>
                    )}
                    {kioskActive && (
                        <ClassroomKiosk
                            onClose={() => setKioskActive(false)}
                            onRefresh={onRefresh}
                            classStudents={classStudents}
                            subjectData={activeSubject}
                            teacherName={user.name}
                            logs={logs}
                            blockchain={blockchain}
                            onMarkAttendance={onMarkAttendance}
                            onMarkAttendanceBatch={onMarkAttendanceBatch}
                            recentlyScannedUids={recentlyScannedUids}
                            iotNodes={iotNodes}
                        />
                    )}
                </Card>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', gap: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
                    {['LOGS', 'TIMETABLE', 'NOTIFICATIONS'].map(t => (
                        <div key={t} onClick={() => setActiveTab(t)} style={{
                            cursor: 'pointer', fontFamily: "'Inter', sans-serif", fontSize: '0.9rem',
                            color: activeTab === t ? 'var(--gold)' : 'var(--text-dim)',
                            borderBottom: activeTab === t ? '2px solid var(--gold)' : 'none',
                            paddingBottom: '8px', transition: 'all 0.3s ease'
                        }}>{t}</div>
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    {activeTab === 'LOGS' ? (
                        <motion.div
                            key="logs"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Card>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <div>
                                        <h3 className="font-heading">STUDENT ATTENDANCE LOGS</h3>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                                            <button onClick={() => {
                                                const d = new Date(selectedDate);
                                                d.setDate(d.getDate() - 1);
                                                setSelectedDate(d.toISOString().split('T')[0]);
                                            }} className="btn-cyber" style={{ padding: '2px 8px', fontSize: '0.7rem' }}>&lsaquo; PREV</button>

                                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.9rem', color: 'var(--accent)', minWidth: '100px', textAlign: 'center' }}>
                                                {selectedDate === new Date().toISOString().split('T')[0] ? 'TODAY' : selectedDate}
                                            </span>

                                            <button onClick={() => {
                                                const d = new Date(selectedDate);
                                                d.setDate(d.getDate() + 1);
                                                setSelectedDate(d.toISOString().split('T')[0]);
                                            }} className="btn-cyber" style={{ padding: '2px 8px', fontSize: '0.7rem' }}>NEXT &rsaquo;</button>

                                                <button onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                                                    style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.7rem', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                                                    Go to Today
                                                </button>
                                            
                                            <button 
                                                onClick={() => setVerifyingSelf(true)}
                                                className="btn-cyber" 
                                                style={{ marginLeft: '10px', padding: '2px 10px', fontSize: '0.7rem', borderColor: 'var(--teal)', color: 'var(--teal)' }}
                                                disabled={hasTeacherMarkedAttendance}
                                            >
                                                {hasTeacherMarkedAttendance ? '✓ ATTENDANCE MARKED' : '☝ MARK MY ATTENDANCE'}
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                        {["ALL", "TODAY'S ATTENDANCE", 'PRESENT', 'LATE', 'EVENT'].map(f => {
                                            const filterKey = f === "TODAY'S ATTENDANCE" ? 'TODAY' : f;
                                            return (
                                                <button key={f} onClick={() => setFilter(filterKey)} className="btn-cyber" style={{ padding: '5px 10px', fontSize: '0.75rem', opacity: filter === filterKey ? 1 : 0.5 }}>{f}</button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div style={{ height: '400px', overflowY: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-dim)' }}>
                                                <th style={{ padding: '10px', width: '60px' }}>{filter === 'ALL' ? 'S.NO' : 'TIME'}</th>
                                                <th style={{ padding: '10px' }}>STUDENT</th>
                                                <th style={{ padding: '10px' }}>ID</th>
                                                <th style={{ padding: '10px' }}>DEPT</th>
                                                <th style={{ padding: '10px' }}>SUBJECT</th>
                                                <th style={{ padding: '10px' }}>METHOD</th>
                                                <th style={{ padding: '10px' }}>STATUS</th>
                                                <th style={{ padding: '10px' }}>NOTIF</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filter !== 'ALL' ? (
                                                // Render Logs (TODAY, PRESENT, LATE, or EVENT)
                                                filteredDisplay.length === 0 ? (
                                                    <tr><td colSpan="8" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)' }}>No records found for this filter.</td></tr>
                                                ) : (
                                                    filteredDisplay.map((b, i) => (
                                                        <tr key={i}
                                                            className={lastScannedLogId && b.data.txHash === lastScannedLogId ? 'glow-row' : ''}
                                                            style={{ borderBottom: '1px solid #1a2f4d' }}>
                                                            <td style={{ padding: '10px', textAlign: 'center' }} className="font-code">{new Date(Number(b.timestamp)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                                            <td style={{ padding: '10px' }}>{b.data.name}</td>
                                                            <td style={{ padding: '10px' }} className="font-code">{b.data.uid}</td>
                                                            <td style={{ padding: '10px', fontSize: '0.8rem' }} className="font-code">{b.data.dept || '--'}</td>
                                                            <td style={{ padding: '10px' }}>
                                                                {(() => {
                                                                    const isCampusHub = ['STUDENT PLAZA', 'AUDITORIUM', 'SEMINAR HALL', 'SPORTS COMPLEX', 'LIBRARY', 'INNOVATION HUB'].includes((b.data.subject || '').toUpperCase());
                                                                    const resolved = isCampusHub ? null : resolveSubjectAtTime(b.timestamp, studentSubjects);
                                                                    
                                                                    const subjectCode = b.data.subjectCode || (isCampusHub ? (b.data.subject.toUpperCase() === 'STUDENT PLAZA' ? 'STU' : b.data.subject.substring(0, 3).toUpperCase()) : (resolved ? resolved.code : (b.data.subject && b.data.subject !== '--' ? b.data.subject.substring(0, 3).toUpperCase() : 'SUBJ')));
                                                                    const subjectName = b.data.subject && b.data.subject !== '--' ? b.data.subject : (resolved ? resolved.name : '--');

                                                                    return (
                                                                        <>
                                                                            <div className="font-code" style={{ fontSize: '0.7rem', color: 'var(--primary)' }}>{subjectCode}</div>
                                                                            <div style={{ fontSize: '0.75rem' }}>{subjectName}</div>
                                                                        </>
                                                                    );
                                                                })()}
                                                            </td>
                                                            <td style={{ padding: '10px' }}><Badge type={b.data.method === 'FACE' ? 'cyan' : b.data.method === 'FACE_RFID' ? 'green' : 'gold'}>{b.data.method}</Badge></td>
                                                            <td style={{ padding: '10px' }}><Badge type={b.statusLabel === 'LATE' ? 'gold' : b.statusLabel === 'CAMPUS' ? 'teal' : b.statusLabel === 'EVENT' ? 'purple' : 'green'}>{b.statusLabel}</Badge></td>
                                                            <td style={{ padding: '10px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                    <span style={{ fontSize: '1rem', color: 'var(--primary)' }}>📱</span>
                                                                    <span className="font-code" style={{ fontSize: '0.65rem', color: 'var(--green)' }}>SENT</span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )
                                            ) : (
                                                // Render Roster (ALL) - show only registered students statically
                                                classStudents.map((s, i) => (
                                                    <tr key={i} style={{ borderBottom: '1px solid #1a2f4d', opacity: 1 }}>
                                                        <td style={{ padding: '10px', textAlign: 'center' }} className="font-code">{i + 1}</td>
                                                        <td style={{ padding: '10px' }}>{s.name}</td>
                                                        <td style={{ padding: '10px' }} className="font-code">{s.uid}</td>
                                                        <td style={{ padding: '10px', fontSize: '0.8rem' }} className="font-code">{s.dept || '--'}</td>
                                                        <td style={{ padding: '10px' }}>
                                                            <div className="font-code" style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>--</div>
                                                            <div style={{ fontSize: '0.75rem' }}>--</div>
                                                        </td>
                                                        <td style={{ padding: '10px' }}>--</td>
                                                        <td style={{ padding: '10px' }}><Badge type="teal">REGISTERED</Badge></td>
                                                        <td style={{ padding: '10px' }}>--</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '12px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                    <div className="font-code" style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ color: 'var(--text-dim)' }}>CLASS STRENGTH:</span>
                                        <span style={{ color: 'var(--white)', fontWeight: 'bold' }}>{classStudents.length}</span>
                                    </div>
                                    <div style={{ width: '1px', background: 'var(--border)' }} />
                                    <div className="font-code" style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ color: 'var(--text-dim)' }}>PRESENT:</span>
                                        <span style={{ color: 'var(--green)', fontWeight: 'bold' }}>{new Set([...classRecords.filter(r => r.statusLabel === 'PRESENT').map(r => r.data.uid), ...autoPresentRecords.map(r => r.data.uid)]).size}</span>
                                    </div>
                                    <div style={{ width: '1px', background: 'var(--border)' }} />
                                    <div className="font-code" style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ color: 'var(--text-dim)' }}>EVENT:</span>
                                        <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{new Set(eventRecords.filter(r => campusUids.has(r.data.uid)).map(r => r.data.uid)).size}</span>
                                    </div>
                                    <div style={{ width: '1px', background: 'var(--border)' }} />
                                    <div className="font-code" style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ color: 'var(--text-dim)' }}>LATE:</span>
                                        <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{classRecords.filter(r => r.statusLabel === 'LATE').length}</span>
                                    </div>
                                    <div style={{ width: '1px', background: 'var(--border)' }} />
                                    <div className="font-code" style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ color: 'var(--text-dim)' }}>CAMPUS:</span>
                                        <span style={{ color: 'var(--teal)', fontWeight: 'bold' }}>{campusRecords.length}</span>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="timetable"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Card>
                                <h3 className="font-heading" style={{ color: 'var(--primary)', marginBottom: '20px', fontSize: '0.9rem' }}>📅 WEEKLY MASTER SCHEDULE</h3>
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="data-table" style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ background: 'rgba(0,0,0,0.3)', width: '100px' }}>TIME</th>
                                                {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
                                                    <th key={d} style={{ textAlign: 'center' }}>{d}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[
                                                { time: '9:00 AM', label: '09:00 - 10:00' },
                                                { time: '10:00 AM', label: '10:00 - 11:00' },
                                                { isBreak: true, label: '11:00 - 11:15', name: '☕ SHORT BREAK' },
                                                { time: '11:15 AM', label: '11:15 - 12:15' },
                                                { isBreak: true, label: '12:15 - 1:15', name: '🍱 LUNCH BREAK' },
                                                { time: '1:15 PM', label: '13:15 - 14:15' },
                                                { time: '2:15 PM', label: '14:15 - 15:15' },
                                            ].map((slot, idx) => (
                                                <tr key={idx} style={{ background: slot.isBreak ? 'rgba(0,229,255,0.03)' : 'transparent' }}>
                                                    <td className="font-code" style={{ fontSize: '0.75rem', color: 'var(--primary)', background: 'rgba(0,0,0,0.2)', textAlign: 'center', fontWeight: 'bold', borderRight: '1px solid var(--border)' }}>
                                                        {slot.label}
                                                    </td>
                                                    {slot.isBreak ? (
                                                        <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.7rem', letterSpacing: '4px', fontStyle: 'italic', padding: '8px' }}>
                                                            {slot.name}
                                                        </td>
                                                    ) : (
                                                        ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => {
                                                            const subject = studentSubjects.find(s => s.time === slot.time && s.day.includes(day));
                                                            const isMyClass = subject && activeSubject && subject.code === activeSubject.code && (subject.teacher === user.name || (user.subject && subject.name.toLowerCase().includes(user.subject.toLowerCase())));
                                                            const slotKey = `${slot.time}-${day}`;
                                                            const isSelected = selectedSlot === slotKey;

                                                            return (
                                                                <td key={day} style={{
                                                                    padding: '4px',
                                                                    textAlign: 'center',
                                                                    fontSize: '0.75rem',
                                                                    borderRight: '1px solid rgba(51, 65, 85, 0.2)',
                                                                    height: '65px',
                                                                    verticalAlign: 'middle',
                                                                    position: 'relative'
                                                                }}>
                                                                    {subject ? (
                                                                        <div
                                                                            onClick={() => setSelectedSlot(isSelected ? null : slotKey)}
                                                                            style={{
                                                                                background: isMyClass ? 'rgba(0, 229, 255, 0.08)' : `${subject.color}08`,
                                                                                border: `1px solid ${isMyClass ? 'rgba(0, 229, 255, 0.3)' : isSelected ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.04)'}`,
                                                                                borderRadius: '6px',
                                                                                padding: '6px 4px',
                                                                                height: '100%',
                                                                                display: 'flex',
                                                                                flexDirection: 'column',
                                                                                justifyContent: 'center',
                                                                                cursor: 'pointer',
                                                                                transition: 'all 0.25s ease',
                                                                                opacity: isMyClass ? 0.95 : isSelected ? 0.9 : 0.35,
                                                                                position: 'relative',
                                                                                transform: isSelected ? 'scale(1.02)' : 'scale(1)'
                                                                            }}>
                                                                            <div style={{ fontWeight: 'bold', color: isMyClass ? 'var(--primary)' : subject.color, fontSize: '0.7rem' }}>{subject.code}</div>
                                                                            <div style={{ fontSize: '0.6rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-dim)' }}>{subject.name.replace(' (Lab)', '')}</div>
                                                                            {isMyClass && (
                                                                                <div className="font-code" style={{ fontSize: '0.45rem', background: 'rgba(59, 130, 246, 0.2)', color: 'var(--primary)', padding: '1px 4px', borderRadius: '3px', position: 'absolute', top: '-5px', right: '2px', fontWeight: 'bold', border: '1px solid rgba(0, 229, 255, 0.3)', letterSpacing: '0.5px' }}>YOU</div>
                                                                            )}
                                                                        </div>
                                                                    ) : day === 'Sat' ? (
                                                                        <span style={{ color: 'rgba(255,100,100,0.4)', fontSize: '0.65rem', letterSpacing: '2px', fontWeight: 'bold' }}>HOLIDAY</span>
                                                                    ) : (
                                                                        <span style={{ color: 'rgba(255,255,255,0.02)' }}>—</span>
                                                                    )}

                                                                </td>
                                                            );
                                                        })
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {(() => {
                                    if (!selectedSlot) return null;
                                    const [slotTime, slotDay] = [selectedSlot.split('-').slice(0, -1).join('-'), selectedSlot.split('-').pop()];
                                    const selSubject = studentSubjects.find(s => s.time === slotTime && s.day.includes(slotDay));
                                    if (!selSubject) return null;
                                    const isMine = selSubject.teacher === user.name || (user.subject && selSubject.name.toLowerCase().includes(user.subject.toLowerCase()));
                                    return (
                                        <div style={{
                                            marginTop: '16px',
                                            background: 'rgba(10, 20, 40, 0.7)',
                                            backdropFilter: 'blur(12px)',
                                            border: `1px solid ${isMine ? 'rgba(0, 229, 255, 0.25)' : 'rgba(255,255,255,0.1)'}`,
                                            borderRadius: '10px',
                                            padding: '16px 20px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '20px',
                                            flexWrap: 'wrap',
                                            animation: 'fadeIn 0.2s ease'
                                        }}>
                                            <div style={{ flex: 1, minWidth: '150px' }}>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: isMine ? 'var(--primary)' : selSubject.color, marginBottom: '4px' }}>
                                                    {selSubject.code} — {selSubject.name}
                                                    {isMine && <span className="font-code" style={{ fontSize: '0.55rem', background: 'rgba(59,130,246,0.15)', color: 'var(--primary)', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px', border: '1px solid rgba(59,130,246,0.2)' }}>YOUR CLASS</span>}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>👨‍🏫 <span style={{ color: isMine ? 'var(--primary)' : '#ccc' }}>{selSubject.teacher || 'TBA'}</span></div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '16px', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                                                <span>📅 {selSubject.day}</span>
                                                <span>⏰ {selSubject.time}</span>
                                                <span>📚 {selSubject.credits} Credits</span>
                                            </div>
                                            <button onClick={() => setSelectedSlot(null)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-dim)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '0.7rem' }}>✕</button>
                                        </div>
                                    );
                                })()}
                                <div style={{ marginTop: '16px', display: 'flex', gap: '20px', justifyContent: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '12px', height: '12px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(0, 229, 255, 0.3)', borderRadius: '2px' }} />
                                        <span className="font-code" style={{ fontSize: '0.7rem', color: 'var(--primary)' }}>MY CLASSES</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '12px', height: '12px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '2px' }} />
                                        <span className="font-code" style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>OTHER FACULTY</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span className="font-code" style={{ fontSize: '0.6rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>TAP ANY CLASS FOR DETAILS</span>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    )}

                    {activeTab === 'NOTIFICATIONS' && (
                        <motion.div
                            key="notifications"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Card>
                                <h3 className="font-heading" style={{ color: 'var(--teal)', marginBottom: '20px', fontSize: '0.9rem' }}>📱 SMS NOTIFICATIONS</h3>
                                {(() => {
                                    const smsLogs = notificationService.getPersistedLog().filter(log => log.phone === user.phone);
                                    if (smsLogs.length === 0) {
                                        return (
                                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
                                                <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📭</div>
                                                <p className="font-code">No SMS notifications received yet.</p>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div style={{ display: 'grid', gap: '10px' }}>
                                            {smsLogs.map((log) => (
                                                <div key={log.id} style={{ background: 'rgba(0,0,0,0.2)', padding: '15px 18px', borderRadius: '6px', borderLeft: '3px solid var(--primary)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                        <Badge type={log.type === 'GATE_ENTRY' ? 'blue' : 'green'}>
                                                            {log.type.replace('_', ' ')}
                                                        </Badge>
                                                        <span className="font-code" style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{log.time}</span>
                                                    </div>
                                                    <p className="font-code" style={{ fontSize: '0.85rem', color: '#f8fafc', whiteSpace: 'pre-line', lineHeight: '1.4' }}>
                                                        {log.message}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Self-Attendance Verification Modal */}
            {verifyingSelf && (
                <BiometricVerification 
                    onClose={() => setVerifyingSelf(false)}
                    onSuccess={async (method) => {
                        const result = await onMarkAttendance(method, {
                            customUid: user.uid,
                            customName: user.name,
                            dept: user.dept || '--',
                            subject: 'Self Attendance',
                            nodeId: 'IOT-01',
                            phone: user.phone
                        });
                        if (result.success) {
                            setVerifyingSelf(false);
                            onRefresh();
                        }
                    }}
                    storedFaceData={user.face_data}
                    storedFaceDescriptor={user.face_descriptor}
                    storedRfid={user.rfid_tag}
                    subjectData={activeSubject || { name: 'Faculty Attendance', code: 'FAC' }}
                    nodeId={activeSubject?.nodeId || 'IOT-01'} // Pass the actual hardware ID
                    method="FACE"
                />
            )}
            {kioskActive && (
                <ClassroomKiosk
                    onClose={() => setKioskActive(false)}
                    onRefresh={onRefresh}
                    classStudents={classStudents}
                    subjectData={activeSubject}
                    teacherName={user.name}
                    logs={logs}
                    blockchain={blockchain}
                    onMarkAttendance={onMarkAttendance}
                    onMarkAttendanceBatch={onMarkAttendanceBatch}
                    recentlyScannedUids={recentlyScannedUids}
                    iotNodes={iotNodes}
                />
            )}
        </div>
    );
}
