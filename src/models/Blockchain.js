import { getCurrentTimestamp } from '../utils/constants';

export class Block {
    constructor(index, timestamp, data, previousHash = '') {
        this.index = index;
        this.timestamp = timestamp;
        this.data = data;
        this.previousHash = previousHash;
        this.hash = this.calculateHash();
        this.nonce = 0;
    }
    calculateHash() {
        return (this.index + this.previousHash + this.timestamp + JSON.stringify(this.data) + this.nonce)
            .split('').reduce((a, b) => {
                a = ((a << 5) - a) + b.charCodeAt(0);
                return a & a;
            }, 0).toString(16).replace('-', 'x').toUpperCase().padStart(16, '0');
    }
}

export class Blockchain {
    constructor() {
        this.chain = [new Block(0, getCurrentTimestamp(), "Genesis Block", "0")];
    }
    getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }
    addBlock(newBlock) {
        newBlock.previousHash = this.getLatestBlock().hash;
        newBlock.hash = newBlock.calculateHash();
        this.chain.push(newBlock);
    }
}
