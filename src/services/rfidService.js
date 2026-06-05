import mqtt from 'mqtt';
import { supabase } from '../config/supabase'; // Kept in case you still need to log raw scans

/**
 * RFID Service (MQTT Version)
 * Listens for physical RFID scans and sends commands instantly via MQTT
 */
class RfidService {
    constructor() {
        this.callbacks = [];
        this.client = null;
        this.isConnected = false;
        this.nodeId = 'IOT-01'; // Default, can be overridden

        // MQTT Configuration
        this.brokerUrl = 'wss://broker.hivemq.com:8884/mqtt';
        this.topicCmd = 'iot/node1/cmd';
        this.topicScan = 'iot/node1/scan';
        this.topicFeedback = 'iot/node1/feedback';
        
        this.initMQTT();
    }

    initMQTT() {
        console.log('[RfidService] Initializing MQTT Connection...');
        this.client = mqtt.connect(this.brokerUrl);

        this.client.on('connect', () => {
            console.log('[RfidService] ✅ CONNECTED TO MQTT BROKER');
            this.isConnected = true;
            
            // Subscribe to incoming RFID scans
            this.client.subscribe(this.topicScan, (err) => {
                if (!err) console.log(`[RfidService] Subscribed to ${this.topicScan}`);
                else console.error('[RfidService] Subscribe Error:', err);
            });
        });

        this.client.on('message', (topic, message) => {
            if (topic === this.topicScan) {
                const scannedUid = message.toString().toUpperCase().trim();
                console.log('[RfidService] ⚡ INSTANT SCAN RECEIVED:', scannedUid);
                
                // Notify all React components waiting for a scan
                this.callbacks.forEach(cb => {
                    try { 
                        cb({ uid: scannedUid, node_id: this.nodeId, method: 'MQTT' }); 
                    } catch(e) { 
                        console.error('Callback error:', e); 
                    }
                });
            }
        });

        this.client.on('error', (err) => {
            console.error('[RfidService] MQTT Connection Error:', err);
            this.isConnected = false;
        });

        this.client.on('offline', () => {
            this.isConnected = false;
        });
    }

    /**
     * Send Feedback to the hardware LCD (SUCCESS or FAIL)
     */
    sendFeedback(status) {
        if (!this.isConnected) {
            console.warn('[RfidService] MQTT not connected. Cannot send feedback!');
            return;
        }
        
        console.log(`[RfidService] 📡 Sending Feedback: ${status}`);
        this.client.publish(this.topicFeedback, status, (err) => {
            if (err) console.error('[RfidService] Failed to publish feedback:', err);
        });
    }

    /**
     * Subscribe React components to real-time RFID scans
     * @param {Function} onScan - Callback function when a new scan is detected
     */
    subscribeToScans(onScan) {
        if (!onScan) return;
        
        this.callbacks.push(onScan);
        console.log(`[RfidService] Listener added. Total: ${this.callbacks.length}`);

        // Return a cleanup function for React useEffect
        return () => this.unsubscribe(onScan);
    }

    /**
     * Unsubscribe a specific listener
     */
    unsubscribe(onScan) {
        if (!onScan) {
            this.callbacks = []; // Clear all if no specific callback provided
            return;
        }

        this.callbacks = this.callbacks.filter(cb => cb !== onScan);
        console.log(`[RfidService] Listener removed. Remaining: ${this.callbacks.length}`);
    }

    /**
     * Send a command to the IoT node to start scanning
     * Instantly triggers the ESP8266 via MQTT
     */
    async triggerScan(nodeId) {
        if (nodeId) this.nodeId = nodeId;
        
        console.log(`[RfidService] 🚀 Triggering scan via MQTT...`);
        
        if (!this.isConnected) {
            console.warn('[RfidService] MQTT not connected. Cannot send trigger!');
            return;
        }

        // Publish the command instantly
        this.client.publish(this.topicCmd, 'START_SCAN', (err) => {
            if (err) console.error('[RfidService] Failed to publish START_SCAN:', err);
            else console.log('[RfidService] START_SCAN published successfully!');
        });
    }
}

export default new RfidService();
