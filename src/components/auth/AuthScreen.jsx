import React, { useState, useRef, useEffect } from 'react';
import authService from '../../services/authService';
import faceService from '../../services/faceService';
import rfidService from '../../services/rfidService';
import GlobalStyles from '../ui/GlobalStyles';
import Card from '../ui/Card';
import Badge from '../ui/Badge';

export default function AuthScreen({ users, onLogin, onSignup }) {
    const [mode, setMode] = useState('LOGIN');
    const [role, setRole] = useState('STUDENT');
    const [signupStep, setSignupStep] = useState('FORM'); // FORM -> FACE_CAPTURE -> FINGERPRINT -> COMPLETE

    const [loginId, setLoginId] = useState('');
    const [loginPass, setLoginPass] = useState('');
    const [showLoginPassword, setShowLoginPassword] = useState(false);

    // Signup State
    const [formData, setFormData] = useState({});
    const [showSignupPassword, setShowSignupPassword] = useState(false);
    const [showAdminCode, setShowAdminCode] = useState(false);
    const [capturedFace, setCapturedFace] = useState(null);
    const [fingerprintHash, setFingerprintHash] = useState(null);
    const [rfidUid, setRfidUid] = useState(null);
    const faceVideoRef = useRef(null);
    const faceCanvasRef = useRef(null);

    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        const result = await onLogin(loginId.trim(), loginPass, role);
        if (!result.success) {
            alert(result.error || 'Invalid Credentials');
        }
    };

    // Step 1: Form validation, then move to face capture
    const handleFormSubmit = (e) => {
        e.preventDefault();
        if (role === 'ADMIN' && formData.authCode !== 'ADMIN2025') {
            alert('Invalid Admin Authorization Code!');
            return;
        }
        if (!formData.name || !formData.email || !formData.password) {
            alert('Please fill all required fields!');
            return;
        }
        setSignupStep('FACE_CAPTURE');
    };

    // Step 2: Start camera for face capture
    useEffect(() => {
        if (signupStep === 'FACE_CAPTURE') {
            startFaceCamera();
        }
        return () => {
            if (signupStep === 'FACE_CAPTURE') stopFaceCamera();
        };
    }, [signupStep]);

    const startFaceCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (faceVideoRef.current) faceVideoRef.current.srcObject = stream;
        } catch (err) {
            alert('Camera permission denied! Face capture is required for signup.');
            setSignupStep('FORM');
        }
    };

    const stopFaceCamera = () => {
        const stream = faceVideoRef.current?.srcObject;
        if (stream) stream.getTracks().forEach(t => t.stop());
    };

    const captureFacePhoto = async () => {
        const video = faceVideoRef.current;
        const canvas = faceCanvasRef.current;
        if (!video || !canvas) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setCapturedFace(dataUrl);
        stopFaceCamera();
        setSignupStep('RFID_ENROLLMENT');
    };

    // Step 3: Wait for hardware RFID scan
    useEffect(() => {
        if (signupStep === 'RFID_ENROLLMENT') {
            const sub = rfidService.subscribeToScans((scan) => {
                setRfidUid(scan.uid);
                setFingerprintHash('FP-AUTO-' + Math.random().toString(36).substr(2, 8).toUpperCase());
                setSignupStep('COMPLETE');
                // Cleanup on success
                rfidService.unsubscribe();
            });
            return () => rfidService.unsubscribe();
        }
    }, [signupStep]);

    const captureFingerprint = () => {
        // This is now triggered automatically by the hardware scan listener above
        // but we'll keep a fallback "Skip Hardware" button for development
        const hash = 'FP-' + Math.random().toString(36).substr(2, 16).toUpperCase();
        const rfid = 'RFID-MANUAL-' + Math.random().toString(36).substr(2, 8).toUpperCase();
        setFingerprintHash(hash);
        setRfidUid(rfid);
        setSignupStep('COMPLETE');
    };

    // Step 4: Final signup with biometric data + face descriptor
    const handleFinalSignup = async () => {
        try {
            // Compute face descriptor for ML-based matching
            let faceDescriptor = null;
            if (capturedFace) {
                await faceService.loadModels();
                faceDescriptor = await faceService.getDescriptorFromDataUrl(capturedFace);
                if (!faceDescriptor) {
                    alert('Could not detect a face in the captured photo. Please retake.');
                    setSignupStep('FACE_CAPTURE');
                    setCapturedFace(null);
                    return;
                }
            }
            const userData = {
                ...formData, role,
                face_data: capturedFace,
                face_descriptor: faceDescriptor ? JSON.stringify(faceService.descriptorToArray(faceDescriptor)) : null,
                rfid_uid: rfidUid
            };
            const result = await onSignup(userData);
            if (result.success) {
                setMode('LOGIN');
                setFormData({});
                setCapturedFace(null);
                setFingerprintHash(null);
                setRfidUid(null); // Reset RFID UID
                setSignupStep('FORM');
            }
        } catch (err) {
            console.error('Signup error:', err);
            alert('Error during signup: ' + err.message);
        }
    };

    const fillDemo = (id, pass) => { setLoginId(id); setLoginPass(pass); };

    // Reset signup step when switching modes
    const switchMode = (m) => { setMode(m); setSignupStep('FORM'); setCapturedFace(null); setFingerprintHash(null); setRfidUid(null); };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }}>
            <GlobalStyles />
            <canvas ref={faceCanvasRef} style={{ display: 'none', zIndex: 3 }} />

            {/* Face Capture Full-Screen Modal */}
            {signupStep === 'FACE_CAPTURE' && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15,17,23,0.95)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <h2 className="font-heading" style={{ color: 'var(--primary)', marginBottom: '20px' }}>BIOMETRIC ENROLLMENT — STEP 1</h2>
                    <p className="font-code" style={{ color: 'var(--text-dim)', marginBottom: '20px' }}>Position your face in the frame and click CAPTURE</p>

                    <div style={{ position: 'relative', border: '2px solid var(--primary)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(59,130,246,0.25)' }}>
                        <video ref={faceVideoRef} autoPlay style={{ width: '480px', display: 'block' }} />
                        {/* Overlay scan lines */}
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '200px', height: '250px', border: '2px dashed rgba(0,229,255,0.5)', borderRadius: '50%' }} />
                    </div>

                    <div style={{ display: 'flex', gap: '15px', marginTop: '25px' }}>
                        <button className="btn-cyber" onClick={captureFacePhoto} style={{ padding: '12px 30px', borderColor: 'var(--green)', color: 'var(--green)' }}>📸 CAPTURE FACE</button>
                        <button className="btn-cyber" onClick={() => { stopFaceCamera(); setSignupStep('FORM'); }} style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>CANCEL</button>
                    </div>
                </div>
            )}

            {/* RFID Enrollment Modal */}
            {signupStep === 'RFID_ENROLLMENT' && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15,17,23,0.95)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <h2 className="font-heading" style={{ color: 'var(--primary)', marginBottom: '10px' }}>BIOMETRIC ENROLLMENT — STEP 2</h2>
                    <p className="font-code" style={{ color: 'var(--text-dim)', marginBottom: '30px' }}>Tap your physical RFID card on the scanner</p>

                    {/* Face capture preview */}
                    {capturedFace && (
                        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                            <span className="font-code" style={{ color: 'var(--green)', fontSize: '0.85rem' }}>✅ Face Captured Successfully</span>
                            <img src={capturedFace} alt="Captured face" style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '50%', border: '2px solid var(--green)', display: 'block', margin: '10px auto' }} />
                        </div>
                    )}

                    {/* RFID scanner animation */}
                    <div style={{ width: '180px', height: '220px', background: 'rgba(59,130,246,0.05)', border: '2px dashed var(--primary)', borderRadius: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ fontSize: '5rem', animation: 'float 3s infinite ease-in-out' }}>📇</div>
                        <span className="font-code" style={{ color: 'var(--primary)', fontSize: '0.8rem', marginTop: '15px' }}>WAITING FOR SCAN...</span>
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(to bottom, transparent, rgba(59,130,246,0.1), transparent)', animation: 'scanline 2s infinite linear' }} />
                    </div>

                    <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
                        <button className="btn-cyber" onClick={captureFingerprint} style={{ borderColor: 'var(--text-dim)', color: 'var(--text-dim)', fontSize: '0.75rem' }}>SIMULATE SCAN (TESTING)</button>
                        <button className="btn-cyber" onClick={() => { setSignupStep('FACE_CAPTURE'); setCapturedFace(null); }} style={{ borderColor: 'var(--red)', color: 'var(--red)', fontSize: '0.75rem' }}>← BACK</button>
                    </div>
                </div>
            )}

            {/* Enrollment Complete Modal */}
            {signupStep === 'COMPLETE' && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15,17,23,0.95)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <h2 className="font-heading" style={{ color: 'var(--green)', marginBottom: '20px' }}>ENROLLMENT COMPLETE</h2>

                    <div style={{ display: 'flex', gap: '40px', marginBottom: '30px' }}>
                        <div style={{ textAlign: 'center' }}>
                            <img src={capturedFace} alt="Face" style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '50%', border: '2px solid var(--green)' }} />
                            <div className="font-code" style={{ color: 'var(--green)', marginTop: '8px', fontSize: '0.85rem' }}>✅ FACE</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ width: '120px', height: '120px', borderRadius: '50%', border: '2px solid var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', background: 'rgba(16,185,129,0.1)' }}>📇</div>
                            <div className="font-code" style={{ color: 'var(--green)', marginTop: '8px', fontSize: '0.85rem' }}>✅ RFID</div>
                        </div>
                    </div>

                    <div className="font-code" style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: '20px' }}>RFID UID: {rfidUid}</div>

                    <button className="btn-cyber" onClick={handleFinalSignup} style={{ padding: '12px 40px', borderColor: 'var(--green)', color: 'var(--green)', fontSize: '1.1rem' }}>✅ COMPLETE REGISTRATION</button>
                </div>
            )}

            <Card style={{ width: '500px', zIndex: 10, backdropFilter: 'blur(12px)', background: 'rgba(18, 22, 33, 0.6)', border: '1px solid rgba(255,255,255,0.15)' }}>
                <h1 className="font-heading" style={{ textAlign: 'center', marginBottom: '30px', color: 'var(--primary)' }}>SYSTEM ACCESS</h1>

                {/* Mode Switcher */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '20px' }}>
                    {['LOGIN', 'SIGNUP'].map(m => (
                        <div key={m} onClick={() => switchMode(m)} style={{
                            flex: 1, textAlign: 'center', padding: '10px', cursor: 'pointer',
                            color: mode === m ? 'var(--primary)' : 'var(--text-dim)', borderBottom: mode === m ? '2px solid var(--primary)' : 'none',
                            background: mode === m ? 'rgba(59,130,246,0.05)' : 'transparent'
                        }} className="font-heading">{m}</div>
                    ))}
                </div>

                {/* Role Switcher */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'center' }}>
                    {['STUDENT', 'TEACHER', 'ADMIN'].map(r => (
                        <button key={r} onClick={() => { setRole(r); setLoginId(''); setLoginPass(''); }} className="btn-cyber" style={{
                            padding: '5px 10px', fontSize: '0.7rem',
                            borderColor: role === r ? (r === 'ADMIN' ? 'var(--red)' : r === 'TEACHER' ? 'var(--gold)' : 'var(--primary)') : 'var(--border)',
                            color: role === r ? (r === 'ADMIN' ? 'var(--red)' : r === 'TEACHER' ? 'var(--gold)' : 'var(--primary)') : 'var(--text-dim)',
                        }}>{r}</button>
                    ))}
                </div>

                {mode === 'LOGIN' ? (
                    <form onSubmit={handleLoginSubmit}>
                        <label className="form-label">USER ID</label>
                        <input className="form-input" value={loginId} onChange={e => setLoginId(e.target.value)} placeholder="e.g. STU001" />
                        <label className="form-label">PASSWORD</label>
                        <div style={{ position: 'relative' }}>
                            <input className="form-input" type={showLoginPassword ? "text" : "password"} value={loginPass} onChange={e => setLoginPass(e.target.value)} placeholder="••••" />
                            <span
                                onClick={() => setShowLoginPassword(!showLoginPassword)}
                                style={{ position: 'absolute', right: '15px', top: '12px', cursor: 'pointer', opacity: 0.7 }}
                            >
                                {showLoginPassword ? '👁️' : '👁️‍🗨️'}
                            </span>
                        </div>
                        <button className="btn-cyber" style={{ width: '100%' }}>AUTHENTICATE</button>


                    </form>
                ) : (
                    <form onSubmit={handleFormSubmit}>
                        <div style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '5px' }}>
                            <label className="form-label">FULL NAME</label>
                            <input className="form-input" required value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />

                            <label className="form-label">EMAIL</label>
                            <input className="form-input" required type="email" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} />

                            <label className="form-label">PASSWORD</label>
                            <div style={{ position: 'relative' }}>
                                <input className="form-input" required type={showSignupPassword ? "text" : "password"} value={formData.password || ''} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                                <span
                                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                                    style={{ position: 'absolute', right: '15px', top: '12px', cursor: 'pointer', opacity: 0.7 }}
                                >
                                    {showSignupPassword ? '👁️' : '👁️‍🗨️'}
                                </span>
                            </div>

                            {role === 'STUDENT' && (
                                <>
                                    <label className="form-label">PHONE</label>
                                    <input className="form-input" onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                    <div className="responsive-grid-2" style={{ gap: '10px' }}>
                                        <div><label className="form-label">DEPT</label><input className="form-input" onChange={e => setFormData({ ...formData, dept: e.target.value })} /></div>
                                        <div><label className="form-label">YEAR</label><input className="form-input" onChange={e => setFormData({ ...formData, year: e.target.value })} /></div>
                                    </div>
                                    <label className="form-label">SECTION</label>
                                    <input className="form-input" onChange={e => setFormData({ ...formData, section: e.target.value })} />
                                </>
                            )}

                            {role === 'TEACHER' && (
                                <>
                                    <label className="form-label">DEPARTMENT</label>
                                    <input className="form-input" required onChange={e => setFormData({ ...formData, dept: e.target.value })} />
                                    <label className="form-label">SUBJECT</label>
                                    <input className="form-input" required onChange={e => setFormData({ ...formData, subject: e.target.value })} />
                                </>
                            )}

                            {role === 'ADMIN' && (
                                <>
                                    <label className="form-label">DEPARTMENT</label>
                                    <input className="form-input" required onChange={e => setFormData({ ...formData, dept: e.target.value })} />
                                    <label className="form-label" style={{ color: 'var(--red)' }}>AUTH CODE (required)</label>
                                    <div style={{ position: 'relative' }}>
                                        <input className="form-input" required type={showAdminCode ? "text" : "password"} placeholder="ADMIN2025" onChange={e => setFormData({ ...formData, authCode: e.target.value })} />
                                        <span
                                            onClick={() => setShowAdminCode(!showAdminCode)}
                                            style={{ position: 'absolute', right: '15px', top: '12px', cursor: 'pointer', opacity: 0.7 }}
                                        >
                                            {showAdminCode ? '👁️' : '👁️‍🗨️'}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                        <button className="btn-cyber" style={{ width: '100%', marginTop: '15px' }}>PROCEED TO BIOMETRIC ENROLLMENT →</button>
                    </form>
                )}
            </Card>
        </div>
    );
}

