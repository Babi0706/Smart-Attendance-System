import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import faceService from '../../services/faceService';
import userService from '../../services/userService';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import GlobalStyles from '../ui/GlobalStyles';

/**
 * BiometricEnrollment Component
 * Handles re-enrolling a user's face in the database
 */
export default function BiometricEnrollment({ user, onClose, onRefresh }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [capturedImage, setCapturedImage] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [modelsReady, setModelsReady] = useState(faceService.isReady());

    useEffect(() => {
        const init = async () => {
            await startCamera();
            if (!faceService.isReady()) {
                await faceService.loadModels();
                setModelsReady(true);
            }
        };
        init();
        return () => stopCamera();
    }, []);

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480 }
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (err) {
            console.error('Camera error:', err);
            setError('Could not access camera. Please check permissions.');
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    const handleCapture = async () => {
        if (!videoRef.current || !canvasRef.current) return;

        setIsProcessing(true);
        setError(null);

        try {
            const canvas = canvasRef.current;
            const video = videoRef.current;
            const context = canvas.getContext('2d');

            // Draw current video frame to canvas
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            setCapturedImage(dataUrl);

            // Generate face descriptor
            const descriptor = await faceService.getDescriptorFromDataUrl(dataUrl);
            
            if (!descriptor) {
                setError('No face detected. Please ensure your face is clearly visible.');
                setCapturedImage(null);
                setIsProcessing(false);
                return;
            }

            // Update user in Supabase
            const result = await userService.updateUser(user.uid, {
                face_data: dataUrl,
                face_descriptor: JSON.stringify(Array.from(descriptor))
            });

            if (result.success) {
                setSuccess(true);
                if (onRefresh) onRefresh();
                setTimeout(() => onClose(), 2000);
            } else {
                throw new Error(result.error);
            }
        } catch (err) {
            console.error('Enrollment error:', err);
            setError('Failed to save face data: ' + err.message);
            setCapturedImage(null);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRetake = () => {
        setCapturedImage(null);
        setError(null);
        setSuccess(false);
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <GlobalStyles />
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '25px', padding: '20px' }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 className="font-heading" style={{ color: 'var(--primary)', fontSize: '1.5rem', marginBottom: '5px' }}>BIOMETRIC ENROLLMENT</h2>
                        <p className="font-code" style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>STUDENT: <span style={{ color: '#fff' }}>{user.name} ({user.uid})</span></p>
                    </div>
                    <button onClick={onClose} className="btn-cyber" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>CLOSE</button>
                </div>

                <div style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '4/3',
                    background: '#000',
                    borderRadius: '24px',
                    overflow: 'hidden',
                    border: `3px solid ${success ? 'var(--green)' : error ? 'var(--red)' : 'rgba(59,130,246,0.3)'}`,
                    boxShadow: `0 0 50px ${success ? 'rgba(16,185,129,0.3)' : error ? 'rgba(239,68,68,0.3)' : 'rgba(0,0,0,0.5)'}`,
                }}>
                    <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />

                    {capturedImage && (
                        <img src={capturedImage} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                    )}

                    {/* Guide Oval */}
                    {!capturedImage && (
                        <div style={{
                            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                            width: '200px', height: '280px',
                            border: '2px solid rgba(255,255,255,0.2)',
                            borderRadius: '50%', pointerEvents: 'none', zIndex: 10,
                            boxShadow: '0 0 20px rgba(59,130,246,0.2)'
                        }} />
                    )}

                    {/* HUD Status Bar */}
                    <div style={{
                        position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)',
                        width: '85%', background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(10px)',
                        padding: '15px 25px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 30
                    }}>
                        <div>
                            <div className="font-code" style={{ fontSize: '0.6rem', color: 'var(--text-dim)' }}>ENROLLMENT STATUS</div>
                            <div className="font-heading" style={{ color: success ? 'var(--green)' : error ? 'var(--red)' : '#fff', fontSize: '1.1rem' }}>
                                {success ? 'PROCESSED SUCCESSFULLY' : error ? 'CAPTURE FAILED' : isProcessing ? 'GENERATING HASH...' : 'READY TO CAPTURE'}
                            </div>
                        </div>
                        {isProcessing && <div className="loader" style={{ width: '20px', height: '20px', borderTopColor: 'var(--primary)' }} />}
                        {success && <div style={{ fontSize: '1.5rem' }}>✅</div>}
                    </div>

                    {/* Feedback Messages */}
                    {error && (
                        <div style={{ position: 'absolute', top: '30px', left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
                            <span style={{ background: 'rgba(239,68,68,0.9)', color: '#fff', padding: '8px 20px', borderRadius: '30px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                ⚠️ {error}
                            </span>
                        </div>
                    )}

                    {/* Success Overlay */}
                    {success && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            style={{ position: 'absolute', inset: 0, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
                        >
                            <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.8)', padding: '40px', borderRadius: '24px', border: '2px solid var(--green)' }}>
                                <div style={{ fontSize: '4rem', marginBottom: '15px' }}>👤</div>
                                <div className="font-heading" style={{ color: '#fff', fontSize: '1.8rem' }}>PROFILE UPDATED</div>
                                <div className="font-code" style={{ color: 'var(--green)', marginTop: '10px' }}>BIOMETRIC TEMPLATE SYNCED</div>
                            </div>
                        </motion.div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '20px' }}>
                    {!capturedImage ? (
                        <button
                            onClick={handleCapture}
                            disabled={!modelsReady || isProcessing}
                            className="btn-cyber"
                            style={{ flex: 1, padding: '16px', fontSize: '1rem' }}
                        >
                            {modelsReady ? '📸 INITIALIZE SCAN' : 'LOADING MODELS...'}
                        </button>
                    ) : (
                        !success && (
                            <button
                                onClick={handleRetake}
                                className="btn-cyber"
                                style={{ flex: 1, padding: '16px' }}
                            >
                                ↻ RETAKE SCAN
                            </button>
                        )
                    )}
                </div>

                <p className="font-code" style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.75rem', opacity: 0.6 }}>
                    ENCRYPTED BIOMETRIC HASHING • SECURE DATABASE SYNC CACHE
                </p>
            </motion.div>
        </div>
    );
}
