import React, { useState, useEffect, useRef } from 'react';
import web3Service from './services/web3Service';
import attendanceBlockchain from './services/attendanceBlockchain';
import authService from './services/authService';
import userService from './services/userService';
import iotService from './services/iotService';
import faceService from './services/faceService';
import attendanceService from './services/attendanceService';
import notificationService from './services/notificationService';
import { supabase } from './config/supabase';
import rfidService from './services/rfidService';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

import GlobalStyles from './components/ui/GlobalStyles';
import Card from './components/ui/Card';
import Badge from './components/ui/Badge';

import { Block, Blockchain } from './models/Blockchain';
import { getCurrentTimestamp, INITIAL_USERS, INIT_IOT_NODES, parseTime, resolveSubjectAtTime } from './utils/constants';

import WalletGateScreen from './components/auth/WalletGateScreen';
import SplashScreen from './components/auth/SplashScreen';
import AuthScreen from './components/auth/AuthScreen';

import BiometricVerification from './components/dashboards/BiometricVerification';
import ClassroomKiosk from './components/dashboards/ClassroomKiosk';
import StudentDashboard from './components/dashboards/StudentDashboard';
import TeacherDashboard from './components/dashboards/TeacherDashboard';
import AdminDashboard from './components/dashboards/AdminDashboard';
// ==========================================
// 3. UI COMPONENTS (ATOMS)
// ==========================================


// ==========================================
// 4. MAIN APP LOGIC
// ==========================================
export default function App() {
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
    const [screen, setScreen] = useState('auth');
    const [currentUser, setCurrentUser] = useState(null);
    const [users, setUsers] = useState(INITIAL_USERS);
    const [blockchain, setBlockchain] = useState(new Blockchain());
    const [iotNodes, setIotNodes] = useState(INIT_IOT_NODES);
    const [studentSubjects, setStudentSubjects] = useState([]);
    const [systemLogs, setSystemLogs] = useState([]); // Renamed from logs to avoid confusion
    const [recentlyScannedUids, setRecentlyScannedUids] = useState(new Map()); // UID -> Timestamp for throttling

    // Blockchain/Web3 State
    const [walletAddress, setWalletAddress] = useState(null);
    const [isWalletConnected, setIsWalletConnected] = useState(false);
    const [processingMarks, setProcessingMarks] = useState(new Set());
    const [txPending, setTxPending] = useState(false);
    const [lastTxHash, setLastTxHash] = useState(null);
    const [lastScannedNodeId, setLastScannedNodeId] = useState(null);
    const [lastScannedLogId, setLastScannedLogId] = useState(null);
    const [pendingHubScan, setPendingHubScan] = useState(null); // { uid, nodeId, location, timestamp }

    // Networking & PWA State
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingSyncCount, setPendingSyncCount] = useState(0);

    // Theme logic
    useEffect(() => {
        if (theme === 'light') {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

    // Guard to prevent multiple reconnect attempts (React StrictMode double-fires effects)
    const walletReconnectAttempted = useRef(false);

    // Network Status Listener
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            addLog('SYSTEM_ONLINE: Synchronizing records...');
            syncOfflineRecords();
        };
        const handleOffline = () => {
            setIsOnline(false);
            addLog('SYSTEM_OFFLINE: Local storage activated');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Initial check for pending records
        checkPendingSync();

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Wallet Status & Account Changes
    useEffect(() => {
        web3Service.onAccountsChanged((accounts) => {
            if (accounts.length === 0) {
                handleDisconnectWallet();
            } else {
                setWalletAddress(accounts[0]);
                addLog(`WALLET_SWITCHED: ${accounts[0].substring(0, 6)}...`);
                loadBlockchainRecords();
            }
        });
    }, []);

    const handleDisconnectWallet = () => {
        web3Service.disconnect();
        attendanceBlockchain.clearContract(); // Clear contract singleton too
        web3Service.setManualDisconnect(true); // Persist manual disconnect
        setWalletAddress(null);
        setIsWalletConnected(false);
        addLog('WALLET_DISCONNECTED: Connection closed by user');
    };

    const checkPendingSync = async () => {
        import('./services/offlineService').then(async (m) => {
            const pending = await m.default.getPendingSync();
            setPendingSyncCount(pending.length);
        });
    };

    const syncOfflineRecords = async () => {
        const offlineService = (await import('./services/offlineService')).default;
        const pending = await offlineService.getPendingSync();

        if (pending.length === 0) return;

        addLog(`SYNC_START: Processing ${pending.length} local records`);

        let successCount = 0;
        for (const record of pending) {
            try {
                // Try to save to Supabase
                const result = await attendanceService.saveLog(record);
                if (result.success) {
                    await offlineService.markSynced(record.local_id);
                    successCount++;
                }
            } catch (err) {
                console.error('Failed to sync record:', err);
            }
        }

        setPendingSyncCount(pending.length - successCount);
        addLog(`SYNC_COMPLETE: ${successCount} records uploaded`);
        await loadBlockchainRecords();
    };

    // Initialize app: check for existing session and load IoT nodes
    useEffect(() => {
        // Attempt silent wallet reconnect on first render
        const tryReconnectWallet = async () => {
            if (!web3Service.isMetaMaskInstalled()) return false;

            // SKIP auto-reconnect if user explicitly disconnected
            if (web3Service.isManualDisconnect()) {
                console.log('Skipping auto-reconnect: manual disconnect flag set');
                return false;
            }

            try {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts.length > 0) {
                    const address = await web3Service.connectWallet();
                    setWalletAddress(address);
                    setIsWalletConnected(true);
                    addLog(`WALLET_CONNECTED: ${address.substring(0, 6)}...${address.substring(38)}`);

                    // Start loading records in background (non-blocking)
                    loadBlockchainRecords();
                    return true;
                }
            } catch (e) {
                console.error('Silent wallet reconnect failed:', e);
            }
            return false;
        };

        // Try silent wallet reconnect on app load
        if (!walletReconnectAttempted.current) {
            walletReconnectAttempted.current = true;
            tryReconnectWallet();
        }

        if (screen === 'splash') {
            setTimeout(() => setScreen('auth'), 800);
        }

        // Load IoT nodes from Supabase
        loadIoTNodes();
        loadStudentSubjects();


    }, [screen]);

    // REAL-TIME: Visual Feedback for attendance logs (Glow/Pulse)
    useEffect(() => {
        if (!isWalletConnected || !currentUser) return;

        const attendanceSubscription = supabase
            .channel('attendance_live')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'attendance_logs'
            }, async (payload) => {
                console.log('Realtime update received:', payload);
                addLog(`REALTIME_SYNC: New record for ${payload.new.name || payload.new.uid}`);

                // Trigger Visual Feedback (Glow)
                if (payload.new.subject === 'Student Plaza') setLastScannedNodeId('IOT-01');
                setLastScannedLogId(payload.new.tx_hash);

                // Clear glow and pulse after exactly 5 seconds
                setTimeout(() => {
                    setLastScannedNodeId(null);
                    setLastScannedLogId(null);
                }, 5000);
                // Hot-reload the records without full page refresh
                await loadBlockchainRecords();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(attendanceSubscription);
        };
    }, [isWalletConnected, currentUser]);

    // 📡 UNIFIED HARDWARE LISTENER: Single source of truth for all RFID events
    useEffect(() => {
        const unsubscribe = rfidService.subscribeToScans(async (scan) => {
            // 🛑 PRIORITY CHECK: If a Foreground Task (Kiosk/Hub Scan) is active, mute background
            // We look for specific modal identifiers to ensure we don't double-mark attendance
            const isForegroundActive = 
                document.querySelector('.kiosk-modal') || 
                document.querySelector('.verification-modal') ||
                document.querySelector('[data-scanning-active="true"]') ||
                window.location.hash.includes('kiosk');
                                        
            console.log('[Global RFID] Scan detected. Foreground Active:', !!isForegroundActive);
            if (isForegroundActive) {
                console.log('[Global RFID] Foreground task in progress. Background listener muted.');
                return;
            }

            console.log('[Global RFID] Processing Background Gate Scan:', scan.uid);

            // 1. Find the student (Case-insensitive match with field fallbacks)
            const student = users.find(u => {
                const storedUid = (u.rfid_uid || u.rfid_tag || u.rfid_id || '').toUpperCase().trim();
                const scanUid = (scan.uid || '').toUpperCase().trim();
                return storedUid === scanUid && scanUid !== '';
            });

            if (!student) {
                console.warn('[Global RFID] Unknown tag:', scan.uid);
                return;
            }

            // 2. Find the location/node
            const node = iotNodes.find(n => n.id === scan.node_id);
            const locationName = node?.location || 'Campus Location';

            // 3. Check for Dual Verification Requirement
            if (locationName !== 'Student Plaza') {
                console.log(`[Global RFID] Hub scan detected at ${locationName}. Requiring Face scan.`);
                setPendingHubScan({
                    uid: student.uid,
                    nodeId: scan.node_id,
                    location: locationName,
                    timestamp: Date.now()
                });

                // Auto-expire after 2 minutes
                setTimeout(() => setPendingHubScan(null), 120000);
                return;
            }

            // 4. Auto-mark GATE attendance
            console.log(`[Global RFID] Auto-marking GATE attendance for ${student.name}`);

            await markAttendance('RFID', {
                customUid: student.uid,
                customName: student.name,
                dept: student.dept || '--',
                name: locationName,
                nodeId: scan.node_id
            });
        });

        return () => unsubscribe();
    }, [users, iotNodes]);
 // Re-run if users or nodes change to ensure matching works


    const addLog = (msg) => setSystemLogs(prev => [{ id: Date.now(), msg, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 15));

    // Load IoT nodes from Supabase
    const loadIoTNodes = async () => {
        if (!navigator.onLine) return; // Skip if offline

        const result = await iotService.getIoTNodes();
        if (result.success && result.nodes.length > 0) {
            setIotNodes(result.nodes);
        } else {
            // Initialize default nodes if empty
            await iotService.initializeDefaultNodes();
            const retry = await iotService.getIoTNodes();
            if (retry.success) {
                setIotNodes(retry.nodes);
            }
        }
    };

    // Load Subjects and Schedules from Supabase
    const loadStudentSubjects = async () => {
        if (!navigator.onLine) {
            const cached = localStorage.getItem('cachedStudentSubjects');
            if (cached) setStudentSubjects(JSON.parse(cached));
            return;
        }

        try {
            const { data, error } = await supabase
                .from('schedules')
                .select(`
                    id,
                    day_of_week,
                    start_time,
                    subject_code,
                    teacher_uid,
                    subjects ( name, credits, color )
                `);

            if (error) throw error;
            if (data) {
                const teacherMap = {
                    'TCH0001': 'T.Charan Teja',
                    'TCH0002': 'G.V.Trivendra Reddy',
                    'TCH0003': 'K.Nanda Kishore Reddy',
                };

                const formatted = [];
                const seenKeys = new Set();

                // Sort to keep entries with defined teachers first, prioritizing them during deduplication
                const sortedData = [...data].sort((a, b) => {
                    const aHasTeacher = a.teacher_uid && a.teacher_uid !== 'Unknown' ? 1 : 0;
                    const bHasTeacher = b.teacher_uid && b.teacher_uid !== 'Unknown' ? 1 : 0;
                    return bHasTeacher - aHasTeacher;
                });

                sortedData.forEach(row => {
                    const timeStr = row.start_time || '';
                    const hasAmPm = timeStr.toLowerCase().includes('am') || timeStr.toLowerCase().includes('pm');
                    const isPM = timeStr.toLowerCase().includes('pm');

                    const timePart = timeStr.replace(/am|pm/ig, '').trim();
                    const parts = timePart.split(':');
                    let hours = parseInt(parts[0], 10) || 0;
                    let minutes = parts[1] ? parseInt(parts[1], 10) : 0;

                    if (hasAmPm) {
                        if (isPM && hours < 12) hours += 12;
                        if (!isPM && hours === 12) hours = 0;
                    }

                    const hr24 = hours.toString().padStart(2, '0');
                    const minStr = minutes.toString().padStart(2, '0');
                    const time24 = `${hr24}:${minStr}`;

                    const ampm = hours >= 12 ? 'PM' : 'AM';
                    let h12 = hours % 12;
                    if (h12 === 0) h12 = 12;
                    const time12 = `${h12}:${minStr} ${ampm}`;

                    const resolvedName = row.subjects?.name || row.subject_code;

                    // Deduplicate identical schedules (same subject name, same day, same normalized time)
                    // This handles mistyped subject codes like SCSBOB1661 vs SCSB081661 by looking at their shared name
                    const dKey = `${resolvedName.toUpperCase()}-${row.day_of_week}-${time24}`;
                    if (!seenKeys.has(dKey)) {
                        seenKeys.add(dKey);
                        formatted.push({
                            id: row.id,
                            code: row.subject_code,
                            name: resolvedName,
                            teacher: row.subjects?.teacher || teacherMap[row.teacher_uid] || row.teacher_uid || 'Unknown',
                            time: time12,
                            time24: time24,
                            day: row.day_of_week,
                            color: row.subjects?.color || '#00e5ff',
                            credits: row.subjects?.credits || 3
                        });
                    }
                });

                // Sort classes by their 24h start time inherently
                formatted.sort((a, b) => a.time24.localeCompare(b.time24));

                setStudentSubjects(formatted);
                localStorage.setItem('cachedStudentSubjects', JSON.stringify(formatted));
            }
        } catch (err) {
            console.error('Failed to load student subjects:', err);
            const cached = localStorage.getItem('cachedStudentSubjects');
            if (cached) setStudentSubjects(JSON.parse(cached));
        }
    };

    // Handle login with Supabase
    const handleLogin = async (uid, password, role) => {
        const result = await authService.login(uid, password, role);
        if (result.success) {
            setCurrentUser(result.user);
            setScreen('dashboard');

            const loginType = result.offline ? 'OFFLINE_LOGIN' : 'USER_LOGIN';
            addLog(`${loginType}: ${result.user.uid} (${result.user.role})`);

            // Reload blockchain records on every login so past data is visible
            // Only if online or if we haven't loaded them yet
            if (isWalletConnected) {
                await loadBlockchainRecords();
            }
            return { success: true };
        } else {
            return { success: false, error: result.error };
        }
    };

    // Handle signup with Supabase
    const handleSignup = async (userData) => {
        const result = await authService.signup(userData);
        if (result.success) {
            addLog(`NEW_USER_REGISTRY: ${result.uid} (${userData.role})`);
            alert(`Account Created! Your ID is: ${result.uid}`);
            return { success: true, uid: result.uid };
        } else {
            alert(`Signup failed: ${result.error}`);
            return { success: false, error: result.error };
        }
    };

    // Handle logout
    const handleLogout = async () => {
        await authService.logout();
        setCurrentUser(null);
        setScreen('auth'); // Return to Role Selection / Login screen
        addLog('USER_LOGOUT: Session ended.');
    };

    // Connect MetaMask Wallet (called from gate screen or topbar)
    const connectWallet = async () => {
        try {
            // If we are connecting manually, we don't want to force account selection every time
            // unless we specifically need it. Setting to false for stability.
            const address = await web3Service.connectWallet(false);
            setWalletAddress(address);
            setIsWalletConnected(true);
            addLog(`WALLET_CONNECTED: ${address.substring(0, 6)}...${address.substring(38)}`);

            // Start loading records in background (non-blocking)
            loadBlockchainRecords();

            // Move to splash screen if we were on the gate screen
            if (screen === 'auth' && !currentUser) {
                setScreen('splash');
            }
        } catch (error) {
            console.error('Wallet connection error:', error);
            // Don't alert if user rejected request
            if (error.code !== 4001) {
                alert('Failed to connect wallet: ' + error.message);
            }
        }
    };

    // NEW: Load logs instantly from Supabase
    const loadSupabaseLogs = async () => {
        try {
            const { success, logs } = await attendanceService.getAllLogs();
            if (success) {
                setSupabaseLogs(logs);
                // Pre-warm the blockchain chain state with these logs so UI works instantly
                setBlockchain(prev => {
                    const updated = new Blockchain();
                    updated.chain = [prev.chain[0], ...logs.map((log, idx) => ({
                        index: logs.length - idx,
                        timestamp: new Date(log.timestamp).getTime(),
                        data: { ...log, subjectCode: log.subject_code, txHash: log.tx_hash },
                        hash: log.tx_hash || '0x...'
                    }))];
                    return updated;
                });
            }
        } catch (err) {
            console.error('Supabase load failed:', err);
        }
    };

    // Load attendance records from blockchain and enrich with user metadata
    const loadBlockchainRecords = async () => {
        try {
            let records = [];

            // 1. Fetch raw records (Blockchain if online, Cache if offline)
            if (navigator.onLine) {
                try {
                    records = await attendanceBlockchain.getAllRecords();
                    // Update cache for offline use
                    localStorage.setItem('cachedBlockchainRecords', JSON.stringify(records));
                } catch (blockchainError) {
                    console.error('Blockchain fetch failed, falling back to cache:', blockchainError);
                    const cached = localStorage.getItem('cachedBlockchainRecords');
                    records = cached ? JSON.parse(cached) : [];
                }
            } else {
                addLog('OFFLINE_MODE: Loading records from local cache');
                const cached = localStorage.getItem('cachedBlockchainRecords');
                records = cached ? JSON.parse(cached) : [];
            }

            // 2. Fetch metadata from Supabase (Only if online)
            let logsArray = [];
            let studentMap = {};

            if (navigator.onLine) {
                const { success: logsOk, logs } = await attendanceService.getAllLogs();
                logsArray = logsOk ? logs : [];
                // Update Supabase logs cache
                localStorage.setItem('cachedSupabaseLogs', JSON.stringify(logsArray));

                const { success: usersOk, users: allUsers } = await userService.getAllUsers();
                if (usersOk) setUsers(allUsers);

                const { success: studentsOk, users: studentProfiles } = await userService.getStudents();
                studentMap = studentsOk ? studentProfiles.reduce((acc, user) => {
                    acc[user.uid] = user;
                    return acc;
                }, {}) : {};
                // Update student map cache
                localStorage.setItem('cachedStudentMap', JSON.stringify(studentMap));
            } else {
                const cachedLogs = localStorage.getItem('cachedSupabaseLogs');
                logsArray = cachedLogs ? JSON.parse(cachedLogs) : [];
                const cachedMap = localStorage.getItem('cachedStudentMap');
                studentMap = cachedMap ? JSON.parse(cachedMap) : {};
            }

            const logMapByHash = logsArray.reduce((acc, log) => {
                if (log.tx_hash) acc[log.tx_hash.toLowerCase()] = log;
                return acc;
            }, {});

            // Fallback map: By UID and Timestamp (rounded to seconds)
            const logMapByTime = logsArray.reduce((acc, log) => {
                const ts = Math.floor(new Date(log.timestamp).getTime() / 1000);
                const key = `${log.uid}_${ts}`;
                acc[key] = log;
                return acc;
            }, {});

            // 4. Collect and Sort all events (Hybrid Mode: Blockchain + Supabase)
            const allEvents = [];

            // Add On-Chain records
            records.forEach((record) => {
                const profile = studentMap[record.uid] || {};
                // Look for matching log by txHash (casing safe)
                const recordTxHash = record.txHash ? record.txHash.toLowerCase() : null;
                const timeKey = `${record.uid}_${record.timestamp}`;
                const metadata = logMapByHash[recordTxHash] || logMapByTime[timeKey] || {};

                allEvents.push({
                    timestamp: typeof record.timestamp === 'number' && record.timestamp < 1e12 ? record.timestamp * 1000 : record.timestamp,
                    data: {
                        uid: record.uid,
                        name: metadata.name || profile.name || record.uid,
                        role: profile.role || 'STUDENT',
                        dept: metadata.dept || profile.dept || '--',
                        subject: metadata.subject || record.location || record.subject || profile.subject || (record.timestamp ? resolveSubjectAtTime(record.timestamp * (record.timestamp < 1e12 ? 1000 : 1), studentSubjects)?.name : null) || '--',
                        subjectCode: metadata.subject_code || (record.location === 'Student Plaza' ? 'GATE' : (record.location && record.location !== '--' ? record.location.substring(0, 3).toUpperCase() : null)) || record.subjectCode || (record.timestamp ? resolveSubjectAtTime(record.timestamp * (record.timestamp < 1e12 ? 1000 : 1), studentSubjects)?.code : null) || null,
                        teacher: metadata.teacher || record.teacher || null,
                        method: record.method || metadata.method || 'BLOCKCHAIN',
                        status: 'PRESENT',
                        txHash: record.txHash || metadata.tx_hash || null
                    }
                });
            });

            // Add Off-Chain IoT / RFID records not yet on on-chain
            // 5. Deduplicate records for Loop #2 (Off-Chain loop)
            // Fix: Include records from Supabase even if they don't have a tx_hash (Off-chain records)
            const processedTxHashes = new Set(allEvents.map(e => e.data.txHash ? e.data.txHash.toLowerCase() : null).filter(h => h));
            logsArray.filter(log => {
                const txHash = log.tx_hash ? log.tx_hash.toLowerCase() : null;
                return !txHash || !processedTxHashes.has(txHash);
            }).forEach((log) => {
                const profile = studentMap[log.uid] || {};

                // Ensure we have a valid numeric timestamp for sorting
                let logTime = new Date(log.timestamp).getTime();
                if (isNaN(logTime)) logTime = Date.now();

                allEvents.push({
                    timestamp: logTime,
                    data: {
                        uid: log.uid,
                        name: log.name || profile.name || log.uid,
                        role: profile.role || 'STUDENT',
                        dept: log.dept || profile.dept || '--',
                        subject: log.subject || 'Student Plaza',
                        subjectCode: log.subject_code || null,
                        teacher: log.teacher || null,
                        method: log.method || 'RFID',
                        status: 'PRESENT',
                        txHash: log.tx_hash || null,
                        isOffChain: true
                    }
                });
            });

            // STRICT SORT: Newest to Oldest (DESCENDING)
            allEvents.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

            // 5. Reconstruct Blockchain View (Iterate Newest to Oldest for Indexing)
            const newChain = new Blockchain();
            newChain.chain = [newChain.chain[0]]; // Keep genesis block

            // Reverse for indexing so the oldest gets index 1
            [...allEvents].reverse().forEach((event) => {
                const block = new Block(
                    newChain.chain.length,
                    event.timestamp,
                    event.data,
                    newChain.getLatestBlock().hash
                );
                newChain.addBlock(block);
            });

            // 6. Force Update state by creating a new instance
            const finalizedChain = Object.assign(Object.create(Object.getPrototypeOf(newChain)), newChain);
            finalizedChain.updatedAt = Date.now();
            setBlockchain(finalizedChain);
            addLog(`HYDRATED ${finalizedChain.chain.length - 1} RECORDS (SYNC: ON-CHAIN + HUBS)`);

            // Removed auto-glow on load to prevent old data from glowing unexpectedly
        } catch (error) {
            console.error('Error loading blockchain records:', error);
            addLog(`SYNC ERROR: ${error.message}`);
        }
    };

    // Mark attendance on real blockchain
    const markAttendance = async (method, subjectData = null) => {
        if (!currentUser) return { success: false, error: 'NO_USER' };
        if (!method) {
            console.warn('[markAttendance] No method provided, skipping...');
            return { success: false, error: 'NO_METHOD' };
        }

        // Check if wallet is connected
        if (!isWalletConnected) {
            alert('Please connect your MetaMask wallet first!');
            return;
        }

        const isBulk = !!subjectData?.customUid;
        const targetUid = subjectData?.customUid || currentUser.uid;
        const targetName = subjectData?.customName || currentUser.name;
        const targetRole = isBulk ? 'STUDENT' : currentUser.role;
        const targetSubject = subjectData?.subject || subjectData?.name || (currentUser.subject || '--');
        const lockKey = `${targetUid}-${targetSubject}`;

        if (processingMarks.has(lockKey)) {
            console.warn(`[markAttendance] Already processing ${lockKey}, skipping...`);
            return { success: false, error: 'ALREADY_PROCESSING' };
        }

        try {
            setProcessingMarks(prev => new Set(prev).add(lockKey));
            setTxPending(true);

            // 🛑 DUPLICATE CHECK RE-ENABLED
            const todayStr = new Date().toISOString().split('T')[0];
            const isDuplicate = blockchain.chain.some(b => {
                if (b.index === 0 || !b.timestamp) return false;
                if (b.data.uid !== targetUid) return false;
                
                const recordSubjectCode = (b.data.subjectCode || '').toUpperCase();
                const recordSubjectName = (b.data.subject || '').toUpperCase();
                const matchSubject = (targetSubject || '').toUpperCase();
                
                if (recordSubjectCode !== matchSubject && recordSubjectName !== matchSubject) return false;
                
                const ts = Number(b.timestamp);
                const date = new Date(ts < 1e12 ? ts * 1000 : ts);
                if (isNaN(date.getTime())) return false;
                return date.toISOString().split('T')[0] === todayStr;
            });

            if (isDuplicate) {
                console.warn(`[markAttendance] Duplicate detected for ${targetUid} in ${targetSubject} today.`);
                return { success: false, error: 'ALREADY_MARKED' };
            }

            const logMsg = isBulk
                ? `[KIOSK] RECORDING: ${targetName} (${targetUid}) via ${method}`
                : `SUBMITTING ATTENDANCE: ${targetUid} via ${method}`;
            addLog(logMsg);

            // 🔗 INITIATE BLOCKCHAIN TRANSACTION (Triggers MetaMask)
            addLog(`[WALLET] 🦊 Submitting to Blockchain for ${targetName} | Loc: ${targetSubject}`);
            const result = await attendanceBlockchain.markAttendance(targetUid, method, targetSubject);
            
            // At this point, the user has clicked "Confirm" in MetaMask
            setTxPending(false);
            const txHash = result.hash || result.txHash;
            setLastTxHash(txHash);

            // Prepare record metadata for persistence
            const recordData = {
                uid: targetUid,
                name: targetName,
                role: targetRole,
                dept: subjectData?.dept || currentUser.dept || '--',
                subject: subjectData?.subject || subjectData?.name || (currentUser.subject || '--'),
                subjectCode: subjectData?.subjectCode || subjectData?.code || null,
                teacher: subjectData?.teacher || (currentUser.role === 'TEACHER' ? currentUser.name : null),
                method,
                timestamp: getCurrentTimestamp(),
                txHash: txHash
            };

            // ⚡ STAGE 1 (INSTANT): Save to Supabase
            // We return success immediately after this step!
            const logStatus = await attendanceService.saveLog(recordData);

            if (logStatus.success) {
                setLastScannedLogId(txHash);
                if (subjectData?.nodeId) setLastScannedNodeId(subjectData.nodeId);
                addLog(`✅ SUCCESS: Recorded instantly in database`);
            }

            // 🔗 STAGE 2 (BACKGROUND): Blockchain wait
            // We start the background confirmation loop without blocking the user
            (async () => {
                try {
                    await result.wait(); // Background wait (up to 90s)
                    addLog(`🔗 ON_CHAIN: ${targetName} confirmed on blockchain ledger`);
                    loadBlockchainRecords();
                } catch (err) {
                    console.error('Blockchain confirm failed:', err);
                    addLog(`⚠ CHAIN_FAIL: ${targetName} ledger sync pending`);
                }
            })();

            // Clear glow/node highlight after 5s
            setTimeout(() => {
                setLastScannedLogId(null);
                setLastScannedNodeId(null);
            }, 5000);

            // 📱 STAGE 3 (ASYNCHRONOUS): Notifications
            (async () => {
                try {
                    // Check if phone was passed in arguments, otherwise fallback to static users
                    const notifyUser = { uid: targetUid, name: targetName, phone: arguments[1]?.phone || users.find(u => u.uid === targetUid)?.phone };
                    if (notifyUser.phone) {
                        notificationService.sendAttendanceAlert(notifyUser, recordData);
                    }
                } catch (smsErr) {
                    console.warn('[NotificationService] SMS failed:', smsErr);
                }
            })();

            return { success: true, ...recordData, txHash: result.txHash };
        } catch (error) {
            setTxPending(false);
            
            const isRejected = error.code === 'ACTION_REJECTED' || error.code === 4001 || error.message?.includes('rejected');
            
            if (isRejected) {
                console.warn('[Wallet] Transaction cancelled by user');
                addLog('⚠ CANCELLED: Wallet transaction rejected');
                return { success: false, error: 'USER_REJECTED' };
            }

            console.error('CRITICAL: Error marking attendance:', error);
            const errorMsg = error.reason || error.message || (typeof error === 'string' ? error : 'Unknown transaction error');
            if (!isBulk) alert('Failed to mark attendance: ' + errorMsg);
            addLog(`ERROR_TRACE: ${errorMsg}`);

            return { success: false, error: errorMsg };
        } finally {
            setProcessingMarks(prev => {
                const next = new Set(prev);
                next.delete(lockKey);
                return next;
            });
        }
    };
    
    // Mark attendance for MULTIPLE students in ONE blockchain transaction
    const markAttendanceBatch = async (students, subjectData = null) => {
        if (!students || students.length === 0) return { success: false, error: 'NO_STUDENTS' };
        if (!isWalletConnected) {
            alert('Please connect your MetaMask wallet first!');
            return { success: false, error: 'NO_WALLET' };
        }

        try {
            setTxPending(true);
            const targetSubject = subjectData?.subject || subjectData?.name || 'Classroom Hub';
            addLog(`[BATCH] 🦊 Requesting Single Confirmation for ${students.length} students...`);

            const uids = students.map(s => s.uid);
            const methods = students.map(() => 'FACE_RFID');

            // 🔗 THE SINGLE TRANSACTION (MetaMask)
            // One popup, one fee, all students.
            const result = await attendanceBlockchain.markAttendanceBatch(uids, methods, targetSubject);
            
            setTxPending(false);
            const txHash = result.hash || result.txHash;
            setLastTxHash(txHash);

            // ⚡ STAGE 1: Save individual logs to Supabase
            // We do this AFTER the signature is confirmed in MetaMask
            for (const student of students) {
                const recordData = {
                    uid: student.uid,
                    name: student.name,
                    role: 'STUDENT',
                    dept: student.dept || subjectData?.dept || '--',
                    subject: targetSubject,
                    subjectCode: subjectData?.subjectCode || subjectData?.code || null,
                    teacher: subjectData?.teacher || (currentUser.role === 'TEACHER' ? currentUser.name : null),
                    method: 'FACE_RFID',
                    timestamp: getCurrentTimestamp(),
                    txHash: txHash
                };
                
                // Save to database instantly
                await attendanceService.saveLog(recordData);
                
                // 📱 Trigger notifications (Asynchronous)
                (async () => {
                    try {
                        // The 'student' object passed from Kiosk already contains the full profile from Supabase
                        if (student?.phone) {
                            notificationService.sendAttendanceAlert(student, recordData);
                        }
                    } catch (smsErr) { console.warn('[SMS] Failed for ' + student.uid); }
                })();
            }

            addLog(`[BATCH] ✅ SUCCESS: ${students.length} records confirmed on blockchain`);
            loadBlockchainRecords();
            
            return { success: true, txHash };
        } catch (error) {
            setTxPending(false);
            const isRejected = error.code === 'ACTION_REJECTED' || error.code === 4001 || error.message?.includes('rejected');
            
            if (isRejected) {
                addLog('⚠ CANCELLED: Batch transaction rejected');
                return { success: false, error: 'USER_REJECTED' };
            }

            console.error('CRITICAL: Batch failed:', error);
            const errorMsg = error.reason || error.message || 'Unknown batch error';
            addLog(`BATCH_ERROR: ${errorMsg}`);
            return { success: false, error: errorMsg };
        } finally {
            setTxPending(false);
        }
    };

    // Global refresh: Load blockchain records and IoT nodes in sync
    const handleGlobalRefresh = async () => {
        addLog('GLOBAL_SYNC_START: Refreshing All Data...');
        try {
            await Promise.all([
                loadBlockchainRecords(),
                loadIoTNodes(),
                loadStudentSubjects()
            ]);
            addLog('GLOBAL_SYNC_COMPLETE: Dashboard Hydrated');
        } catch (error) {
            console.error('Global refresh error:', error);
            addLog(`SYNC_ERROR: ${error.message}`);
        }
    };

    // Screen Routing (skip walletGate — go straight to auth)
    const renderScreen = () => {
        if (screen === 'splash') return <SplashScreen />;
        if (screen === 'auth') return <AuthScreen users={users} onLogin={handleLogin} onSignup={handleSignup} />;

        return (
            <DashboardController
                theme={theme}
                toggleTheme={toggleTheme}
                user={currentUser}
                blockchain={blockchain}
                iotNodes={iotNodes}
                studentSubjects={studentSubjects}
                systemLogs={systemLogs}
                attendanceLogs={blockchain.chain.filter(b => b.index > 0).map(b => ({ ...(typeof b.data === 'object' ? b.data : { msg: b.data }), timestamp: b.timestamp }))}
                recentlyScannedUids={recentlyScannedUids}
                walletAddress={walletAddress}
                isWalletConnected={isWalletConnected}
                txPending={txPending}
                isOnline={isOnline}
                pendingSyncCount={pendingSyncCount}
                lastScannedNodeId={lastScannedNodeId}
                lastScannedLogId={lastScannedLogId}
                pendingHubScan={pendingHubScan}
                onLogout={handleLogout}
                onMarkAttendance={markAttendance}
                onMarkAttendanceBatch={markAttendanceBatch}
                onRefresh={handleGlobalRefresh}
                onConnectWallet={connectWallet}
                onDisconnectWallet={handleDisconnectWallet}
            />
        );
    };

    return (
        <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}>
            <GlobalStyles />
            {/* Global Background Image - High Clarity Implementation */}
            <img
                src="/campus-bg.png"
                alt="Background"
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    zIndex: -1,
                    pointerEvents: 'none'
                }}
                fetchpriority="high"
                decoding="sync"
            />
            {renderScreen()}
        </div>
    );
}

// ==========================================
// 6. DASHBOARDS
// ==========================================

function DashboardController(props) {
    const { user, onLogout, systemLogs, attendanceLogs, recentlyScannedUids } = props;

    if (!user) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--primary)' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '40px', height: '40px', border: '3px solid var(--primary)', borderTop: '3px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }} />
                    <div className="font-heading">INITIALIZING SECURE SESSION...</div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', paddingBottom: '40px' }}>
            <GlobalStyles />

            {/* Topbar */}
            <div style={{
                height: '64px', borderBottom: '1px solid var(--border)', background: 'rgba(15, 23, 42, 0.4)',
                display: 'flex', alignItems: 'center', padding: '0 24px', justifyContent: 'space-between',
                position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(12px)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(59,130,246,0.3)' }}>
                        <span style={{ fontSize: '1rem', filter: 'brightness(2)' }}>🔗</span>
                    </div>
                    <div>
                        <span style={{ color: 'var(--text-main)', fontSize: '1.25rem', display: 'block', fontWeight: 700, letterSpacing: '-0.5px' }}>Smart Attendance</span>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Network Status */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '8px', background: props.isOnline ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }}>
                        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: props.isOnline ? 'var(--green)' : 'var(--red)' }}></div>
                        <span className="font-code" style={{ fontSize: '0.7rem', color: props.isOnline ? 'var(--green)' : 'var(--red)' }}>
                            {props.isOnline ? 'Online' : 'Offline'}
                        </span>
                    </div>

                    {props.pendingSyncCount > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '8px', background: 'rgba(245,158,11,0.1)' }}>
                            <span style={{ animation: 'spin 2s linear infinite', fontSize: '0.75rem' }}>🔄</span>
                            <span className="font-code" style={{ fontSize: '0.7rem', color: 'var(--accent)' }}>
                                {props.pendingSyncCount} Pending
                            </span>
                        </div>
                    )}

                    {/* Wallet Badge or Connect Button */}
                    {props.walletAddress ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'rgba(16,185,129,0.1)', borderRadius: '8px' }}>
                            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--green)', animation: 'pulse 2s infinite' }}></span>
                            <span className="font-code" style={{ fontSize: '0.78rem', color: 'var(--green)' }}>
                                🦊 {props.walletAddress?.substring(0, 6)}...{props.walletAddress?.substring(38)}
                            </span>
                            <button
                                onClick={props.onDisconnectWallet}
                                style={{
                                    background: 'none', border: 'none', color: 'var(--red)',
                                    cursor: 'pointer', fontSize: '1rem', padding: '0 0 0 8px',
                                    display: 'flex', alignItems: 'center', opacity: 0.7
                                }}
                                title="Disconnect Wallet"
                                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                                onMouseLeave={e => e.currentTarget.style.opacity = 0.7}
                            >
                                ✕
                            </button>
                        </div>
                    ) : (
                        <button onClick={props.onConnectWallet} className="btn-cyber" style={{ padding: '6px 14px', fontSize: '0.78rem' }}>
                            🦊 Connect Wallet
                        </button>
                    )}

                    <button onClick={props.toggleTheme} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', padding: '6px 10px', transition: 'all 0.2s', display: 'flex', alignItems: 'center' }} title="Toggle Theme">
                        {props.theme === 'light' ? '🌙' : '☀️'}
                    </button>
                    <div style={{ textAlign: 'right', marginLeft: '4px' }}>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 600 }}>{user.name}</div>
                        <Badge type={user.role === 'ADMIN' ? 'red' : user.role === 'TEACHER' ? 'gold' : 'indigo'}>{user.role}</Badge>
                    </div>
                    <button onClick={onLogout} className="btn-cyber" style={{ borderColor: 'var(--red)', color: 'var(--red)', padding: '6px 14px', fontSize: '0.78rem' }}>Logout</button>
                </div>
            </div>

            <div style={{ padding: '30px', maxWidth: '1600px', margin: '0 auto' }}>
                {user.role === 'STUDENT' && <StudentDashboard
                    {...props}
                    lastScannedLogId={props.lastScannedLogId}
                />}
                {user.role === 'TEACHER' && <TeacherDashboard
                    {...props}
                    lastScannedLogId={props.lastScannedLogId}
                    logs={props.attendanceLogs}
                />}
                {user.role === 'ADMIN' && <AdminDashboard
                    {...props}
                    lastScannedNodeId={props.lastScannedNodeId}
                    lastScannedLogId={props.lastScannedLogId}
                    logs={props.attendanceLogs}
                    onRefresh={props.onRefresh}
                    onMarkAttendance={props.onMarkAttendance}
                />}
            </div>

            {/* 🦊 METAMASK PENDING OVERLAY */}
            {props.txPending && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
                    zIndex: 9999, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', pointerEvents: 'all'
                }}>
                    <div style={{
                        background: 'var(--card)', padding: '40px', borderRadius: '20px',
                        border: '2px solid var(--primary)', textAlign: 'center',
                        boxShadow: '0 0 50px rgba(0,229,255,0.3)', maxWidth: '450px'
                    }}>
                        <div style={{ fontSize: '4rem', marginBottom: '20px', animation: 'pulse 2s infinite' }}>🦊</div>
                        <h2 className="font-heading" style={{ color: 'var(--white)', marginBottom: '15px' }}>PLEASE CONFIRM IN WALLET</h2>
                        <p className="font-code" style={{ color: 'var(--primary)', fontSize: '0.9rem', marginBottom: '25px' }}>
                            We are waiting for you to sign the gas fee transaction in your MetaMask popup.
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', justifyContent: 'center' }}>
                           <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '3px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }}></div>
                           <span className="font-code" style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Awaiting signature...</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
