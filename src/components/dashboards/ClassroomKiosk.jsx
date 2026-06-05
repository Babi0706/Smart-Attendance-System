import React, { useState, useEffect, useRef } from 'react';
import GlobalStyles from '../ui/GlobalStyles';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { supabase } from '../../config/supabase';
import faceService from '../../services/faceService';
import rfidService from '../../services/rfidService';
import attendanceService from '../../services/attendanceService';
import attendanceBlockchain from '../../services/attendanceBlockchain';
import { parseTime, resolveSubjectAtTime, getCurrentTimestamp } from '../../utils/constants';
export default // ==========================================
    // CLASSROOM KIOSK (BULK SCANNER)
    // ==========================================
    function ClassroomKiosk({ onClose, onRefresh, classStudents, allUsers = [], allRoles = [], subjectData, teacherName, logs = [], blockchain = { chain: [] }, onMarkAttendance, onMarkAttendanceBatch, recentlyScannedUids, iotNodes = [] }) {
        const isTestMode = false; // 🛠️ [TEST_MODE] Set to true to bypass duplicate checks and allow re-scanning for verification
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [status, setStatus] = useState('READY'); // READY, IDENTIFYING, RFID, QUEUED, COMMITTING, SUCCESS, ERROR
    const [pendingFaceDescriptor, setPendingFaceDescriptor] = useState(null);
    const [matchingStudent, setMatchingStudent] = useState(null);
    const [similarity, setSimilarity] = useState(0);
    const [capturedPhoto, setCapturedPhoto] = useState(null);
    const [rfidScanning, setRfidScanning] = useState(false);
    const [modelsReady, setModelsReady] = useState(faceService.isReady());
    const [lastScanTime, setLastScanTime] = useState(0);
    const [pendingScans, setPendingScans] = useState([]); // List of students to be committed
    const [isFaceDetected, setIsFaceDetected] = useState(false);
    const [isNear, setIsNear] = useState(false);
    const [commitProgress, setCommitProgress] = useState({ current: 0, total: 0 });
    const [sessionProcessedUids, setSessionProcessedUids] = useState(new Set()); // Tracks successfully committed UIDs
    const [lastMatchDistance, setLastMatchDistance] = useState(null); // Debug info
    const [proximityStatus, setProximityStatus] = useState('READY'); // READY, TOO_FAR, TOO_CLOSE, NOT_CENTERED
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [activeNodeId, setActiveNodeId] = useState(null);
    const [hudError, setHudError] = useState(null); // Silent, non-blocking error overlay
    const [hudSuccess, setHudSuccess] = useState(null); // Silent success overlay

    const sessionMarkedUids = new Set(pendingScans.map(s => s.uid));

    const handleRefresh = async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        if (onRefresh) await onRefresh();
        setIsRefreshing(false);
    };

    const isGateEntryMarked = (studentUid) => {
        const now = new Date();
        const isToday = (ts) => {
            const date = ts < 1e12 ? new Date(ts * 1000) : new Date(ts);
            return date.toDateString() === now.toDateString();
        };

        // Check logs for 'Student Plaza'
        const hasLog = (logs || []).some(l => 
            l.uid === studentUid && 
            (l.subject === 'Student Plaza' || l.location === 'Student Plaza' || l.name === 'Student Plaza') &&
            isToday(l.timestamp)
        );

        // Check blockchain for 'Student Plaza'
        const hasBlock = (blockchain?.chain || []).some(b => 
            b.index > 0 &&
            b.data?.uid === studentUid &&
            (b.data?.subject === 'Student Plaza' || b.data?.location === 'Student Plaza' || b.data?.name === 'Student Plaza') &&
            isToday(b.timestamp)
        );

        return hasLog || hasBlock;
    };

    const hasScannedToday = (studentUid, studentName, excludeLocal = false) => {
        if (isTestMode) return false;
        if (!studentUid) return false;

        // 1. Check Global Throttle (App.jsx Level)
        const throttleKey = `${studentUid}-${studentName}`;
        const lastScanTime = recentlyScannedUids?.get?.(throttleKey) || recentlyScannedUids?.get?.(studentUid);
        if (lastScanTime && (Date.now() - lastScanTime < 60000)) return true;

        if (!excludeLocal) {
            // 2. Check Session Local Memory (Queued in current batch)
            if (sessionProcessedUids.has(studentUid)) return true; // Keep UID simple for session local
            if (pendingScans.some(s => s.uid === studentUid)) return true;
        }

        // 3. Check Persistence (Supabase Logs / Blockchain Sync)
        const now = new Date();
        const isToday = (ts) => {
            const date = ts < 1e12 ? new Date(ts * 1000) : new Date(ts);
            return date.toDateString() === now.toDateString();
        };

        const currentSubjectName = (subjectData?.subject || subjectData?.name || '').trim();

        // Check Supabase logs FOR THIS SUBJECT ONLY
        const todayLogs = (logs || []).filter(l =>
            l.uid === studentUid &&
            l.subject === currentSubjectName &&
            isToday(l.timestamp)
        );

        // 3. Check Blockchain blocks FOR THIS SUBJECT ONLY
        const todayBlocks = (blockchain?.chain || []).filter(b =>
            b.index > 0 &&
            b.data?.uid === studentUid &&
            b.data?.subject === currentSubjectName &&
            isToday(b.timestamp)
        );

        return todayLogs.length > 0 || todayBlocks.length > 0;
    };

    // Initial load
    useEffect(() => {
        faceService.loadModels().then(() => {
            setModelsReady(true);
            startCamera();
        });
        return () => {
            stopCamera();
            if (rfidService.unsubscribe) rfidService.unsubscribe();
        };
    }, []);

    // Auto-reset Kiosk for next student after queuing
    useEffect(() => {
        if (status === 'QUEUED') {
            const timer = setTimeout(() => {
                setMatchingStudent(null);
                setPendingFaceDescriptor(null);
                setStatus('READY');
                setIsFaceDetected(false);
                setLastScanTime(Date.now());
                setHudError(null);
                setHudSuccess(null);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [status]);

    const showHUDError = (msg) => {
        setHudError(msg);
        setStatus('READY');
        setIsFaceDetected(false);
        // Add a 3-second penalty/cooldown so the person can walk away
        setLastScanTime(Date.now() + 3000);
        setTimeout(() => setHudError(null), 3000);
    };

    // Identification Loop
    useEffect(() => {
        let interval;
        if (modelsReady && status === 'READY') {
            interval = setInterval(async () => {
                const video = videoRef.current;
                if (!video || video.paused || video.ended || video.readyState < 2) return;
                
                // Cooldown check
                if (Date.now() - lastScanTime < 1500) return;

                const result = await faceService.detectLiveness(video);
                if (result.face) {
                    setIsFaceDetected(true);

                    // Proximity & Centering logic
                    const faceWidth = result.box?.width || 0;
                    const faceCenterX = result.box.x + result.box.width / 2;
                    const videoCenterX = video.videoWidth / 2;
                    
                    const isCentered = Math.abs(faceCenterX - videoCenterX) < (video.videoWidth * 0.15);
                    const isTooFar = faceWidth < 140;
                    const isTooClose = faceWidth > 280;

                    if (!isCentered) {
                        setProximityStatus('NOT_CENTERED');
                        setIsNear(false);
                    } else if (isTooFar) {
                        setProximityStatus('TOO_FAR');
                        setIsNear(false);
                    } else if (isTooClose) {
                        setProximityStatus('TOO_CLOSE');
                        setIsNear(false);
                    } else {
                        setProximityStatus('READY');
                        setIsNear(true);
                        identifyStudent(video);
                        clearInterval(interval);
                    }
                } else {
                    setIsFaceDetected(false);
                    setIsNear(false);
                    setProximityStatus('READY');
                }
            }, 500);
        }
        return () => clearInterval(interval);
    }, [modelsReady, status, lastScanTime]);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (err) { alert("Camera failed!"); onClose(); }
    };

    const stopCamera = () => {
        const stream = videoRef.current?.srcObject;
        if (stream) stream.getTracks().forEach(t => t.stop());
    };

    /**
     * STAGE 1: Captured Live Face
     * We don't "guess" the name here. We just capture the descriptor and wait for RFID.
     */
    const identifyStudent = async (video) => {
        setStatus('IDENTIFYING');
        try {
            const dataUrl = captureToDataUrl(video);
            const liveDescriptor = await faceService.getDescriptorFromDataUrl(dataUrl);

            if (!liveDescriptor) {
                console.warn('[Kiosk] Could not get face descriptor');
                setStatus('READY');
                setIsFaceDetected(false);
                setIsNear(false);
                return;
            }

            // Successfully captured live face. Store it and wait for RFID Identifier.
            console.log('[Kiosk] Face captured. Waiting for RFID identification.');
            setCapturedPhoto(dataUrl);
            setPendingFaceDescriptor(liveDescriptor);
            setStatus('RFID');

            // 🔍 PROACTIVE 1-to-N Identification (Side-by-Side Comparison)
            // This allows the "Comparing" UI to show up BEFORE the RFID tap
            const searchList = (classStudents && classStudents.length > 0) ? classStudents : (allUsers || []);
            let bestMatch = null;
            let minDistance = 0.45; // Match threshold

            searchList.forEach(student => {
                if (!student.face_descriptor) return;
                const storedDesc = typeof student.face_descriptor === 'string' 
                    ? JSON.parse(student.face_descriptor) 
                    : student.face_descriptor;
                
                const distance = faceService.compareFaces(storedDesc, liveDescriptor);
                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatch = student;
                }
            });

            if (bestMatch) {
                const simValue = Math.round((1 - minDistance) * 100);
                console.log(`[Kiosk] Proactive Match: ${bestMatch.name} (${simValue}%)`);
                setSimilarity(simValue);
                setMatchingStudent(bestMatch);
            }
            
            // 🔍 SMART NODE DISCOVERY
            // Check if there's a specific IoT node assigned to this classroom/subject
            const locName = (subjectData?.name || subjectData?.subject || '').toUpperCase().trim();
            const matchingNode = iotNodes?.find(n => (n.location || '').toUpperCase().trim() === locName);
            const nodeId = matchingNode?.id || subjectData?.id || 'IOT-01';
            setActiveNodeId(nodeId);

            console.log(`[Kiosk] Waking up hardware: ${nodeId} at ${locName}`);
            rfidService.triggerScan(nodeId);
            
            startRFIDListener(liveDescriptor);
        } catch (err) {
            console.error('[Kiosk] Face capture error:', err);
            setStatus('READY');
            setIsFaceDetected(false);
            setIsNear(false);
        }
    };

    const captureToDataUrl = (video) => {
        const canvas = canvasRef.current;
        canvas.width = 400; canvas.height = 400;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, 400, 400);
        return canvas.toDataURL('image/jpeg', 0.8);
    };

    /**
     * STAGE 2: RFID Identification + Biometric Verification (1-to-1)
     */
    const startRFIDListener = (liveDescriptor) => {
        setRfidScanning(true);
        setStatus('TAP RFID CARD');
        const unsubscribe = rfidService.subscribeToScans(async (scan) => {
            // 🛑 PRIORITY CHECK: If a BiometricVerification modal is open on top of the Kiosk dashboard,
            // we must mute the Kiosk's internal listener to prevent double-processing and mismatch alerts.
            if (document.querySelector('.verification-modal')) {
                console.log('[Kiosk] Verification modal active. Muting background scan.');
                return;
            }

            console.log('[Kiosk] Hardware scan detected:', scan.uid);
            
            // Find the student (Priority: Current Class List -> All Registered Users)
            // 🛡️ MULTI-FIELD MATCHING: Check rfid_tag, rfid_uid, AND rfid_id
            const matchesUid = (u, scanUid) => {
                const fields = [u.rfid_tag, u.rfid_uid, u.rfid_id, u.rfid_id_card, u.rfid_number, u.card_id];
                return fields.some(f => (f || '').toUpperCase().trim() === scanUid.toUpperCase().trim() && (f || '').trim() !== '');
            };

            let student = classStudents.find(s => matchesUid(s, scan.uid));

            // 🔍 GLOBAL FALLBACK: If not in class list, check all users (Prevents 'Unknown' for Gate mode)
            if (!student && allUsers) {
                console.log('[Kiosk] Student not in current class list. Searching all users...');
                student = allUsers.find(u => matchesUid(u, scan.uid));
            }

            if (!student) {
                unsubscribe();
                showHUDError("🚫 UNKNOWN RFID CARD");
                rfidService.sendFeedback('FAIL');
                return;
            }

            // 🛑 PREVENT DOUBLE SCANNING
            if (hasScannedToday(student.uid, student.name)) {
                unsubscribe();
                showHUDError(`⚠️ ALREADY MARKED: ${student.name}`);
                rfidService.sendFeedback('FAIL');
                
                // Reset to try again
                setMatchingStudent(null);
                setPendingFaceDescriptor(null);
                setStatus('READY');
                return;
            }

            // [ENFORCEMENT] Check if student has scanned at the Main Gate first
            // Skip this check if we are CURRENTLY at the Student Plaza (Main Gate)
            const currentLoc = (subjectData?.subject || subjectData?.name || '').trim().toUpperCase();
            const currentCode = (subjectData?.subjectCode || subjectData?.code || '').trim().toUpperCase();
            const isAtMainGate = currentLoc === 'STUDENT PLAZA' || currentCode === 'GATE';
            
            if (!isAtMainGate && !isGateEntryMarked(student.uid)) {
                unsubscribe();
                const denyMsg = `❌ ACCESS DENIED: ${student.name} (No Main Gate Record)`;
                console.warn(denyMsg, { location: currentLoc, code: currentCode });
                showHUDError(`❌ ACCESS DENIED: ${student.name} (MAIN GATE REQUIRED)`);
                rfidService.sendFeedback('FAIL');
                return;
            }

            // 1-to-1 Biometric Check
            if (!student.face_descriptor) {
                unsubscribe();
                showHUDError(`⚠️ NO BIOMETRIC DATA: ${student.name}`);
                rfidService.sendFeedback('FAIL');
                return;
            }

            const storedDesc = typeof student.face_descriptor === 'string' 
                ? JSON.parse(student.face_descriptor) 
                : student.face_descriptor;
            
            const distance = faceService.compareFaces(storedDesc, liveDescriptor);
            const simValue = Math.round((1 - distance) * 100);
            
            console.log(`[Kiosk] 1-to-1 Verification: ${student.name} | Sim: ${simValue}%`);

            // Verify with strict threshold (0.45)
            if (distance < 0.45 || isTestMode) {
                rfidService.sendFeedback('SUCCESS');
                setSimilarity(simValue);
                setMatchingStudent(student);
                // Cleanup listener before moving to queue
                unsubscribe();
                queueAttendance(student);
            } else {
                unsubscribe();
                rfidService.sendFeedback('FAIL');
                showHUDError(`❌ BIOMETRIC MISMATCH: ${student.name} (${simValue}%)`);
                // Reset to try again
                setMatchingStudent(null);
                setPendingFaceDescriptor(null);
                setStatus('READY');
            }
        });
    };


    const queueAttendance = async (student) => {
        rfidService.unsubscribe();
        setRfidScanning(false);
        const timestamp = Date.now();
        console.log(`[Kiosk] Queuing student: ${student.name} (${student.uid})`);

        setPendingScans(prev => {
            const next = [...prev, { ...student, scanTimestamp: timestamp }];
            console.log(`[Kiosk] Current Queue Size: ${next.length}`);
            return next;
        });
        setStatus('QUEUED');
        
        // AUTO-RESTART: After a brief success pulse, reset the scanner for the next student
        setTimeout(() => {
            setMatchingStudent(null);
            setPendingFaceDescriptor(null);
            setCapturedPhoto(null);
            setStatus('READY');
        }, 3000); // Increased to 3s to allow viewing the comparison
    };

    const handleBatchSubmit = async () => {
        if (pendingScans.length === 0) return;

        setStatus('COMMITTING');
        setCommitProgress({ current: 0, total: pendingScans.length });

        try {
            // Filter out students who actually have a record in database/blockchain already
            const actualPending = pendingScans.filter(student => !hasScannedToday(student.uid, student.name, true));

            if (actualPending.length === 0) {
                console.warn('[Kiosk] All students in queue are already marked today.');
                showHUDError("ℹ️ ALL STUDENTS ALREADY MARKED");
                // 🛑 FIXED: Don't clear the queue here, just notify. 
                // This prevents the "disappearing queue" when testing same students.
                return;
            }

            // [UNIFIED BATCH COMMIT]
            // Calls the parent onMarkAttendanceBatch which handles both Blockchain (ONE transaction) and Supabase
            const result = await onMarkAttendanceBatch(actualPending, subjectData);

            if (result.success) {
                // Success feedback
                setHudSuccess(`${actualPending.length} RECORDS CONFIRMED & SMS SENT`);
                setPendingScans([]);
                setTimeout(() => setHudSuccess(null), 3000);
            } else {
                if (result.error !== 'USER_REJECTED') {
                    showHUDError(`FAILED: ${result.error}`);
                }
            }
        } catch (error) {
            console.error('Batch error:', error);
            showHUDError('SYSTEM ERROR DURING COMMIT');
        } finally {
            setStatus('READY');
        }
    };

    return (
        <div className="kiosk-modal" style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 2000, display: 'flex' }}>
            {/* Left: Scanner Side */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '40px', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                    <div>
                        <h2 className="font-heading" style={{ color: 'var(--primary)', fontSize: '1.8rem' }}>CLASSROOM KIOSK</h2>
                        <p className="font-code" style={{ color: 'var(--text-dim)' }}>{subjectData.subject} • {teacherName}</p>
                    </div>
                    {/* Header Controls */}
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={handleRefresh} disabled={isRefreshing} className="btn-cyber" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
                            {isRefreshing ? 'SYNCING...' : 'SYNC RECORDS'}
                        </button>
                        <button onClick={onClose} className="btn-cyber" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>CLOSE</button>
                    </div>
                </div>

                <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'relative', width: '600px', height: '450px', background: '#000', borderRadius: '20px', overflow: 'hidden', border: `2px solid ${status === 'ERROR' ? 'var(--red)' : status === 'QUEUED' ? 'var(--green)' : 'var(--primary)'}`, boxShadow: `0 0 30px ${status === 'QUEUED' ? 'rgba(16,185,129,0.2)' : 'rgba(59,130,246,0.1)'}` }}>
                        <div className="video-container" style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <canvas ref={canvasRef} style={{ display: 'none' }} />

                            {/* Proactive Match Indicator */}
                            {status === 'READY' && matchingStudent && (
                                <div style={{ position: 'absolute', top: '20px', left: '20px', right: '20px', background: 'rgba(59,130,246,0.9)', padding: '10px', borderRadius: '8px', zIndex: 11, textAlign: 'center', border: '1px solid var(--primary)', animation: 'fadeIn 0.3s' }}>
                                    <div className="font-heading" style={{ fontSize: '0.9rem', color: 'white' }}>IDENTIFIED: {matchingStudent.name}</div>
                                    <div className="font-code" style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.8)' }}>Confidence: {similarity}% | TAP CARD TO CONFIRM</div>
                                </div>
                            )}

                            {/* HUD Error Overlay (Silent/Non-blocking) */}
                            {hudError && (
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(239,68,68,0.4)', backdropFilter: 'blur(4px)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s' }}>
                                    <div style={{ background: 'var(--red)', padding: '20px 40px', borderRadius: '12px', border: '2px solid white', textAlign: 'center', boxShadow: '0 0 30px rgba(239,68,68,0.5)' }}>
                                        <div style={{ fontSize: '3rem', marginBottom: '10px' }}>⚠️</div>
                                        <div className="font-heading" style={{ color: 'white', fontWeight: 'bold' }}>{hudError}</div>
                                    </div>
                                </div>
                            )}

                            {/* HUD Success Overlay */}
                            {hudSuccess && (
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(16,185,129,0.4)', backdropFilter: 'blur(4px)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s' }}>
                                    <div style={{ background: 'var(--green)', padding: '20px 40px', borderRadius: '12px', border: '2px solid white', textAlign: 'center', boxShadow: '0 0 30px rgba(16,185,129,0.5)' }}>
                                        <div style={{ fontSize: '3rem', marginBottom: '10px' }}>✅</div>
                                        <div className="font-heading" style={{ color: 'white', fontWeight: 'bold' }}>{hudSuccess}</div>
                                    </div>
                                </div>
                            )}

                            {/* Scanning Feedback Layer */}
                        </div>

                        {/* Scanner UI Overlay */}
                        <div className={`scan-zone ${isNear ? 'near' : ''} ${isFaceDetected ? 'face-detected' : ''} ${status === 'QUEUED' ? 'success' : ''}`} />
                        <div className="scan-overlay" />

                        {/* No Records Warning Indicator */}
                        {modelsReady && (!classStudents || classStudents.length === 0) && (
                            <div style={{ position: 'absolute', top: '20px', left: '20px', right: '20px', background: 'rgba(239,68,68,0.9)', padding: '10px', borderRadius: '8px', zIndex: 11, textAlign: 'center', border: '1px solid var(--red)' }}>
                                <div className="font-code" style={{ color: '#fff', fontSize: '0.9rem' }}>
                                    ⚠️ DATABASE SYNC REQUIRED: 0 STUDENTS LOADED (Roles: {allRoles.filter(Boolean).join(', ') || 'None'})
                                </div>
                            </div>
                        )}

                        {/* Status HUD */}
                        <div style={{ position: 'absolute', bottom: '20px', left: '20px', right: '20px', background: 'rgba(17,24,39,0.8)', padding: '15px', borderRadius: '10px', backdropFilter: 'blur(10px)', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div className="font-code">
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>SYSTEM STATUS</div>
                                    <div style={{ color: status === 'ERROR' || status === 'UNRECOGNIZED' || status === 'ALREADY_SCANNED' ? 'var(--red)' : isFaceDetected ? 'var(--green)' : 'var(--primary)', fontSize: '1.2rem', fontWeight: 'bold' }}>
                                        {status === 'READY' ? (
                                            proximityStatus === 'TOO_FAR' ? 'MOVE FORWARD...' :
                                            proximityStatus === 'TOO_CLOSE' ? 'MOVE BACKWARD...' :
                                            proximityStatus === 'NOT_CENTERED' ? 'CENTER YOUR FACE...' :
                                            isFaceDetected ? 'FACE DETECTED - ANALYZING...' :
                                            'WAITING FOR STUDENT...'
                                        ) :
                                            status === 'RFID' ? (matchingStudent ? `FACE MATCHED: ${matchingStudent.name.toUpperCase()}` : 'TAP RFID CARD') :
                                            status === 'UNRECOGNIZED' ? 'FACE NOT RECOGNIZED. PLEASE TRY AGAIN' :
                                                status === 'ALREADY_SCANNED' ? 'ALREADY SCANNED TODAY' : status}
                                    </div>
                                </div>
                                {matchingStudent && (
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '1.2rem', color: 'var(--green)' }}>{matchingStudent.name}</div>
                                        <div className="font-code" style={{ fontSize: '0.7rem' }}>{similarity}% CONFIDENCE</div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Comparison UI (Side-by-Side) */}
                        {(status === 'QUEUED' || (status === 'RFID' && matchingStudent)) && matchingStudent && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,17,23,0.9)', zIndex: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.3s' }}>
                                <div className="font-heading" style={{ color: 'var(--green)', fontSize: '1.2rem', marginBottom: '20px' }}>✅ IDENTITY VERIFIED</div>
                                
                                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div className="font-code" style={{ fontSize: '0.6rem', color: 'var(--text-dim)', marginBottom: '5px' }}>ENROLLED</div>
                                        <img src={matchingStudent.face_data} style={{ width: '180px', height: '180px', objectFit: 'cover', borderRadius: '10px', border: '2px solid var(--teal)' }} />
                                    </div>
                                    
                                    <div className="font-heading" style={{ color: 'var(--green)', fontSize: '1.5rem' }}>VS</div>
                                    
                                    <div style={{ textAlign: 'center' }}>
                                        <div className="font-code" style={{ fontSize: '0.6rem', color: 'var(--text-dim)', marginBottom: '5px' }}>LIVE SCAN</div>
                                        <img src={capturedPhoto} style={{ width: '180px', height: '180px', objectFit: 'cover', borderRadius: '10px', border: '2px solid var(--green)' }} />
                                    </div>
                                </div>
                                
                                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                                    <div className="font-heading" style={{ color: '#fff', fontSize: '1.4rem' }}>{matchingStudent.name}</div>
                                    <div className="font-code" style={{ color: 'var(--green)', fontSize: '0.9rem' }}>{similarity}% MATCH CONFIDENCE</div>
                                </div>
                                
                                <div style={{ marginTop: '20px', padding: '8px 20px', background: 'rgba(16,185,129,0.1)', border: '1px solid var(--green)', borderRadius: '20px' }}>
                                    <span className="font-code" style={{ color: 'var(--green)', fontSize: '0.8rem' }}>RECORDED IN SESSION QUEUE</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* RFID Overlay */}
                {status === 'RFID' && (
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.85)', padding: '40px', borderRadius: '20px', border: '1px solid var(--primary)', textAlign: 'center', animation: 'fadeIn 0.3s', zIndex: 100 }}>
                        <div style={{ fontSize: '4rem', marginBottom: '20px' }}>📇</div>
                        <h3 className="font-heading" style={{ color: 'var(--primary)' }}>TAP RFID CARD</h3>
                        <p className="font-code" style={{ color: 'var(--text-dim)', marginTop: '10px' }}>
                            {matchingStudent ? `VERIFYING ${matchingStudent.name}` : 'PLEASE SCAN YOUR ID CARD'}
                        </p>

                        <div style={{ marginTop: '25px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div className="font-code" style={{ fontSize: '0.8rem', color: 'var(--green)', letterSpacing: '2px', animation: 'blink 1s infinite' }}>● HARDWARE READY</div>
                            <div className="font-code" style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>LISTENING ON: {activeNodeId || 'IOT-01'}</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Right: Session Sidebar */}
            <div style={{ width: '400px', borderLeft: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '30px', borderBottom: '1px solid var(--border)' }}>
                    <h3 className="font-heading" style={{ fontSize: '1.2rem', color: 'var(--accent)' }}>SESSION QUEUE</h3>
                    <div className="font-code" style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{pendingScans.length} STUDENTS SCANNED</div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                    {pendingScans.map((s, i) => (
                        <div key={i} className="animate-in" style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', marginBottom: '10px', border: '1px solid rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ width: '35px', height: '35px', borderRadius: '50%', border: '1px solid var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>✓</div>
                            <div>
                                <div className="font-heading" style={{ fontSize: '0.85rem' }}>{s.name}</div>
                                <div className="font-code" style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{s.uid} • QUEUED</div>
                            </div>
                        </div>
                    ))}
                    {pendingScans.length === 0 && (
                        <div style={{ textAlign: 'center', color: 'var(--text-dim)', marginTop: '50px', fontStyle: 'italic' }}>No students scanned yet</div>
                    )}
                </div>

                <div style={{ padding: '30px', background: 'rgba(15,17,23,0.5)', borderTop: '1px solid var(--border)' }}>
                    <button
                        onClick={handleBatchSubmit}
                        disabled={pendingScans.length === 0 || status === 'COMMITTING'}
                        className="btn-cyber"
                        style={{ width: '100%', padding: '15px', borderColor: 'var(--green)', color: 'var(--green)', fontSize: '1rem' }}
                    >
                        {status === 'COMMITTING' ? 'PROCESSING...' : `COMMIT ${pendingScans.length} RECORDS`}
                    </button>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textAlign: 'center', marginTop: '10px' }} className="font-code">
                        This will finalize the attendance session.
                    </p>
                </div>
            </div>
        </div>
    );
}

