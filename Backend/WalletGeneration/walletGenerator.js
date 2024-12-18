const express = require('express');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const bitcoin = require('bitcoinjs-lib');
const bip39 = require('bip39');
const { BIP32Factory } = require('bip32'); // Import BIP32 factory
const ecc = require('tiny-secp256k1');     // Required for bip32 factory
const bip32 = BIP32Factory(ecc);           // Initialize bip32 factory

const solanaWeb3 = require('@solana/web3.js');
const rippleKeypairs = require('ripple-keypairs');
const { MoneroWalletFull, MoneroWalletConfig, MoneroNetworkType } = require('monero-ts');
const { MongoClient } = require('mongodb'); // MongoDB Library

const app = express();
const GENERATE_WALLET_PORT = 3100;
const NETWORK = bitcoin.networks.bitcoin; // Mainnet network

// MongoDB Setup
const uri = process.env.MONGODB_CONNECTION; // Local MongoDB
const dbName = 'DecentraPay'; // Database name
let db;
let walletsCollection;

async function connectToMongoDB() {
    try {
        const client = await MongoClient.connect(uri);
        db = client.db(dbName);
        walletsCollection = db.collection('wallets');
        console.log('Connected to MongoDB');
    } catch (err) {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    }
}

// Connect to MongoDB
connectToMongoDB();

// Serve static files (including index.html)
app.use(express.static(path.join(__dirname, '')));

// Route to serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '', 'index.html'));
});

// Wallet Generators
const WalletGenerators = {
    ethereum: () => {
        const wallet = ethers.Wallet.createRandom();
        return {
            address: wallet.address,
            privateKey: wallet.privateKey,
            currency: 'ETH',
        };
    },
    bitcoin: () => {
        const mnemonic = bip39.generateMnemonic(); // Generate mnemonic
        const seed = bip39.mnemonicToSeedSync(mnemonic); // Generate seed
        const root = bip32.fromSeed(seed, NETWORK); // Create root from seed

        // Derive account path
        const account = root.derivePath("m/44'/0'/0'/0/0");

        // Convert pubkey to Buffer to ensure compatibility
        const { address } = bitcoin.payments.p2pkh({
            pubkey: Buffer.from(account.publicKey),
            network: NETWORK,
        });

        return {
            address,
            privateKey: account.toWIF(), // Export WIF format private key
            mnemonic,                    // Export mnemonic for recovery
            currency: 'BTC',
        };
    },
    solana: () => {
        const keypair = solanaWeb3.Keypair.generate();
        return {
            address: keypair.publicKey.toString(),
            privateKey: Buffer.from(keypair.secretKey).toString('hex'),
            currency: 'SOL',
        };
    },
    xrp: () => {
        const seed = rippleKeypairs.generateSeed();
        const { publicKey, privateKey } = rippleKeypairs.deriveKeypair(seed);
        const address = rippleKeypairs.deriveAddress(publicKey);
        return {
            address,
            privateKey,
            currency: 'XRP',
        };
    },
    monero: async () => {
        const walletConfig = new MoneroWalletConfig()
            .setPath('temp_wallet')
            .setPassword('')
            .setLanguage('English')
            .setNetworkType(MoneroNetworkType.MAINNET);

        const wallet = await MoneroWalletFull.createWalletRandom(walletConfig);
        const address = await wallet.getPrimaryAddress();
        const privateViewKey = await wallet.getPrivateViewKey();

        return {
            address,
            privateViewKey,
            currency: 'XMR',
        };
    },
    bnb: () => {
        const wallet = ethers.Wallet.createRandom();
        return {
            address: wallet.address,
            privateKey: wallet.privateKey,
            currency: 'BNB',
        };
    },
    usdt: () => {
        const wallet = ethers.Wallet.createRandom();
        return {
            address: wallet.address,
            privateKey: wallet.privateKey,
            currency: 'USDT (ERC20)',
        };
    },
};

app.get('/generate-wallet/:type', async (req, res) => {
    const walletType = req.params.type.toLowerCase();

    if (!WalletGenerators[walletType]) {
        return res.status(400).json({ error: `Wallet type "${walletType}" not supported` });
    }

    try {
        const wallet =
            walletType === 'monero' ? await WalletGenerators[walletType]() : WalletGenerators[walletType]();

        const timestamp = Date.now();
        const randomID = Math.random().toString(36).substr(2, 9);
        const walletPath = `Wallets/${wallet.currency}/${randomID}`;
        const walletData = {
            ...wallet,
            createdAt: new Date(),
            path: walletPath,
        };

        // Save to file
        const filename = `${walletType}_wallet_${timestamp}.json`;

        // Save to MongoDB
        await walletsCollection.insertOne({
            _id: randomID,
            currency: wallet.currency,
            address: wallet.address,
            privateKey: wallet.privateKey || null,
            path: walletPath,
            createdAt: new Date(),
        });

        res.status(200).json({
            message: `${walletType} wallet generated successfully`,
            wallet: walletData,
        });
    } catch (error) {
        console.error(`Error generating ${walletType} wallet:`, error);
        res.status(500).json({ error: 'Failed to generate wallet' });
    }
});

// Server Setup
app.listen(GENERATE_WALLET_PORT, () => {
    console.log(`Server is running on http://localhost:${GENERATE_WALLET_PORT}`);
    console.log('Use /generate-wallet/{type} to generate a wallet (e.g., /generate-wallet/ethereum)');
});
