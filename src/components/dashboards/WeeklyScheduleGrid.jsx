import React from 'react';

const WeeklyScheduleGrid = ({ studentSubjects }) => {
    // Generate the grid based on the provided screenshot
    const times = [
        "09:00 - 10:00",
        "10:00 - 11:00",
        "11:00 - 11:15", // Short Break
        "11:15 - 12:15",
        "12:15 - 13:15", // Lunch Break
        "13:15 - 14:15",
        "14:15 - 15:15"
    ];

    const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    // Helper to find a subject for a specific day and time slot
    const getSubject = (day, timeSlot) => {
        return studentSubjects.find(s => {
            if (!s.day || !s.time) return false;
            // Normalize "Monday" or "Mon" to "MON"
            const normalizedDay = s.day.substring(0, 3).toUpperCase();

            // Normalize search time to "09:00" format (take the start of the range)
            let searchTime = timeSlot.split(' - ')[0];
            if (searchTime.length === 4) searchTime = "0" + searchTime;

            // Check if current subject time starts with our slot time (using normalized 24h time if available)
            const subjTime = s.time24 || s.time;
            const matchesTime = subjTime.startsWith(searchTime);

            return normalizedDay === day && matchesTime;
        });
    };

    return (
        <div style={{
            background: 'var(--surface)',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            overflow: 'hidden',
            fontFamily: 'var(--font-mono)'
        }}>
            {/* Header Row */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '80px repeat(6, 1fr)',
                borderBottom: '1px solid var(--border)',
                background: 'rgba(59, 130, 246, 0.05)'
            }}>
                <div style={{ padding: '15px', color: 'var(--primary)', fontWeight: 'bold', textAlign: 'center', borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    TIME
                </div>
                {days.map(day => (
                    <div key={day} style={{ padding: '15px', color: 'var(--primary)', fontWeight: 'bold', textAlign: 'center' }}>
                        {day}
                    </div>
                ))}
            </div>

            {/* Grid Body */}
            <div>
                {times.map((timeLabel, rowIndex) => {
                    const isShortBreak = timeLabel === "11:00 - 11:15";
                    const isLunchBreak = timeLabel === "12:15 - 13:15";

                    if (isShortBreak) {
                        return (
                            <div key={timeLabel} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
                                <div style={{ padding: '10px 5px', color: 'var(--primary)', fontSize: '0.8rem', textAlign: 'center', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'center', fontWeight: 'bold' }}>
                                    <div>11:00 -</div>
                                    <div>11:15</div>
                                </div>
                                <div style={{ padding: '15px', color: 'var(--text-dim)', textAlign: 'center', fontStyle: 'italic', letterSpacing: '4px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    ☕ SHORT BREAK
                                </div>
                            </div>
                        );
                    }

                    if (isLunchBreak) {
                        return (
                            <div key={timeLabel} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
                                <div style={{ padding: '10px 5px', color: 'var(--primary)', fontSize: '0.8rem', textAlign: 'center', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'center', fontWeight: 'bold' }}>
                                    <div>12:15 -</div>
                                    <div>13:15</div>
                                </div>
                                <div style={{ padding: '15px', color: 'var(--text-dim)', textAlign: 'center', fontStyle: 'italic', letterSpacing: '4px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    🍱 LUNCH BREAK
                                </div>
                            </div>
                        );
                    }

                    // Regular Class Row
                    return (
                        <div key={timeLabel} style={{ display: 'grid', gridTemplateColumns: '80px repeat(6, 1fr)', borderBottom: rowIndex === times.length - 1 ? 'none' : '1px solid var(--border)' }}>
                            <div style={{ padding: '20px 5px', color: 'var(--primary)', fontSize: '0.85rem', textAlign: 'center', borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                {timeLabel}
                            </div>

                            {days.map(day => {
                                const subject = getSubject(day, timeLabel);

                                return (
                                    <div key={`${day}-${timeLabel}`} style={{ padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {subject ? (
                                            <div style={{
                                                width: '100%',
                                                height: '100%',
                                                background: 'rgba(0,0,0,0.3)',
                                                border: `1px solid ${subject.color}40`,
                                                borderTop: `2px solid ${subject.color}`,
                                                borderRadius: '6px',
                                                padding: '12px 8px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                textAlign: 'center',
                                                gap: '4px',
                                                transition: 'all 0.2s ease',
                                                cursor: 'default'
                                            }}
                                                onMouseOver={(e) => {
                                                    e.currentTarget.style.background = `${subject.color}15`;
                                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                                }}
                                                onMouseOut={(e) => {
                                                    e.currentTarget.style.background = 'rgba(0,0,0,0.3)';
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                }}>
                                                <div style={{ color: subject.color, fontWeight: 'bold', fontSize: '0.85rem' }}>{subject.code}</div>
                                                <div style={{ color: 'var(--text-main)', fontSize: '0.7rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{subject.name}</div>
                                            </div>
                                        ) : (
                                            <div style={{ color: 'var(--border)', fontSize: '1rem' }}>-</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default WeeklyScheduleGrid;
