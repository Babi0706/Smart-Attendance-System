# Deployment Guide: AttendanceBatch Smart Contract

To fix the **"Contract not deployed"** error and enable high-speed batch attendance, you must deploy the `AttendanceBatch.sol` smart contract to the Sepolia Test Network.

## Step 1: Open Remix IDE
1.  Go to [Remix Ethereum IDE](https://remix.ethereum.org/).
2.  Create a new file named `AttendanceBatch.sol`.
3.  Copy and paste the contents of your local `AttendanceBatch.sol` file into Remix.

## Step 2: Compile the Contract
1.  Click on the **Solidity Compiler** tab (the second icon on the left sidebar).
2.  Ensure the compiler version is `0.8.0` or higher.
3.  Click **Compile AttendanceBatch.sol**.

## Step 3: Deploy to Sepolia
1.  Click on the **Deploy & Run Transactions** tab (the third icon on the left sidebar).
2.  In the **Environment** dropdown, select **Injected Provider - MetaMask**.
3.  Ensure your MetaMask is connected and switched to the **Sepolia Test Network**.
4.  Select `AttendanceBatch` from the contract dropdown.
5.  Click **Deploy**.
6.  Confirm the transaction in MetaMask (you will need some Sepolia ETH).

## Step 4: Update Your Project
1.  Once the transaction is confirmed, copy the **Contract Address** from the "Deployed Contracts" section in Remix.
2.  Open your project's `src/config/contracts.js` file.
3.  Replace the value of `ATTENDANCE_CONTRACT_ADDRESS` with your new contract address:

```javascript
export const ATTENDANCE_CONTRACT_ADDRESS = "0xYOUR_NEW_CONTRACT_ADDRESS_HERE";
```

## Step 5: Refresh the App
1.  Return to your Smart Attendance app.
2.  Reconnect your wallet.
3.  The "Contract not deployed" error should disappear, and you can now sync attendance records to the blockchain!

---

> [!TIP]
> **Why are my old records missing from the Ledger Explorer?**
> The Ledger Explorer only shows records stored inside the smart contract itself. Since your previous records from March 16th were only saved to the database (and not the blockchain), they won't appear in the horizontal scroll list until you mark new attendance on the new contract.
