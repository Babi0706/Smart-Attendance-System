import { supabase } from '../config/supabase';

/**
 * IoT Service for Supabase
 * Handles IoT node operations
 */

class IoTService {
    /**
     * Get all IoT nodes
     * @returns {Promise<Array>} List of IoT nodes
     */
    async getIoTNodes() {
        try {
            const { data, error } = await supabase
                .from('iot_nodes')
                .select('*')
                .order('id', { ascending: true });

            if (error) throw error;
            return { success: true, nodes: data };
        } catch (error) {
            console.error('Get IoT nodes error:', error);
            return { success: false, error: error.message, nodes: [] };
        }
    }

    /**
     * Update IoT node status
     * @param {string} id - Node ID
     * @param {string} status - New status (ONLINE, OFFLINE, MAINTENANCE)
     * @returns {Promise<Object>} Updated node
     */
    async updateNodeStatus(id, status) {
        try {
            const { data, error } = await supabase
                .from('iot_nodes')
                .update({
                    status,
                    last_ping: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return { success: true, node: data };
        } catch (error) {
            console.error('Update node status error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update node signal strength
     * @param {string} id - Node ID
     * @param {number} signal - Signal strength (0-100)
     * @returns {Promise<Object>} Updated node
     */
    async updateNodeSignal(id, signal) {
        try {
            const { data, error } = await supabase
                .from('iot_nodes')
                .update({
                    signal_strength: signal,
                    last_ping: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return { success: true, node: data };
        } catch (error) {
            console.error('Update node signal error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Add new IoT node
     * @param {Object} nodeData - Node data
     * @returns {Promise<Object>} Created node
     */
    async addNode(nodeData) {
        try {
            const { data, error } = await supabase
                .from('iot_nodes')
                .insert([nodeData])
                .select()
                .single();

            if (error) throw error;
            return { success: true, node: data };
        } catch (error) {
            console.error('Add node error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Delete IoT node
     * @param {string} id - Node ID
     * @returns {Promise<Object>} Result
     */
    async deleteNode(id) {
        try {
            const { error } = await supabase
                .from('iot_nodes')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Delete node error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Initialize default IoT nodes if table is empty
     * @returns {Promise<Object>} Result
     */
    async initializeDefaultNodes() {
        try {
            // Check if nodes already exist
            const { count } = await supabase
                .from('iot_nodes')
                .select('*', { count: 'exact', head: true });

            if (count > 0) {
                return { success: true, message: 'Nodes already initialized' };
            }

            // Insert default nodes
            const defaultNodes = [
                { id: 'IOT-01', location: 'Student Plaza', status: 'ONLINE', signal_strength: 95 },
                { id: 'IOT-02', location: 'Library', status: 'ONLINE', signal_strength: 88 },
                { id: 'IOT-03', location: 'Seminar Hall', status: 'ONLINE', signal_strength: 92 },
                { id: 'IOT-04', location: 'Sports Complex', status: 'ONLINE', signal_strength: 85 },
                { id: 'IOT-05', location: 'Auditorium', status: 'ONLINE', signal_strength: 75 },
                { id: 'IOT-06', location: 'Innovation Hub', status: 'ONLINE', signal_strength: 90 }
            ];

            const { data, error } = await supabase
                .from('iot_nodes')
                .insert(defaultNodes)
                .select();

            if (error) throw error;
            return { success: true, nodes: data };
        } catch (error) {
            console.error('Initialize nodes error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send command to IoT node
     * @param {string} id - Node ID
     * @param {string} command - Command string (e.g. START_SCAN, IDLE)
     * @returns {Promise<Object>} Result
     */
    async sendCommand(id, command) {
        try {
            console.log(`[IoTService] Sending command ${command} to ${id}`);
            const { data, error } = await supabase
                .from('iot_nodes')
                .update({ 
                    current_command: command,
                    last_ping: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return { success: true, node: data };
        } catch (error) {
            console.error('Send command error:', error);
            return { success: false, error: error.message };
        }
    }
}

export default new IoTService();
