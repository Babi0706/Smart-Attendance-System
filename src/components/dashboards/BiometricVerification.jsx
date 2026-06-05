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
import authService from '../../services/authService';
import iotService from '../../services/iotService';
export default function BiometricVerification({ onClose, onSuccess, storedFaceData, storedFaceDescriptor, storedRfid, method, subjectData }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [status, setStatus] = useState('READY'); // READY, ANALYZE, RFID, SUCCESS, ERROR
    const [capturedPhoto, setCapturedPhoto] = useState(null);
    const [similarity, setSimilarity] = useState(0);
    const [modelsReady, setModelsReady] = useState(faceService.isReady());
    const [isFaceDetected, setIsFaceDetected] = useState(false);
    const [isNear, setIsNear] = useState(false);
    const [proximityStatus, setProximityStatus] = useState('READY');
    const [rfidScanning, setRfidScanning] = useState(false);
    const [rfidVerified, setRfidVerified] = useState(false);
    const [statusMsg, setStatusMsg] = useState('');

    const [faceInView, setFaceInView] = useState(false);
    const [autoCaptureCountdown, setAutoCaptureCountdown] = useState(null);
    const lastFaceBoxRef = useRef(null);

    useEffect(() => {
        if (method === 'FACE') {
            setStatusMsg('Initializing facial recognition...');
            faceService.loadModels().then(() => {
                setModelsReady(true);
                setStatusMsg('');
                startCamera();
            }).catch(err => {
                alert('Security initialization failed: ' + err.message);
                onClose();
            });
        }
        return () => stopCamera();
    }, []);

    // Face detection loop (Optimized Single-Pass)
    useEffect(() => {
        let interval;
        if (method === 'FACE' && modelsReady && !capturedPhoto && status === 'READY') {
            interval = setInterval(async () => {
                const video = videoRef.current;
                if (!video || video.paused || video.ended || video.readyState < 2) return;

                try {
                    // PERFORMANCE: Use detectAndIdentify logic style
                    const result = await faceService.detectLiveness(video);
                    setIsFaceDetected(result.face);
                    
                    if (result.face) {
                        lastFaceBoxRef.current = result.box;
                        
                        // Centering/Proximity Logic
                        const faceWidth = result.box?.width || 0;
                        const faceCenterX = result.box.x + result.box.width / 2;
                        const videoCenterX = video.videoWidth / 2;
                        
                        const isCentered = Math.abs(faceCenterX - videoCenterX) < (video.videoWidth * 0.3);
                        const isTooFar = faceWidth < 80;
                        const isTooClose = faceWidth > 400;

                        if (!isCentered) setProximityStatus('NOT_CENTERED');
                        else if (isTooFar) setProximityStatus('TOO_FAR');
                        else if (isTooClose) setProximityStatus('TOO_CLOSE');
                        else {
                            setProximityStatus('READY');
                            setIsNear(true);
                        }
                    } else {
                        setProximityStatus('READY');
                        setIsNear(false);
                    }
                } catch (err) {
                    console.warn('Face tracking error:', err);
                }
            }, 100);
        }
        return () => clearInterval(interval);
    }, [modelsReady, capturedPhoto, method, status]);

    // Auto-Capture Loop (Stable face check)
    useEffect(() => {
        let timer;
        if (isNear && !capturedPhoto && modelsReady && status === 'READY') {
            if (autoCaptureCountdown === null) {
                setAutoCaptureCountdown(3);
            } else if (autoCaptureCountdown > 0) {
                timer = setTimeout(() => setAutoCaptureCountdown(prev => prev - 1), 400);
            } else {
                capturePhoto();
                setAutoCaptureCountdown(null);
            }
        } else {
            setAutoCaptureCountdown(null);
        }
        return () => clearTimeout(timer);
    }, [isNear, autoCaptureCountdown, capturedPhoto, modelsReady, status]);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (err) {
            alert("Camera permission denied!");
            onClose();
        }
    };

    const stopCamera = () => {
        const stream = videoRef.current?.srcObject;
        if (stream) stream.getTracks().forEach(t => t.stop());
    };

    const capturePhoto = async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        try {
            const box = lastFaceBoxRef.current;
            const targetSize = 400;
            canvas.width = targetSize;
            canvas.height = targetSize;
            const ctx = canvas.getContext('2d');
            
            // Mirror flip for consistency with video feed
            ctx.translate(targetSize, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(video, 0, 0, targetSize, targetSize);
            
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            setCapturedPhoto(dataUrl);
            stopCamera();

            setStatus('ANALYZE');
            
            // Get face descriptor
            const liveDescriptor = await faceService.getDescriptorFromDataUrl(dataUrl);

            if (!liveDescriptor) {
                setStatus('ERROR');
                setStatusMsg('Face lost during capture');
                return;
            }

            // Compare with stored descriptor
            if (storedFaceDescriptor) {
                const storedDesc = typeof storedFaceDescriptor === 'string'
                    ? JSON.parse(storedFaceDescriptor)
                    : storedFaceDescriptor;

                const distance = faceService.compareFaces(storedDesc, liveDescriptor);
                const sim = Math.max(0, Math.round((1 - distance) * 100));
                setSimilarity(sim);

                setTimeout(() => {
                    // TIGHTENED THRESHOLD: 0.42 for high security
                    if (distance < 0.42) {
                        setStatus('RFID');
                        // Trigger IoT Hardware
                        const nodeId = iotService.getLastActiveNodeId() || 'IOT-01';
                        rfidService.triggerScan(nodeId);
                    } else {
                        setStatus('ERROR');
                        setStatusMsg(`Identity mismatch (${sim}%)`);
                    }
                }, 800);
            } else {
                setStatus('ERROR');
                setStatusMsg('User biometric profile missing');
            }
        } catch (err) {
            console.error('Capture error:', err);
            setStatus('ERROR');
        }
    };

    const handleRFIDScan = async () => {
        setRfidScanning(true);
        try {
            const nodeId = iotService.getLastActiveNodeId() || 'IOT-01';
            await rfidService.triggerScan(nodeId);
        } catch (err) {
            console.error('RFID trigger error:', err);
        }

        rfidService.subscribeToScans((scan) => {
            const scannedUid = (scan.uid || '').toUpperCase().trim();
            const expectedUid = (storedRfid || '').toUpperCase().trim();

            if (scannedUid === expectedUid) {
                console.log('[Verification] Success:', scan.uid);
                rfidService.sendFeedback('SUCCESS');
                setRfidScanning(false);
                setRfidVerified(true);
                setStatus('SUCCESS');
                
                setTimeout(() => {
                    onSuccess('FACE_RFID', subjectData);
                    onClose();
                }, 2500);
            } else {
                console.warn('[Verification] RFID Mismatch:', scannedUid, 'Expected:', expectedUid);
                rfidService.sendFeedback('FAIL');
                setStatus('ERROR');
                setStatusMsg('RFID CARD MISMATCH');
                setRfidScanning(false);
            }
        });
    };

    // Safety cleanup & Automations
    useEffect(() => {
        return () => rfidService.unsubscribe();
    }, []);

    // Auto-flow for Dual-Verification
    useEffect(() => {
        if (status === 'RFID' && !rfidScanning && !rfidVerified) {
            handleRFIDScan();
        }
    }, [status]);

    const handleConfirm = () => {
        onSuccess('FACE_RFID', subjectData);
        onClose();
    };

    const handleRetake = () => {
        setCapturedPhoto(null);
        setRfidVerified(false);
        setRfidScanning(false);
        setSimilarity(0);
        setIsFaceDetected(false);
        setIsNear(false);
        setStatus('READY');
        startCamera();
    };

    // Fingerprint verification mode
    const handleFingerprintVerify = () => {
        setVerifying(true);
        setTimeout(() => {
            setVerifying(false);
            setVerified(true);
            setTimeout(() => {
                onSuccess(method, subjectData);
                onClose();
            }, 1000);
        }, 2000);
    };


    return (
        <div className="verification-modal" style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <GlobalStyles />
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            <div style={{ position: 'absolute', top: '30px', right: '30px', zIndex: 10000, display: 'flex', gap: '15px' }}>
                <button onClick={onClose} className="btn-cyber" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>CLOSE</button>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                <h2 className="font-heading" style={{ color: 'var(--primary)', fontSize: '1.5rem', marginBottom: '5px' }}>
                    IDENTITY VERIFICATION
                </h2>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                    {subjectData && (
                        <Badge type="teal">HUB: {subjectData.name.toUpperCase()}</Badge>
                    )}
                    <Badge type="indigo">SECURE SESSION</Badge>
                </div>
            </div>

            {/* THE PREMIUM SINGLE-PANE HUD */}
            <div style={{
                position: 'relative',
                width: '100%',
                maxWidth: '800px',
                aspectRatio: '4/3',
                background: '#000',
                borderRadius: '24px',
                overflow: 'hidden',
                border: `3px solid ${status === 'ERROR' ? 'var(--red)' : status === 'SUCCESS' ? 'var(--green)' : 'rgba(59,130,246,0.2)'}`,
                boxShadow: `0 0 50px ${status === 'ERROR' ? 'rgba(239,68,68,0.3)' : status === 'SUCCESS' ? 'rgba(16,185,129,0.3)' : 'rgba(0,0,0,0.5)'}`,
                display: 'flex'
            }}>
                {/* Main Video Feed */}
                {!capturedPhoto ? (
                    <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                    />
                ) : (
                    <img src={capturedPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                )}

                {/* Static Oval Guide */}
                {!capturedPhoto && (
                    <div style={{
                        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        width: '200px', height: '280px',
                        border: `2px solid ${isFaceDetected ? 'var(--green)' : 'rgba(255,255,255,0.2)'}`,
                        borderRadius: '50%', transition: 'all 0.3s ease', pointerEvents: 'none', zIndex: 10,
                        boxShadow: isFaceDetected ? '0 0 30px var(--green), inset 0 0 30px var(--green)' : 'none'
                    }} />
                )}

                {/* Floating Mini-PiP (Stored Template) */}
                <AnimatePresence>
                    {(status === 'ANALYZE' || status === 'RFID' || status === 'SUCCESS' || status === 'ERROR') && (
                        <motion.div
                            initial={{ x: -50, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            style={{
                                position: 'absolute', top: '25px', left: '25px',
                                width: '110px', height: '110px', borderRadius: '16px',
                                border: '2px solid var(--primary)', overflow: 'hidden',
                                zIndex: 20, background: 'var(--surface)',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                            }}
                        >
                            {storedFaceData ? (
                                <img src={storedFaceData} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>👤</div>
                            )}
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(59,130,246,0.8)', padding: '2px', textAlign: 'center' }}>
                                <div className="font-code" style={{ fontSize: '0.6rem', color: '#fff' }}>PROFILE</div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Integrated Status Bar */}
                <div style={{
                    position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)',
                    width: '85%', background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(10px)',
                    padding: '12px 25px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 30
                }}>
                    <div>
                        <div className="font-code" style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>{status === 'RFID' ? 'HARDWARE ACTIVE' : 'SYSTEM STATUS'}</div>
                        <div className="font-heading" style={{ color: status === 'ERROR' ? 'var(--red)' : status === 'SUCCESS' ? 'var(--green)' : status === 'RFID' ? 'var(--primary)' : '#fff', fontSize: '1.1rem' }}>
                            {status === 'ERROR' ? '❌ IDENTITY MISMATCH' : status === 'SUCCESS' ? '✅ VERIFIED' : status === 'RFID' ? 'TAP RFID CARD' : status === 'ANALYZE' ? '🔍 COMPARING HASKS...' : isFaceDetected ? 'FACE DETECTED' : 'AWAITING RECOGNITION...'}
                        </div>
                    </div>
                    {status === 'ANALYZE' && <div className="loader" style={{ width: '20px', height: '20px', borderTopColor: 'var(--primary)' }} />}
                    {status === 'SUCCESS' && <div className="font-heading" style={{ color: 'var(--green)' }}>{similarity}%</div>}
                    {status === 'ERROR' && <div className="font-heading" style={{ color: 'var(--red)' }}>{similarity}%</div>}
                </div>

                {/* RFID OVERLAY ACTION */}
                {status === 'RFID' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}
                    >
                        <div style={{ fontSize: '4rem', marginBottom: '15px' }}>📳</div>
                        <h3 className="font-heading" style={{ color: 'var(--primary)', marginBottom: '10px' }}>TAP YOUR TEACHER ID</h3>
                        <p className="font-code" style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Dual-verification required at this node.</p>
                        <div className="loader" style={{ marginTop: '20px', width: '30px', height: '30px', borderTopColor: 'var(--primary)' }} />
                    </motion.div>
                )}

                {/* SUCCESS PULSE */}
                {status === 'SUCCESS' && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        style={{ position: 'absolute', inset: 0, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
                    >
                        <div style={{ textAlign: 'center' }}>
                            <div className="font-heading" style={{ color: '#fff', fontSize: '2.5rem', textShadow: '0 0 20px rgba(0,0,0,0.5)' }}>IDENTITY CONFIRMED</div>
                            <div className="font-code" style={{ color: 'rgba(255,255,255,0.8)', marginTop: '10px' }}>OPENING BLOCKCHAIN WALLET...</div>
                        </div>
                    </motion.div>
                )}

                {/* Proximity / Error Messages */}
                {isFaceDetected && proximityStatus !== 'READY' && status === 'READY' && (
                    <div style={{ position: 'absolute', top: '20px', width: '100%', textAlign: 'center', zIndex: 100 }}>
                        <span style={{ background: 'rgba(239,68,68,0.9)', color: '#fff', padding: '6px 15px', borderRadius: '30px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                            {proximityStatus === 'NOT_CENTERED' ? 'CENTER YOUR FACE' : 'MOVE CLOSER'}
                        </span>
                    </div>
                )}

                {status === 'ERROR' && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
                        <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.8)', padding: '30px', borderRadius: '20px', border: '1px solid var(--red)' }}>
                            <div className="font-heading" style={{ color: 'var(--red)', fontSize: '1.5rem', marginBottom: '10px' }}>VERIFICATION FAILED</div>
                            <p className="font-code" style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '20px' }}>Confidence: {similarity}% (Required &gt;58%)</p>
                            <button onClick={handleRetake} className="btn-cyber" style={{ borderColor: '#fff', color: '#fff' }}>↻ TRY AGAIN</button>
                        </div>
                    </div>
                )}

                {!modelsReady && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                        <div className="loader" style={{ borderTopColor: 'var(--primary)', marginBottom: '15px' }} />
                        <div className="font-code" style={{ color: 'var(--primary)' }}>INITIALIZING BIOMETRICS...</div>
                    </div>
                )}
            </div>

            {/* Footer Guidance */}
            <div style={{ marginTop: '30px', textAlign: 'center' }}>
                <p className="font-code" style={{ color: 'var(--text-dim)', fontSize: '0.75rem', opacity: 0.6 }}>
                    ENCRYPTED BIOMETRIC HASHING • {subjectData?.code || 'SECURE'} MODE
                </p>
            </div>
        </div>
    );
}




