import React from 'react';

export default function Badge({ children, type = 'cyan' }) {
    const colors = {
        cyan: 'var(--primary)',
        teal: 'var(--teal)',
        green: 'var(--green)',
        red: 'var(--red)',
        gold: 'var(--accent)',
        purple: 'var(--secondary)',
        indigo: 'var(--primary)',
    };
    const c = colors[type] || colors.cyan;
    return (
        <span style={{
            padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600,
            fontFamily: "'Inter', sans-serif",
            backgroundColor: `${c}18`, border: `1px solid ${c}44`, color: c,
            letterSpacing: '0.3px',
        }}>{children}</span>
    );
}
