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
import userService from '../../services/userService';
import iotService from '../../services/iotService';
import BiometricVerification from './BiometricVerification';
import BiometricEnrollment from './BiometricEnrollment';
export default function AdminDashboard({ user, blockchain, iotNodes, logs, lastScannedNodeId, lastScannedLogId, onRefresh, onMarkAttendance, onMarkAttendanceBatch, studentSubjects, walletAddress, recentlyScannedUids, systemLogs }) {
    const [tab, setTab] = useState('OVERVIEW');
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [gateKioskActive, setGateKioskActive] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [enrollingUser, setEnrollingUser] = useState(null);
    const [dbLogs, setDbLogs] = useState([]); // High-performance real-time logs
    const [dbLoading, setDbLoading] = useState(false);

    const activeAttendanceCount = blockchain.chain.filter(b => {
        if (b.index === 0 || !b.timestamp) return false;
        const ts = Number(b.timestamp);
        const date = new Date(ts < 1e12 ? ts * 1000 : ts);
        if (isNaN(date.getTime())) return false;
        const blockDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return blockDate === selectedDate;
    }).length;

    useEffect(() => {
        loadUsers();
        loadDbLogs();
        
        // Subscribe to real-time updates for instant dashboard feedback
        const subscription = supabase
            .channel('dashboard_updates')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance_logs' }, () => {
                loadDbLogs();
            })
            .subscribe();

        return () => supabase.removeChannel(subscription);
    }, []);

    const loadDbLogs = async () => {
        const { success, logs: fetchedLogs } = await attendanceService.getAllLogs();
        if (success) setDbLogs(fetchedLogs);
    };

    const loadUsers = async () => {
        setLoading(true);
        const { success, users } = await userService.getAllUsers();
        if (success) setUsers(users);
        setLoading(false);
    };

    const handleSyncClick = async () => {
        setSyncing(true);
        try {
            await onRefresh(); // App.handleGlobalRefresh (Blockchain sync)
            await loadDbLogs(); // Refresh the visual table logs (Supabase sync)
            await loadUsers(); // Refresh local user list too
        } finally {
            setSyncing(false);
        }
    };

    const handleResetNodes = async () => {
        if (!window.confirm('Reset all IoT node locations to default campus values? This will update names like Lab 1 to Seminar Hall.')) return;
        setSyncing(true);
        try {
            await supabase.from('iot_nodes').delete().neq('id', 'FORCE_DELETE_NONE');
            await iotService.initializeDefaultNodes();
            await onRefresh();
            alert('IoT Nodes updated successfully!');
        } catch (err) {
            console.error(err);
            alert('Failed to reset nodes: ' + err.message);
        } finally {
            setSyncing(false);
        }
    };



    const [simModalOpen, setSimModalOpen] = useState(false);
    const [simNode, setSimNode] = useState(null);
    const [simSearch, setSimSearch] = useState('');
    const [verifyingStudent, setVerifyingStudent] = useState(null);

    const handleManualScan = async (student) => {
        if (!student) return;
        setVerifyingStudent(student);
        setSimModalOpen(false);
    };

    const finalizeAttendance = async (method) => {
        if (!verifyingStudent || !simNode) return;

        const scanData = {
            customUid: verifyingStudent.uid,
            customName: verifyingStudent.name,
            dept: verifyingStudent.dept || '--',
            name: simNode?.location || 'Campus Location', // subject name
            code: 'EVENT', // subject code
            teacher: 'SYSTEM',
            nodeId: simNode.id
        };

        const result = await onMarkAttendance(method, scanData);
        if (result.success) {
            setVerifyingStudent(null);
            setSimNode(null);
            setSimSearch('');
            onRefresh(); // Refresh UI
        }
    };

    const recentLogins = [...users]
        .filter(u => u.last_login_at)
        .sort((a, b) => new Date(b.last_login_at) - new Date(a.last_login_at))
        .slice(0, 5);

    const filteredUsers = users.filter(u =>
        (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.uid || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (gateKioskActive) {
        return (
            <ClassroomKiosk
                onClose={() => setGateKioskActive(false)}
                onRefresh={onRefresh}
                recentlyScannedUids={recentlyScannedUids}
                classStudents={users.filter(u => u.role?.toUpperCase()?.startsWith('STU') || false)}
                allUsers={users}
                allRoles={[...new Set(users.map(u => u.role))]}
                subjectData={{ subject: 'Student Plaza', subjectCode: 'GATE', teacher: 'CAMPUS' }}
                teacherName="SYSTEM"
                onMarkAttendance={onMarkAttendance}
                onMarkAttendanceBatch={onMarkAttendanceBatch}
                logs={logs}
                blockchain={blockchain}
                iotNodes={iotNodes}
            />
        );
    }

    return (
        <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: '30px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0', marginBottom: '20px' }}>
                {['OVERVIEW', 'CAMPUS HUBS', 'BLOCKCHAIN', 'USERS'].map(t => (
                    <div
                        key={t}
                        onClick={() => setTab(t)}
                        style={{
                            cursor: 'pointer',
                            fontFamily: "'Inter', sans-serif",
                            fontSize: '0.95rem',
                            fontWeight: '700',
                            letterSpacing: '0.5px',
                            color: tab === t ? '#ef4444' : 'rgba(255, 255, 255, 0.6)',
                            borderBottom: tab === t ? '3px solid #ef4444' : '3px solid transparent',
                            paddingBottom: '12px',
                            transition: 'all 0.2s ease',
                            textShadow: tab === t ? '0 0 15px rgba(239, 68, 68, 0.4)' : 'none'
                        }}
                    >
                        {t}
                    </div>
                ))}
            </div>

            <AnimatePresence mode="wait">
                {tab === 'OVERVIEW' && (
                    <motion.div
                        key="overview"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}
                    >
                        {/* Row 1: Quick Stats */}
                        <div className="responsive-grid-4" style={{ gap: '20px' }}>
                            <div className="stat-card" style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(59,130,246,0.3)', backdropFilter: 'blur(8px)' }}>
                                <div className="stat-value" style={{ color: '#60a5fa', textShadow: '0 0 20px rgba(59,130,246,0.4)' }}>{users.length}</div>
                                <div className="stat-label" style={{ color: '#f8fafc', fontWeight: 'bold' }}>TOTAL USERS</div>
                            </div>
                            <div className="stat-card" style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid #f59e0b', backdropFilter: 'blur(8px)' }}>
                                <div className="stat-value" style={{ color: '#ef4444', textShadow: '0 0 20px rgba(239,68,68,0.4)' }}>{activeAttendanceCount}</div>
                                <div className="stat-label" style={{ color: '#f8fafc', fontWeight: 'bold' }}>TOTAL ATTENDANCE</div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '8px' }}>
                                    <button onClick={() => {
                                        const d = new Date(selectedDate);
                                        d.setDate(d.getDate() - 1);
                                        setSelectedDate(d.toISOString().split('T')[0]);
                                    }} style={{ background: 'none', border: 'none', color: '#f8fafc', cursor: 'pointer', fontSize: '1rem' }}>&lsaquo;</button>
                                    <span className="font-code" style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 'bold', minWidth: '70px' }}>
                                        {selectedDate === new Date().toISOString().split('T')[0] ? 'TODAY' : selectedDate}
                                    </span>
                                    <button onClick={() => {
                                        const d = new Date(selectedDate);
                                        d.setDate(d.getDate() + 1);
                                        setSelectedDate(d.toISOString().split('T')[0]);
                                    }} style={{ background: 'none', border: 'none', color: '#f8fafc', cursor: 'pointer', fontSize: '1rem' }}>&rsaquo;</button>
                                </div>
                                {selectedDate !== new Date().toISOString().split('T')[0] && (
                                    <div style={{ marginTop: '5px', textAlign: 'center' }}>
                                        <button onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                                            style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontWeight: 'bold' }}>
                                            Go to Today
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="stat-card" style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(59, 130, 246, 0.3)', backdropFilter: 'blur(8px)' }}>
                                <div className="stat-value" style={{ color: '#60a5fa', textShadow: '0 0 20px rgba(59,130,246,0.4)' }}>{blockchain.chain.length}</div>
                                <div className="stat-label" style={{ color: '#f8fafc', fontWeight: 'bold' }}>TOTAL BLOCKS</div>
                            </div>
                            <div className="stat-card" onClick={() => {
                                if (!walletAddress) {
                                    alert("🦊 WALLET NOT CONNECTED\n\nPlease connect your MetaMask wallet using the button in the top bar before starting the scanner.");
                                    return;
                                }
                                setGateKioskActive(true);
                            }} style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(16, 185, 129, 0.4)', backdropFilter: 'blur(8px)', cursor: 'pointer' }}>
                                <div className="stat-value" style={{ color: '#34d399', fontSize: '1.2rem', textShadow: '0 0 20px rgba(16,185,129,0.4)' }}>STUDENT PLAZA</div>
                                <div className="stat-label" style={{ color: '#f8fafc', fontWeight: 'bold' }}>MAIN GATE HUB</div>
                            </div>
                        </div>

                        {/* Row 2: Attendance Records Table */}
                        <Card>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <h3 className="font-heading" style={{ color: 'var(--primary)', fontSize: '1rem' }}>ATTENDANCE RECORDS</h3>
                                    <button
                                        className="btn-cyber"
                                        onClick={handleSyncClick}
                                        disabled={syncing}
                                        style={{ padding: '4px 12px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                                    >
                                        <span>{syncing ? '⏳' : '🔄'}</span> {syncing ? 'SYNCING...' : 'SYNC'}
                                    </button>
                                </div>
                                <Badge type="teal">{blockchain.chain.length - 1} RECORDS</Badge>
                            </div>
                            <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>STUDENT</th>
                                            <th>DEPARTMENT</th>
                                            <th>SUBJECT</th>
                                            <th>METHOD</th>
                                            <th>TIMESTAMP</th>
                                            <th>STATUS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {blockchain.chain.length <= 1 ? (
                                            <tr>
                                                <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
                                                    No attendance records found. Records will appear here after students check in.
                                                </td>
                                            </tr>
                                        ) : (
                                            (() => {
                                                // Filter database logs by the selected date for clean UI
                                                const filteredBlocks = dbLogs.filter(log => {
                                                    const logDate = new Date(log.timestamp).toISOString().split('T')[0];
                                                    return logDate === selectedDate;
                                                });

                                                return filteredBlocks.map((log, i) => (
                                                    <tr key={log.id || i}
                                                        className={lastScannedLogId && log.tx_hash === lastScannedLogId ? 'glow-row' : ''}
                                                        style={{ animation: `fadeIn 0.3s ease-out ${Math.min(i * 0.05, 0.5)}s both` }}>
                                                        <td style={{ padding: '12px' }} className="font-code">#{filteredBlocks.length - i}</td>
                                                        <td style={{ padding: '12px' }}>
                                                            <div style={{ fontWeight: 'bold' }}>{log.name || log.uid}</div>
                                                            <div className="font-code" style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{log.uid}</div>
                                                        </td>
                                                        <td className="font-code" style={{ fontSize: '0.85rem' }}>{log.dept || '--'}</td>
                                                        <td>
                                                            <span className="subject-tag" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: 'var(--primary)' }}>
                                                                <div className="font-code" style={{ fontSize: '0.65rem', opacity: 0.7 }}>{log.subject_code || (log.subject && log.subject !== '--' ? log.subject.substring(0, 3).toUpperCase() : 'SUBJ')}</div>
                                                                {log.subject || '--'}
                                                            </span>
                                                        </td>
                                                        <td><Badge type={log.method === 'FACE' ? 'cyan' : log.method === 'FACE_RFID' ? 'green' : 'gold'}>{log.method}</Badge></td>
                                                        <td className="font-code" style={{ fontSize: '0.8rem' }}>
                                                            {new Date(log.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (IST)
                                                        </td>
                                                        <td>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                <Badge type="green">PRESENT</Badge>
                                                                {log.tx_hash && <span title="Confirmed on Blockchain" style={{ fontSize: '0.8rem', cursor: 'help' }}>🔗</span>}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            })()
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>

                        {/* Row 3: Recent Logins + Audit Logs */}
                        <div className="responsive-grid-2" style={{ gap: '30px' }}>
                            <Card>
                                <h3 className="font-heading" style={{ color: 'var(--teal)', marginBottom: '15px', fontSize: '0.9rem' }}>RECENT LOGINS</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {recentLogins.length === 0 ? (
                                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dim)', background: 'rgba(0,0,0,0.2)' }}>No recent activity detected.</div>
                                    ) : (
                                        recentLogins.map(ru => (
                                            <div key={ru.uid} style={{ background: 'rgba(0,0,0,0.2)', padding: '12px 15px', borderRadius: '6px', borderLeft: '3px solid var(--teal)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <div style={{ fontWeight: 'bold' }}>{ru.name}</div>
                                                    <div className="font-code" style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{ru.uid} • {ru.role}</div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div className="font-code" style={{ fontSize: '0.75rem', color: '#60a5fa', fontWeight: 'bold' }}>
                                                        {new Date(ru.last_login_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (IST)
                                                    </div>
                                                    <Badge type="teal">ACTIVE</Badge>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </Card>

                            <Card style={{ background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                <h3 className="font-heading" style={{ color: '#ef4444', marginBottom: '15px', fontSize: '0.9rem', fontWeight: 'bold' }}>SESSION LOGS <span className="font-code" style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.6)', fontFamily: "'JetBrains Mono', monospace" }}>(current session only)</span></h3>
                                <div style={{ height: '300px', overflowY: 'auto', fontSize: '0.85rem', padding: '10px' }} className="font-code">
                                    {(systemLogs || []).map(l => (
                                        <div key={l.id} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <span style={{ color: '#ef4444', fontWeight: 'bold' }}>[{l.time} IST]</span>
                                            <span style={{ color: '#f8fafc', marginLeft: '10px' }}>{l.msg}</span>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        </div>
                    </motion.div>
                )}

                {tab === 'CAMPUS HUBS' && (
                    <motion.div
                        key="iot"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 className="font-heading" style={{ color: 'var(--red)' }}>HUB INFRASTRUCTURE</h3>
                            <button className="btn-cyber" onClick={handleResetNodes} disabled={syncing} style={{ padding: '5px 15px', fontSize: '0.75rem', border: '1px solid rgba(255,23,68,0.4)', background: 'rgba(255,23,68,0.1)' }}>
                                {syncing ? 'UPDATING...' : '🔄 RESET TO DEFAULTS'}
                            </button>
                        </div>
                        <div className="responsive-grid-3" style={{ gap: '20px' }}>
                            {iotNodes.filter(n => n.id !== 'IOT-01').map((node, i) => (
                                <Card key={node.id}
                                    className={node.id === lastScannedNodeId ? 'pulse-green' : ''}
                                    style={{
                                        borderColor: (node.id === lastScannedNodeId) ? 'var(--green)' : (node.status === 'ONLINE' ? 'var(--green)' : node.status === 'OFFLINE' ? 'var(--red)' : 'var(--gold)'),
                                        transition: 'all 0.5s ease'
                                    }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                                        <div className="font-heading" style={{ fontSize: '0.9rem' }}>{node.location}</div>
                                        <Badge type={node.status === 'ONLINE' ? 'green' : node.status === 'OFFLINE' ? 'red' : 'gold'}>{node.status}</Badge>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
                                        <div style={{ fontSize: '0.75rem', fontFamily: "'Inter', sans-serif", color: 'var(--text-dim)' }}>SIGNAL</div>
                                        <div style={{ flex: 1, height: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div className="progress-bar-fill" style={{
                                                width: `${node.signal}%`,
                                                background: node.signal > 80 ? 'var(--green)' : node.signal > 40 ? 'var(--gold)' : 'var(--red)'
                                            }} />
                                        </div>
                                        <div className="font-code" style={{ fontSize: '0.85rem' }}>{node.signal}%</div>
                                    </div>
                                    <div className="font-code" style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '15px', borderTop: '1px solid var(--border)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>ID: {node.id.toUpperCase()}</span>
                                        <button
                                            onClick={() => { setSimNode(node); setSimModalOpen(true); }}
                                            className="btn-cyber"
                                            style={{ padding: '2px 8px', fontSize: '0.65rem', border: '1px solid var(--primary)', color: 'var(--primary)' }}
                                        >
                                            MARK ATTENDANCE
                                        </button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </motion.div>
                )}

                {tab === 'BLOCKCHAIN' && (
                    <motion.div
                        key="blockchain"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
                    >
                        <Card>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h3 className="font-heading" style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>LEDGER EXPLORER</h3>
                                <Badge type="teal">BLOCKS: {blockchain.chain.length}</Badge>
                            </div>
                            <div style={{ overflowX: 'auto', display: 'flex', gap: '20px', paddingBottom: '20px' }} className="cyber-scrollbar">
                                {blockchain.chain.map((b, i) => (
                                    <div key={i} style={{
                                        minWidth: '280px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)',
                                        padding: '20px', borderRadius: '8px', position: 'relative'
                                    }}>
                                        <div style={{ position: 'absolute', top: '0', right: '0', padding: '5px 10px', background: 'var(--border)', color: 'var(--primary)', fontSize: '0.65rem', borderBottomLeftRadius: '8px' }}>
                                            #{b.index}
                                        </div>
                                        <div className="font-heading" style={{ color: 'var(--primary)', fontSize: '0.8rem', marginBottom: '15px' }}>BLOCK DATA</div>
                                        <div style={{ fontSize: '0.85rem', marginBottom: '10px' }}>
                                            {i === 0 ? <Badge type="gold">GENESIS BLOCK</Badge> : (
                                                <div>
                                                    <div style={{ fontWeight: 'bold' }}>{b.data.name}</div>
                                                    <div className="font-code" style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '4px' }}>METHOD: {b.data.method}</div>
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ marginTop: '15px' }}>
                                            <div className="font-code" style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)' }}>TIMESTAMP</div>
                                            <div className="font-code" style={{ fontSize: '0.75rem', color: '#f8fafc' }}>
                                                {(() => {
                                                    const ts = b.timestamp;
                                                    const date = typeof ts === 'number' && ts < 1e12 ? new Date(ts * 1000) : new Date(ts);
                                                    return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' (IST)';
                                                })()}
                                            </div>
                                        </div>
                                        <div style={{ marginTop: '10px' }}>
                                            <div className="font-code" style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>HASH</div>
                                            <div className="font-code" style={{ fontSize: '0.6rem', wordBreak: 'break-all', color: 'var(--teal)' }}>{b.hash.substring(0, 48)}...</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </motion.div>
                )}

                {tab === 'USERS' && (
                    <motion.div
                        key="users"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        <Card>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                                <h3 className="font-heading" style={{ color: 'var(--accent)', fontSize: '1rem' }}>USER MANAGEMENT</h3>
                                <div style={{ display: 'flex', gap: '15px' }}>
                                    <input
                                        type="text"
                                        placeholder="Search by name, ID or email..."
                                        className="form-input"
                                        style={{ margin: 0, padding: '8px 15px', width: '300px', fontSize: '0.85rem' }}
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                    <button
                                        className="btn-cyber"
                                        onClick={loadUsers}
                                        disabled={loading}
                                        style={{ padding: '8px 15px' }}
                                    >
                                        {loading ? 'SYNCING...' : 'REFRESH'}
                                    </button>
                                </div>
                            </div>

                            <div style={{ overflowX: 'auto' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>NAME & ID</th>
                                            <th>EMAIL</th>
                                            <th>ROLE</th>
                                            <th>DEPT/YEAR</th>
                                            <th>LAST LOGIN</th>
                                            <th>STATUS</th>
                                            <th style={{ textAlign: 'right' }}>ACTIONS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading && (
                                            <tr>
                                                <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>
                                                    <div className="font-heading" style={{ color: 'var(--primary)' }}>SYNCING WITH DATABASE...</div>
                                                </td>
                                            </tr>
                                        )}
                                        {!loading && filteredUsers.map((u, i) => (
                                            <tr key={u.uid} style={{ animation: `fadeIn 0.3s ease-out ${i * 0.05}s both` }}>
                                                <td>
                                                    <div style={{ fontWeight: 'bold' }}>{u.name}</div>
                                                    <div className="font-code" style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{u.uid}</div>
                                                </td>
                                                <td>{u.email}</td>
                                                <td><Badge type={u.role === 'ADMIN' ? 'red' : u.role === 'TEACHER' ? 'gold' : 'teal'}>{u.role}</Badge></td>
                                                <td className="font-code" style={{ fontSize: '0.8rem' }}>
                                                    {u.dept} {u.year ? `• Year ${u.year}` : ''}
                                                </td>
                                                <td className="font-code" style={{ fontSize: '0.8rem' }}>
                                                    {u.last_login_at ? `${new Date(u.last_login_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (IST)` : 'Never'}
                                                </td>
                                                <td>
                                                    <Badge type="green">ENROLLED</Badge>
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    {(u.role === 'STUDENT' || u.role === 'TEACHER') && (
                                                        <button
                                                            className="btn-cyber"
                                                            onClick={() => setEnrollingUser(u)}
                                                            style={{ padding: '4px 8px', fontSize: '0.65rem', border: '1px solid var(--primary)', color: 'var(--primary)', background: 'rgba(59,130,246,0.1)' }}
                                                        >
                                                            RE-ENROLL FACE
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {!loading && filteredUsers.length === 0 && (
                                            <tr>
                                                <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
                                                    No users found matching "{searchTerm}"
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* MANUAL ATTENDANCE MODAL */}
            {
                simModalOpen && (
                    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15,17,23,0.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
                        <Card style={{ width: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h3 className="font-heading" style={{ color: 'var(--primary)' }}>SELECT STUDENT FOR {simNode?.location.toUpperCase()}</h3>
                                <button onClick={() => setSimModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1.5rem' }}>&times;</button>
                            </div>
                            <div style={{ marginBottom: '15px' }}>
                                <input
                                    type="text"
                                    placeholder="Search student by name or ID..."
                                    className="form-input"
                                    style={{ margin: 0, padding: '10px 15px', width: '100%', fontSize: '0.9rem' }}
                                    value={simSearch}
                                    onChange={(e) => setSimSearch(e.target.value)}
                                />
                            </div>
                            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {users.filter(u => u.role === 'STUDENT' && (
                                    u.name.toLowerCase().includes(simSearch.toLowerCase()) ||
                                    u.uid.toLowerCase().includes(simSearch.toLowerCase())
                                )).map(s => (
                                    <div
                                        key={s.uid}
                                        onClick={() => handleManualScan(s)}
                                        style={{ background: 'rgba(255,255,255,0.05)', padding: '12px 15px', borderRadius: '6px', border: '1px solid transparent', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'rgba(59,130,246,0.05)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 'bold' }}>{s.name}</div>
                                            <div className="font-code" style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{s.uid}</div>
                                        </div>
                                        <div className="font-code" style={{ fontSize: '0.7rem', color: 'var(--primary)' }}>SELECT &rsaquo;</div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>
                )
            }

            {/* BIOMETRIC VERIFICATION Flow */}
            {
                verifyingStudent && (
                    <BiometricVerification
                        onClose={() => setVerifyingStudent(null)}
                        onSuccess={(method) => finalizeAttendance(method)}
                        storedFaceData={verifyingStudent.face_data}
                        storedFaceDescriptor={verifyingStudent.face_descriptor}
                        storedRfid={verifyingStudent.rfid_tag}
                        method="FACE"
                        subjectData={{
                            name: simNode?.location || 'Campus Location',
                            code: 'EVENT'
                        }}
                    />
                )
            }

            {/* BIOMETRIC ENROLLMENT Flow */}
            {
                enrollingUser && (
                    <BiometricEnrollment
                        user={enrollingUser}
                        onClose={() => setEnrollingUser(null)}
                        onRefresh={loadUsers}
                    />
                )
            }
        </div>
    );
}
