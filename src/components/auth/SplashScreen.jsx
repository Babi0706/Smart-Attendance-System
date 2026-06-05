import React from 'react';
import GlobalStyles from '../ui/GlobalStyles';

export default function SplashScreen() {
    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <GlobalStyles />
            <div style={{ fontSize: '3rem', color: 'var(--text-main)', marginBottom: '12px', fontWeight: 800, fontFamily: "'Inter', sans-serif" }}>Smart Attendance</div>
            <div style={{ color: 'var(--text-dim)', letterSpacing: '3px', fontSize: '0.85rem', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase' }}>Blockchain · IoT · Biometric</div>
            <div style={{ marginTop: '40px', width: '200px', height: '4px', background: 'var(--border)', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '50%', background: 'linear-gradient(90deg, var(--primary), var(--secondary))', borderRadius: '4px', animation: 'scanline 1s infinite linear alternate' }} />
            </div>
        </div>
    );
}
