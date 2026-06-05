/**
 * Notification Service — Mock SMS
 * 
 * Simulates real SMS delivery to students on attendance events.
 * Stores sent notifications in localStorage and Supabase (notifications table if available).
 * 
 * TO UPGRADE to real SMS: replace the _dispatchSMS method with a Twilio/Fast2SMS API call.
 */

class NotificationService {
    constructor() {
        // In-memory log for the current session
        this._log = [];
    }

    /**
     * Build and "send" an SMS when a student marks GATE attendance (Student Plaza).
     * @param {Object} user - The student { name, phone }
     * @param {Object} record - { subject, timestamp, txHash }
     */
    sendGateAlert(user, record) {
        if (!user?.phone) return null;

        const time = new Date(record.timestamp).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata'
        });

        const message = `Hi ${user.name}, you have entered the college at ${time} (IST). Your attendance has been recorded. ✅\n\nSmartAttend System`;

        return this._dispatchSMS(user.phone, message, 'GATE_ENTRY', record);
    }

    /**
     * Build and "send" an SMS when a student gets subject/hub attendance.
     * @param {Object} user - The student { name, phone }
     * @param {Object} record - { subject, timestamp, txHash }
     */
    sendSubjectAlert(user, record) {
        if (!user?.phone) return null;

        const time = new Date(record.timestamp).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata'
        });

        const subjectName = record.subject || 'Your Class';
        const message = `Hi ${user.name}, attendance marked for "${subjectName}" at ${time} (IST). ✅\n\nSmartAttend System`;

        return this._dispatchSMS(user.phone, message, 'SUBJECT_ENTRY', record);
    }

    /**
     * Unified entry point — auto-selects the right message based on subject.
     * Call this after every successful attendance record.
     * @param {Object} user - { name, phone }
     * @param {Object} record - { subject, timestamp, txHash }
     * @returns {Object} Notification log entry
     */
    sendAttendanceAlert(user, record) {
        if (!user?.phone) {
            console.log('[NotificationService] No phone number for', user?.name, '— skipping.');
            return null;
        }

        const isGate = (record.subject || '').toLowerCase() === 'student plaza';
        return isGate
            ? this.sendGateAlert(user, record)
            : this.sendSubjectAlert(user, record);
    }

    /**
     * Internal: simulate dispatch. In production, swap this for a real API call.
     * @param {string} phone - Mobile number
     * @param {string} message - SMS content
     * @param {string} type - Notification type for logging
     * @param {Object} record - Record metadata
     * @returns {Object} Log entry
     */
    _dispatchSMS(phone, message, type, record) {
        const entry = {
            id: Date.now(),
            time: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
            type,
            phone,
            message,
            txHash: record?.txHash || null,
            status: 'SENT' // In production: 'PENDING' until API confirms
        };

        // Log for in-app display
        this._log.unshift(entry);
        if (this._log.length > 50) this._log.pop();

        // Persist to localStorage for session view
        try {
            const existing = JSON.parse(localStorage.getItem('smsNotificationLog') || '[]');
            existing.unshift(entry);
            localStorage.setItem('smsNotificationLog', JSON.stringify(existing.slice(0, 100)));
        } catch (e) {
            // Ignore storage errors
        }

        // Console log in a styled format for debugging
        console.log(
            `%c[📱 SMS SENT] %cTo: ${phone}\n%c${message}`,
            'color: #34d399; font-weight: bold;',
            'color: #60a5fa;',
            'color: #f8fafc;'
        );

        return entry;
    }

    /**
     * Get all notifications sent in this session.
     * @returns {Array} Log entries
     */
    getLog() {
        return this._log;
    }

    /**
     * Get persisted notifications from localStorage.
     * @returns {Array} Stored log entries
     */
    getPersistedLog() {
        try {
            return JSON.parse(localStorage.getItem('smsNotificationLog') || '[]');
        } catch {
            return [];
        }
    }
}

export default new NotificationService();
