import { BrowserProvider } from 'ethers';
import { SEPOLIA_CHAIN_ID } from '../config/contracts';

// Web3 Service for MetaMask connection and provider management
class Web3Service {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.account = null;
    }

    // Check if MetaMask is installed
    isMetaMaskInstalled() {
        return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
    }

    // Connect to MetaMask wallet
    async connectWallet(forceAccountSelection = false) {
        if (!this.isMetaMaskInstalled()) {
            throw new Error('MetaMask is not installed! Please install MetaMask extension.');
        }

        try {
            // If forced, request permissions specifically to prompt for account selection
            if (forceAccountSelection) {
                await window.ethereum.request({
                    method: 'wallet_requestPermissions',
                    params: [{ eth_accounts: {} }]
                });
            }

            // Request account access
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });

            this.account = accounts[0];
            this.provider = new BrowserProvider(window.ethereum);
            this.signer = await this.provider.getSigner();

            // Clear manual disconnect flag upon successful connection
            this.setManualDisconnect(false);

            // Switch to Sepolia if not already on it
            await this.switchToSepolia();

            return this.account;
        } catch (error) {
            console.error('Error connecting wallet:', error);
            throw error;
        }
    }

    // Switch to Sepolia network
    async switchToSepolia() {
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: `0x${SEPOLIA_CHAIN_ID.toString(16)}` }],
            });
        } catch (switchError) {
            // This error code indicates that the chain has not been added to MetaMask
            if (switchError.code === 4902) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: `0x${SEPOLIA_CHAIN_ID.toString(16)}`,
                            chainName: 'Sepolia Test Network',
                            nativeCurrency: {
                                name: 'SepoliaETH',
                                symbol: 'ETH',
                                decimals: 18
                            },
                            rpcUrls: ['https://sepolia.infura.io/v3/'],
                            blockExplorerUrls: ['https://sepolia.etherscan.io/']
                        }],
                    });
                } catch (addError) {
                    throw new Error('Failed to add Sepolia network to MetaMask');
                }
            } else {
                throw switchError;
            }
        }
    }

    // Get current provider
    getProvider() {
        if (!this.provider) {
            throw new Error('Provider not initialized. Please connect wallet first.');
        }
        return this.provider;
    }

    // Get signer for transactions
    getSigner() {
        if (!this.signer) {
            throw new Error('Signer not initialized. Please connect wallet first.');
        }
        return this.signer;
    }

    // Get connected account
    getAccount() {
        return this.account;
    }

    // Check if wallet is connected
    isConnected() {
        return this.account !== null;
    }

    // Disconnect wallet
    disconnect() {
        this.provider = null;
        this.signer = null;
        this.account = null;
    }

    // Manual disconnect persistence
    setManualDisconnect(value) {
        if (value) {
            localStorage.setItem('wallet_manual_disconnect', 'true');
        } else {
            localStorage.removeItem('wallet_manual_disconnect');
        }
    }

    isManualDisconnect() {
        return localStorage.getItem('wallet_manual_disconnect') === 'true';
    }

    // Listen for account changes
    onAccountsChanged(callback) {
        if (typeof window !== 'undefined' && this.isMetaMaskInstalled()) {
            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length === 0) {
                    this.disconnect();
                } else {
                    this.account = accounts[0];
                }
                callback(accounts);
            });
        }
    }

    // Listen for chain changes
    onChainChanged(callback) {
        if (typeof window !== 'undefined' && this.isMetaMaskInstalled()) {
            window.ethereum.on('chainChanged', (chainId) => {
                callback(chainId);
                // Reload page on chain change (recommended by MetaMask)
                window.location.reload();
            });
        }
    }
}

// Export singleton instance
export default new Web3Service();
