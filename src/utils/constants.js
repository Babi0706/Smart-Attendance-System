export const getCurrentTimestamp = () => Date.now();

// Gate Time Restriction (9:00 AM - 3:00 PM)
export const GATE_WINDOW = { START: 9, END: 15 }; // 24-hour format

export const isGateTimeValid = (currentTime = Date.now()) => {
    return true; // Restriction removed for testing/production as per user request
};

// Initial Data
export const INITIAL_USERS = [
    { uid: 'ADM001', name: 'System Admin', role: 'ADMIN', password: '123', email: 'admin@sys.com', dept: 'IT', phone: '+919999999999' },
    { uid: 'TCH0001', name: 'T.Charan Teja', role: 'TEACHER', password: '123', email: 'charan@school.com', dept: 'CS', phone: '+918888888888' },
    { uid: 'TCH0002', name: 'G.V.Trivendra Reddy', role: 'TEACHER', password: '123', email: 'trivendra@school.com', dept: 'CS', phone: '+917777777777' },
    { uid: 'TCH0003', name: 'K.Nanda Kishore Reddy', role: 'TEACHER', password: '123', email: 'nanda@school.com', dept: 'CS', phone: '+916666666666' },
    { uid: 'STU001', name: 'John Doe', role: 'STUDENT', password: '123', email: 'john@uni.com', dept: 'CS', year: '3', section: 'A', phone: '+911234567890' },
];

export const INIT_IOT_NODES = [
    { id: 'IOT-01', location: 'Student Plaza', status: 'ONLINE', signal: 95 },
    { id: 'IOT-02', location: 'Library', status: 'ONLINE', signal: 88 },
    { id: 'IOT-03', location: 'Seminar Hall', status: 'ONLINE', signal: 92 },
    { id: 'IOT-04', location: 'Sports Complex', status: 'ONLINE', signal: 85 },
    { id: 'IOT-05', location: 'Auditorium', status: 'ONLINE', signal: 75 },
    { id: 'IOT-06', location: 'Innovation Hub', status: 'ONLINE', signal: 90 },
];

export const parseTime = (timeStr) => {
    if (!timeStr) return 0;
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') hours = '00';
    if (modifier === 'PM') hours = (parseInt(hours, 10) % 12) + 12;
    else hours = parseInt(hours, 10) % 12;
    return parseInt(hours, 10) * 60 + parseInt(minutes, 10);
};

export const resolveSubjectAtTime = (timestamp, studentSubjects = []) => {
    const date = new Date(Number(timestamp));
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const recordDay = dayNames[date.getDay()];
    const recordMinutes = date.getHours() * 60 + date.getMinutes();

    return studentSubjects.find(s => {
        if (s.day !== recordDay) return false;
        const slotMinutes = parseTime(s.time);
        // Match if within 1 hour window of the slot start time
        return recordMinutes >= slotMinutes && recordMinutes < (slotMinutes + 60);
    });
};
