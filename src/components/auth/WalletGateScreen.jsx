import React from 'react';
import GlobalStyles from '../ui/GlobalStyles';
import Card from '../ui/Card';

export default function WalletGateScreen({ onConnect }) {
    const [connecting, setConnecting] = React.useState(false);

    const handleConnect = async () => {
        setConnecting(true);
        try {
            await onConnect();
        } catch (e) {
            setConnecting(false);
        }
    };

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <GlobalStyles />

            {/* Logo icon */}
            <div style={{ width: '100px', height: '100px', background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'float 3s ease-in-out infinite', marginBottom: '32px', boxShadow: '0 12px 40px rgba(59, 130, 246, 0.35)' }}>
                <span style={{ fontSize: '2.5rem' }}>🔗</span>
            </div>

            <div style={{ fontSize: '2.5rem', color: 'var(--text-main)', marginBottom: '8px', fontWeight: 800, fontFamily: "'Inter', sans-serif" }}>Smart Attendance</div>
            <div style={{ color: 'var(--text-dim)', letterSpacing: '3px', marginBottom: '40px', fontSize: '0.85rem', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase' }}>Blockchain · IoT · Biometric</div>

            <Card style={{ width: '450px', textAlign: 'center', padding: '32px' }}>
                <h3 style={{ color: 'var(--primary)', marginBottom: '16px', fontWeight: 700, fontSize: '1.1rem' }}>Wallet Authentication Required</h3>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.88rem', marginBottom: '28px', lineHeight: '1.7' }}>
                    Connect your MetaMask wallet to access the system. Your wallet serves as your blockchain identity for tamper-proof attendance records.
                </p>

                <button onClick={handleConnect} disabled={connecting} className="btn-cyber" style={{ width: '100%', padding: '14px 20px', fontSize: '1rem', borderColor: 'var(--green)', color: connecting ? 'var(--text-dim)' : 'var(--green)' }}>
                    {connecting ? (
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                            <span style={{ width: '18px', height: '18px', border: '2px solid var(--green)', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', display: 'inline-block' }}></span>
                            Connecting...
                        </span>
                    ) : '🦊 Connect MetaMask'}
                </button>

                <div style={{ marginTop: '20px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                    ⚠️ MetaMask browser extension required
                </div>
            </Card>
        </div>
    );
}
