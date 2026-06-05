// Sepolia Network Configuration
export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_RPC_URL = "https://sepolia.infura.io/v3/YOUR_INFURA_KEY"; // Users can use MetaMask's default

// Contract Addresses on Sepolia
// IMPORTANT: Update this after deploying AttendanceBatch.sol
export const ATTENDANCE_CONTRACT_ADDRESS = "0xeB51c242fD2B041854fF8893De6D6c11152b35b3";

// Attendance Contract ABI (Updated for Batch)
export const ATTENDANCE_ABI = [
    {
        "inputs": [],
        "name": "getRecordsCount",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "string", "name": "_uid", "type": "string" },
            { "internalType": "string", "name": "_method", "type": "string" },
            { "internalType": "string", "name": "_location", "type": "string" }
        ],
        "name": "markAttendance",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "string[]", "name": "_uids", "type": "string[]" },
            { "internalType": "string[]", "name": "_methods", "type": "string[]" },
            { "internalType": "string", "name": "_location", "type": "string" }
        ],
        "name": "markAttendanceBatch",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "name": "records",
        "outputs": [
            { "internalType": "string", "name": "uid", "type": "string" },
            { "internalType": "string", "name": "method", "type": "string" },
            { "internalType": "string", "name": "location", "type": "string" },
            { "internalType": "uint256", "name": "timestamp", "type": "uint256" }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];
