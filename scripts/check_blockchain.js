
import { ethers } from 'ethers';

const RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";
const CONTRACT_ADDRESS = "0xf8e81D47203A594245E36C48e151709F0C19fBe8";
const ABI = [
    {
        "inputs": [],
        "name": "getRecordsCount",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
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

async function checkBlockchain() {
    console.log("Connecting to Sepolia via DRPC...");
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    try {
        const count = await contract.getRecordsCount();
        console.log(`Total Records on Blockchain: ${count}`);

        if (count > 0) {
            console.log("\nRecent 3 records:");
            for (let i = Number(count) - 1; i >= Math.max(0, Number(count) - 3); i--) {
                const r = await contract.records(i);
                console.log(`${i}. UID: ${r.uid}, Location: ${r.location}, Method: ${r.method}, Time: ${new Date(Number(r.timestamp) * 1000).toLocaleString()}`);
            }
        }
    } catch (err) {
        console.error("Error:", err.message);
    }
}

checkBlockchain();
