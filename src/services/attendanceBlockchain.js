import { Contract } from 'ethers';
import web3Service from './web3Service';
import { ATTENDANCE_CONTRACT_ADDRESS, ATTENDANCE_ABI } from '../config/contracts';

// Attendance Blockchain Service
class AttendanceBlockchain {
    constructor() {
        this.contract = null;
    }

    // Get contract instance
    getContract() {
        if (!this.contract) {
            const signer = web3Service.getSigner();
            if (!signer) throw new Error("MetaMask not connected. Please connect your wallet.");
            this.contract = new Contract(ATTENDANCE_CONTRACT_ADDRESS, ATTENDANCE_ABI, signer);
        }
        return this.contract;
    }

    // Mark attendance on blockchain
    async markAttendance(uid, method, location = '--') {
        try {
            const contract = this.getContract();

            // Call the smart contract function with a fallback gas limit
            // This prevents the "No Gas Fees" error in MetaMask when simulation fails
            const tx = await contract.markAttendance(uid, method, location, {
                gasLimit: 300000 // Liberal gas limit for safety
            });

            // 🚀 INSTANT SUBMISSION: Return the transaction object immediately
            // We NO LONGER wait for the receipt here. The UI will handle it in the background.
            return tx;
        } catch (error) {
            // Silently handle user rejection, don't log as an error
            if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
                console.info('[Blockchain] Transaction cancelled by user');
                throw error; // Re-throw so caller knows it was cancelled
            }
            console.error('Error marking attendance on blockchain:', error);
            throw error;
        }
    }

    // NEW: Mark multiple students in a SINGLE blockchain transaction
    async markAttendanceBatch(uids, methods, location = '--') {
        try {
            const contract = this.getContract();

            const code = await contract.runner.provider.getCode(ATTENDANCE_CONTRACT_ADDRESS);
            if (code === '0x') {
                throw new Error("Contract not deployed at the specified address. Please update ATTENDANCE_CONTRACT_ADDRESS in config/contracts.js");
            }

            // Call the batch function in the new contract
            const tx = await contract.markAttendanceBatch(uids, methods, location);

            // Wait for transaction to be mined
            const receipt = await tx.wait();

            return {
                success: true,
                txHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
                count: uids.length
            };
        } catch (error) {
            if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
                console.info('[Blockchain] Batch transaction cancelled by user');
                throw error;
            }
            console.error('Error marking batch attendance on blockchain:', error);
            throw error;
        }
    }

    // Get total records count
    async getRecordsCount() {
        try {
            const contract = this.getContract();
            const count = await contract.getRecordsCount();
            return Number(count);
        } catch (error) {
            console.error('Error getting records count:', error);
            throw error;
        }
    }

    // Get attendance record by index
    async getRecord(index) {
        try {
            const contract = this.getContract();
            const record = await contract.records(index);

            return {
                uid: record.uid,
                method: record.method,
                location: record.location,
                timestamp: Number(record.timestamp)
            };
        } catch (error) {
            console.error('Error getting record:', error);
            throw error;
        }
    }

    // Get all attendance records (Optimized with Parallel Fetching)
    async getAllRecords() {
        try {
            const count = await this.getRecordsCount();

            // Create an array of promises for parallel fetching
            const promises = [];
            for (let i = 0; i < count; i++) {
                promises.push(this.getRecord(i).then(record => ({
                    index: i,
                    ...record
                })));
            }

            // Wait for all records to be fetched in parallel
            const records = await Promise.all(promises);
            return records;
        } catch (error) {
            console.error('Error getting all records:', error);
            throw error;
        }
    }

    // Get user's attendance records
    async getUserRecords(uid) {
        try {
            const allRecords = await this.getAllRecords();
            return allRecords.filter(record => record.uid === uid);
        } catch (error) {
            console.error('Error getting user records:', error);
            throw error;
        }
    }

    // Get Etherscan link for transaction
    getEtherscanLink(txHash) {
        return `https://sepolia.etherscan.io/tx/${txHash}`;
    }

    // Clear contract instance (on disconnect)
    clearContract() {
        this.contract = null;
    }
}

// Export singleton instance
export default new AttendanceBlockchain();
