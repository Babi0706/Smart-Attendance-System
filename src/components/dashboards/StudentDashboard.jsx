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
import WeeklyScheduleGrid from './WeeklyScheduleGrid';
import BiometricVerification from './BiometricVerification';
import notificationService from '../../services/notificationService';

export default function StudentDashboard({ user, blockchain, onMarkAttendance, txPending, lastScannedLogId, studentSubjects, pendingHubScan }) {
    const [activeTab, setActiveTab] = useState('SUBJECTS');
    const [showToast, setShowToast] = useState(false);
    const [verifyingHub, setVerifyingHub] = useState(false);

    const myRecords = blockchain.chain
        .filter(b => b.data.uid === user.uid)
        .sort((a, b) => b.timestamp - a.timestamp);

    // Calculate true percentage based on an assumed total number of expected classes (e.g., 50 for the semester)
    // If you want this to be dynamic based on days passed, we can update it further.
    const TOTAL_CLASSES = 50;
    const attendancePct = Math.min(100, Math.round((myRecords.length / TOTAL_CLASSES) * 100));

    useEffect(() => {
        if (attendancePct < 75) {
            setShowToast(true);
            const timer = setTimeout(() => setShowToast(false), 5000); // auto dismiss
            return () => clearTimeout(timer);
        }
    }, [attendancePct]);

    const todayClasses = (() => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const today = days[new Date().getDay()];
        const filtered = studentSubjects.filter(s => s.day.includes(today));

        // Deduplicate by code and time to prevent repeats from database script errors
        const unique = [];
        const seen = new Set();
        filtered.forEach(s => {
            const key = `${s.code}-${s.time24 || s.time}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(s);
            }
        });
        return unique.sort((a, b) => (a.time24 || a.time).localeCompare(b.time24 || b.time));
    })();

    // Check which subjects already have attendance today (from teacher kiosk or self check-in)
    const todayDate = new Date().toISOString().split('T')[0];
    const todayMyRecords = blockchain.chain.filter(b => {
        if (b.index === 0 || !b.timestamp) return false;
        if (b.data.uid !== user.uid) return false;
        const ts = Number(b.timestamp);
        const date = new Date(ts < 1e12 ? ts * 1000 : ts);
        if (isNaN(date.getTime())) return false;
        return date.toISOString().split('T')[0] === todayDate;
    });
    const markedSubjects = new Set(todayMyRecords.map(r => (r.data.subjectCode || r.data.subject || '').toUpperCase()));

    // Check if Main Attendance (Gate) is marked
    const isGateMarked = blockchain.chain.some(b =>
        b.data &&
        b.data.uid === user.uid &&
        b.data.subject === 'Student Plaza' &&
        new Date(Number(b.timestamp < 1e12 ? b.timestamp * 1000 : b.timestamp)).toISOString().split('T')[0] === todayDate
    );

    // Handle Background RFID Scans for Self-Attendance (Gate or Hub)
    useEffect(() => {
        const unsubscribe = rfidService.subscribeToScans((scan) => {
            const storedUid = (user.rfid_uid || user.rfid_tag || '').toUpperCase().trim();
            const scanUid = (scan.uid || '').toUpperCase().trim();

            if (scanUid === storedUid) {
                console.log('[StudentDashboard] RFID Trigger detected for self-attendance');
                setVerifyingHub(true); // Re-use the verifying hub state/modal
            }
        });
        return () => unsubscribe();
    }, [user]);

    const isPendingForMe = pendingHubScan && pendingHubScan.uid === user.uid;

    return (
        <div className="dashboard-layout">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <Card>
                    <div style={{ textAlign: 'center', padding: '5px 0' }}>
                        {user.face_data ? (
                            <div style={{ position: 'relative', display: 'inline-block', marginBottom: '15px' }}>
                                <img src={user.face_data} alt="Profile" style={{ width: '100px', height: '100px', borderRadius: '50%', border: '3px solid var(--primary)', objectFit: 'cover', display: 'block' }} />
                                <div style={{ position: 'absolute', bottom: '2px', right: '2px', width: '18px', height: '18px', background: 'var(--green)', borderRadius: '50%', border: '2px solid var(--bg)' }} />
                            </div>
                        ) : (
                            <div style={{ width: '100px', height: '100px', borderRadius: '50%', border: '3px solid var(--primary)', margin: '0 auto 15px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', background: 'linear-gradient(135deg, #1e293b, var(--border))' }}>👨‍🎓</div>
                        )}
                        <h2 className="font-heading" style={{ fontSize: '1.1rem' }}>{user.name}</h2>
                        <p className="font-code" style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>{user.uid}</p>
                        {user.dept && <p className="font-code" style={{ color: 'var(--teal)', fontSize: '0.8rem', marginTop: '4px' }}>{user.dept} • {user.year || 'Year 3'} • Sec {user.section || 'A'}</p>}
                    </div>
                </Card>
                <div className="responsive-grid-2" style={{ gap: '12px' }}>
                    <div className="stat-card" style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(59,130,246,0.3)', backdropFilter: 'blur(8px)' }}>
                        <div className="stat-value" style={{ color: '#60a5fa', textShadow: '0 0 20px rgba(59,130,246,0.4)' }}>{todayClasses.length}</div>
                        <div className="stat-label" style={{ color: '#f8fafc', fontWeight: 'bold', fontSize: '0.7rem', letterSpacing: '0.5px' }}>CLASSES TODAY</div>
                    </div>
                    <div className="stat-card" style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(16,185,129,0.3)', backdropFilter: 'blur(8px)' }}>
                        <div className="stat-value" style={{ color: '#34d399', textShadow: '0 0 20px rgba(16,185,129,0.4)' }}>{attendancePct}%</div>
                        <div className="stat-label" style={{ color: '#f8fafc', fontWeight: 'bold', fontSize: '0.7rem', letterSpacing: '0.5px' }}>ATTENDANCE</div>
                    </div>
                    <div className="stat-card" style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(139,92,246,0.3)', backdropFilter: 'blur(8px)' }}>
                        <div className="stat-value" style={{ color: '#a78bfa', textShadow: '0 0 20px rgba(139,92,246,0.4)' }}>{new Set(studentSubjects.map(s => s.code)).size}</div>
                        <div className="stat-label" style={{ color: '#f8fafc', fontWeight: 'bold', fontSize: '0.7rem', letterSpacing: '0.5px' }}>SUBJECTS</div>
                    </div>
                    <div className="stat-card" style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(245,158,11,0.3)', backdropFilter: 'blur(8px)' }}>
                        <div className="stat-value" style={{ color: '#fbbf24', textShadow: '0 0 20px rgba(245,158,11,0.4)' }}>{myRecords.length}</div>
                        <div className="stat-label" style={{ color: '#f8fafc', fontWeight: 'bold', fontSize: '0.7rem', letterSpacing: '0.5px' }}>RECORDS</div>
                    </div>
                </div>
                <Card>
                    <h4 className="font-heading" style={{ color: 'var(--primary)', marginBottom: '12px', fontSize: '0.85rem' }}>ATTENDANCE OVERVIEW</h4>
                    <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                        <span className="font-code" style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Overall</span>
                        <span className="font-code" style={{ fontSize: '0.8rem', color: attendancePct >= 75 ? 'var(--green)' : 'var(--red)' }}>{attendancePct}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.4)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div className="progress-bar-fill" style={{ width: `${attendancePct}%`, background: attendancePct >= 75 ? 'linear-gradient(90deg, var(--teal), var(--green))' : 'linear-gradient(90deg, var(--red), var(--gold))' }} />
                    </div>
                    <p className="font-code" style={{ color: attendancePct >= 75 ? 'var(--green)' : 'var(--red)', fontSize: '0.75rem', marginTop: '8px' }}>
                        {attendancePct >= 75 ? '✓ Above minimum requirement' : '⚠ Below 75% threshold'}
                    </p>
                </Card>

                {/* PENDING HUB SCAN ALERT */}
                {isPendingForMe && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="stat-card"
                        style={{ background: 'linear-gradient(135deg, #1e1b4b, #312e81)', border: '2px solid var(--primary)', padding: '20px', textAlign: 'center' }}
                    >
                        <div style={{ fontSize: '2rem', marginBottom: '10px' }}>📡</div>
                        <h4 className="font-heading" style={{ color: '#fff', marginBottom: '8px' }}>RFID DETECTED AT {pendingHubScan.location.toUpperCase()}</h4>

                        <p className="font-code" style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginBottom: '15px' }}>
                            [TEST MODE] Complete your check-in with a Face Scan.
                        </p>
                        <button
                            onClick={() => setVerifyingHub(true)}
                            className="btn-cyber"
                            style={{ width: '100%', padding: '12px' }}
                        >
                            COMPLETE CHECK-IN
                        </button>
                    </motion.div>
                )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', gap: '30px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0', marginBottom: '20px' }}>
                    {['SUBJECTS', 'TIMETABLE', 'RECORDS', 'NOTIFICATIONS'].map(t => (
                        <div
                            key={t}
                            onClick={() => setActiveTab(t)}
                            style={{
                                cursor: 'pointer',
                                fontFamily: "'Inter', sans-serif",
                                fontSize: '0.95rem',
                                fontWeight: '700',
                                letterSpacing: '0.5px',
                                color: activeTab === t ? '#ef4444' : 'rgba(255, 255, 255, 0.6)',
                                borderBottom: activeTab === t ? '3px solid #ef4444' : '3px solid transparent',
                                paddingBottom: '12px',
                                transition: 'all 0.2s ease',
                                textShadow: activeTab === t ? '0 0 15px rgba(239, 68, 68, 0.4)' : 'none'
                            }}
                        >
                            {t}
                        </div>
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    {activeTab === 'SUBJECTS' && (
                        <motion.div
                            key="subjects"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="responsive-grid-2"
                            style={{ gap: '15px' }}
                        >
                            {(() => {
                                const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                                const today = days[new Date().getDay()];

                                // Deduplicate subjects by code
                                const uniqueSubjs = [];
                                const seenCodes = new Set();

                                // Sort so that if a subject has multiple days, we check if ANY are today
                                studentSubjects.forEach(s => {
                                    if (!seenCodes.has(s.code)) {
                                        seenCodes.add(s.code);
                                        // Find all slots for this subject
                                        const allSlots = studentSubjects.filter(sub => sub.code === s.code);
                                        const hasToday = allSlots.some(slot => slot.day.includes(today));
                                        uniqueSubjs.push({ ...s, hasToday });
                                    }
                                });

                                return uniqueSubjs.sort((a, b) => {
                                    if (a.hasToday && !b.hasToday) return -1;
                                    if (!a.hasToday && b.hasToday) return 1;
                                    return 0;
                                });
                            })().map((subj, i) => (
                                <Card key={subj.code} style={{ borderLeft: `3px solid ${subj.color}` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                        <div>
                                            <span className="subject-tag" style={{ background: `${subj.color}15`, color: subj.color, border: `1px solid ${subj.color}30`, marginBottom: '8px' }}>{subj.code}</span>
                                            <h4 style={{ marginTop: '8px', fontSize: '1rem', fontWeight: 600 }}>{subj.name}</h4>
                                        </div>
                                    </div>
                                    <div className="font-code" style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '15px' }}>👨‍🏫 {subj.teacher}</div>

                                    {(() => {
                                        const isToday = subj.hasToday;
                                        const isMarked = markedSubjects.has(subj.code.toUpperCase()) || markedSubjects.has(subj.name.toUpperCase());

                                        let statusText = 'NOT TODAY';
                                        let statusColor = 'var(--text-dim)';
                                        let statusBg = 'rgba(255,255,255,0.02)';
                                        let statusBorder = 'rgba(255,255,255,0.05)';

                                        if (isMarked) {
                                            statusText = '✓ MARKED';
                                            statusColor = 'var(--green)';
                                            statusBg = 'rgba(16,185,129,0.1)';
                                            statusBorder = 'rgba(16,185,129,0.3)';
                                        } else if (isToday) {
                                            statusText = 'PENDING';
                                            statusColor = 'var(--gold)';
                                            statusBg = 'rgba(245,158,11,0.05)';
                                            statusBorder = 'rgba(245,158,11,0.2)';
                                        }

                                        return (
                                            <div className="font-code" style={{ width: '100%', padding: '8px', fontSize: '0.75rem', textAlign: 'center', background: statusBg, border: `1px solid ${statusBorder}`, borderRadius: '6px', color: statusColor, fontWeight: 'bold', letterSpacing: '1px' }}>
                                                {statusText}
                                            </div>
                                        );
                                    })()}
                                </Card>
                            ))}
                        </motion.div>
                    )}

                    {activeTab === 'TIMETABLE' && (
                        <motion.div
                            key="timetable"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Card>
                                <h3 className="font-heading" style={{ color: 'var(--primary)', marginBottom: '20px', fontSize: '0.9rem' }}>📅 TODAY — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} (IST)</h3>
                                {todayClasses.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
                                        <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🎉</div>
                                        <p className="font-code">No classes today!</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {todayClasses.map((subj, i) => (
                                            <div key={subj.code} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '14px 18px', background: 'rgba(0,0,0,0.2)', borderLeft: `3px solid ${subj.color}`, borderRadius: '6px' }}>
                                                <div style={{ minWidth: '100px', textAlign: 'center' }}>
                                                    <div className="font-heading" style={{ color: subj.color, fontSize: '0.8rem' }}>
                                                        {(() => {
                                                            if (!subj.time24) return subj.time;
                                                            const [h, m] = subj.time24.split(':').map(Number);
                                                            const endH = h + 1;
                                                            const endAmPm = endH >= 12 && endH < 24 ? 'PM' : 'AM';
                                                            const startAmPm = h >= 12 && h < 24 ? 'PM' : 'AM';
                                                            const startH12 = h % 12 || 12;
                                                            const endH12 = endH % 12 || 12;
                                                            return `${startH12}:${m.toString().padStart(2, '0')} - ${endH12}:${m.toString().padStart(2, '0')} ${endAmPm}`;
                                                        })()}
                                                    </div>
                                                    <div className="font-code" style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>{subj.time.includes('AM') || (subj.time24 && parseInt(subj.time24.split(':')[0]) < 12) ? 'MORNING' : 'AFTERNOON'} SESSION</div>
                                                </div>
                                                <div style={{ width: '1px', height: '35px', background: 'var(--border)' }} />
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{subj.name}</div>
                                                    <div className="font-code" style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{subj.teacher} • {subj.code}</div>
                                                </div>
                                                {(() => {
                                                    const isMarked = markedSubjects.has(subj.code.toUpperCase()) || markedSubjects.has(subj.name.toUpperCase());
                                                    return (
                                                        <div className="font-code" style={{ padding: '5px 12px', fontSize: '0.7rem', background: isMarked ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isMarked ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '6px', color: isMarked ? 'var(--green)' : 'var(--text-dim)', fontWeight: 'bold' }}>
                                                            {isMarked ? '✓ MARKED' : 'PENDING'}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div style={{ marginTop: '30px' }}>
                                    <h4 className="font-heading" style={{ color: 'var(--teal)', marginBottom: '15px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span>📅</span> WEEKLY MASTER SCHEDULE
                                    </h4>
                                    <WeeklyScheduleGrid studentSubjects={studentSubjects} />
                                </div>
                            </Card>
                        </motion.div>
                    )}

                    {activeTab === 'RECORDS' && (
                        <motion.div
                            key="records"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Card>
                                <h3 className="font-heading" style={{ color: 'var(--teal)', marginBottom: '20px', fontSize: '0.9rem' }}>🔗 MY BLOCKCHAIN RECORDS</h3>
                                {myRecords.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
                                        <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📋</div>
                                        <p className="font-code">No records yet. Mark your first check-in!</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gap: '10px' }}>
                                        {myRecords.map((b, i) => (
                                            <div key={i}
                                                className={lastScannedLogId && b.data.txHash === lastScannedLogId ? 'glow-row' : ''}
                                                style={{ background: 'rgba(0,0,0,0.2)', padding: '15px 18px', borderRadius: '6px', borderLeft: '3px solid var(--primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <div className="font-code" style={{ fontSize: '0.65rem', color: 'var(--green)', fontWeight: 'bold' }}>✓ MARKED {new Date(b.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })} (IST)</div>
                                                    <div style={{ fontWeight: 600, marginTop: '3px' }}>{b.data.method} CHECK-IN</div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <Badge type="green">VERIFIED</Badge>
                                                    <div className="font-code" style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '4px' }}>Block #{b.index}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
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

            {/* Threshold Alert Toast */}
            {showToast && (
                <div style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    background: 'rgba(17, 24, 39, 0.95)',
                    border: '1px solid var(--red)',
                    borderLeft: '4px solid var(--red)',
                    padding: '15px 20px',
                    borderRadius: '8px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                    zIndex: 9999,
                    animation: 'slideInRight 0.3s ease-out forwards',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '15px',
                    maxWidth: '350px'
                }}>
                    <div style={{ fontSize: '1.5rem' }}>⚠️</div>
                    <div>
                        <h4 className="font-heading" style={{ color: 'var(--red)', marginBottom: '5px', fontSize: '0.9rem' }}>ATTENDANCE WARNING</h4>
                        <p className="font-code" style={{ color: 'var(--text-main)', fontSize: '0.8rem', lineHeight: '1.4' }}>
                            Your overall attendance is currently <strong>{attendancePct}%</strong>. This is below the required 75% threshold.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowToast(false)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1.2rem', padding: '0 5px' }}
                    >
                        ×
                    </button>
                </div>
            )}

            {/* Hub Verification Modal */}
            {verifyingHub && pendingHubScan && (
                <BiometricVerification
                    onClose={() => setVerifyingHub(false)}
                    onSuccess={async (method) => {
                        const result = await onMarkAttendance(method, {
                            customUid: user.uid,
                            customName: user.name,
                            dept: user.dept || '--',
                            name: pendingHubScan.location,
                            nodeId: pendingHubScan.nodeId,
                            phone: user.phone
                        });
                        if (result.success) {
                            setVerifyingHub(false);
                            // pendingHubScan will be cleared by App.jsx or next scan
                        } else if (result.error === 'ALREADY_MARKED') {
                            alert('Attendance already marked for today!');
                            setVerifyingHub(false);
                        } else {
                            alert('Check-in failed: ' + result.error);
                            setVerifyingHub(false);
                        }
                    }}
                    storedFaceData={user.face_data}
                    storedFaceDescriptor={user.face_descriptor}
                    storedRfid={user.rfid_uid}
                    subjectData={{
                        name: pendingHubScan.location,
                        code: 'HUB'
                    }}
                    method="FACE" // Require face scan first, followed by RFID
                />
            )}
        </div>
    );
}



// --- Helper Components ---
// EventAttendanceActions removed as per user request for automatic logic

