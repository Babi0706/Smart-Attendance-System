import { supabase } from '../config/supabase';
import offlineService from './offlineService';

/**
 * Attendance Service for Supabase
 * Persists session metadata linked to blockchain transactions
 */
class AttendanceService {
    /**
     * Save attendance log to Supabase
     * @param {Object} logData - Full block metadata
     */
    async saveLog(logData) {
        // Check if online
        if (!navigator.onLine) {
            console.log('[AttendanceService] Offline detected. Queuing record locally.');
            await offlineService.queueAttendance(logData);
            return { success: true, offline: true };
        }

        try {
            const { data, error } = await supabase
                .from('attendance_logs')
                .insert([{
                    tx_hash: logData.txHash,
                    uid: logData.uid,
                    name: logData.name,
                    dept: logData.dept,
                    subject: logData.subject,
                    subject_code: logData.subjectCode,
                    teacher: logData.teacher,
                    method: logData.method,
                    timestamp: new Date(logData.timestamp).toISOString()
                }])
                .select()
                .single();

            if (error) throw error;
            return { success: true, log: data };
        } catch (error) {
            console.error('Save log error:', error);
            // Ignore duplicate tx_hash errors (already persisted)
            if (error.code === '23505') return { success: true };
            return { success: false, error: error.message };
        }
    }

    /**
     * Save multiple attendance logs to Supabase in a single call
     * @param {Array} logsArray - Array of log objects
     */
    async saveBatchLogs(logsArray) {
        if (!navigator.onLine) {
            console.log('[AttendanceService] Offline. Queuing batch locally.');
            for (const log of logsArray) {
                await offlineService.queueAttendance(log);
            }
            return { success: true, offline: true };
        }

        try {
            const inserts = logsArray.map(logData => ({
                tx_hash: logData.txHash,
                uid: logData.uid,
                name: logData.name,
                dept: logData.dept,
                subject: logData.subject,
                subject_code: logData.subjectCode,
                teacher: logData.teacher,
                method: logData.method,
                timestamp: new Date(logData.timestamp || Date.now()).toISOString()
            }));

            const { data, error } = await supabase
                .from('attendance_logs')
                .insert(inserts)
                .select();

            if (error) throw error;
            return { success: true, logs: data };
        } catch (error) {
            console.error('Save batch logs error:', error);
            // Ignore duplicate tx_hash errors
            if (error.code === '23505') return { success: true };
            return { success: false, error: error.message };
        }
    }

    /**
     * Get all logs from Supabase
     */
    async getAllLogs() {
        try {
            const { data, error } = await supabase
                .from('attendance_logs')
                .select('*')
                .order('timestamp', { ascending: false });

            if (error) throw error;
            return { success: true, logs: data };
        } catch (error) {
            console.error('Get logs error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get logs for a specific teacher
     * @param {string} teacherName 
     */
    async getLogsByTeacher(teacherName) {
        try {
            const { data, error } = await supabase
                .from('attendance_logs')
                .select('*')
                .eq('teacher', teacherName)
                .order('timestamp', { ascending: false });

            if (error) throw error;
            return { success: true, logs: data };
        } catch (error) {
            console.error('Get logs by teacher error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update log with transaction hash
     */
    async updateLogTransactionHash(uid, timestamp, txHash) {
        try {
            const { data, error } = await supabase
                .from('attendance_logs')
                .update({ tx_hash: txHash })
                .eq('uid', uid)
                .eq('timestamp', new Date(timestamp).toISOString());

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Update log hash error:', error);
            return { success: false, error: error.message };
        }
    }
}

export default new AttendanceService();
