const express = require('express');
const { MongoClient } = require('mongodb');
const axios = require('axios');
const { Web3 } = require('web3');
require('dotenv').config({ path: '.env' });
const cors = require('cors');

const app = express();
const UPDATE_PRICE_PORT = 3001;
const UPDATE_EXCAHNGE_RATE_PORT = 3001;
const UPDATE_CHECK_WALLET_PORT = 3002;

// Middleware to parse JSON body
app.use(express.json());
app.use(cors());

// List of cryptocurrency symbols
const cryptoSymbols = ["ETH", "BTC", "XMR", "USDT", "BNB", "XRP", "SOL"];

// MongoDB setup
const uri = process.env.MONGODB_CONNECTION;
const dbName = 'DecentraPay';
let db;
let cryptoPricesCollection;
let exchangeRatesCollection;

// Infura setup for Ethereum wallet checking
const INFURA_API_KEY = process.env.INFURA_API_KEY;
console.log(`https://sepolia.infura.io/v3/${INFURA_API_KEY}`);
const web3 = new Web3(`https://sepolia.infura.io/v3/${INFURA_API_KEY}`);

// Connect to MongoDB
async function connectToMongoDB() {
    try {
        const client = await MongoClient.connect(uri);
        db = client.db(dbName);
        cryptoPricesCollection = db.collection('Prices/CryptoPrices');
        exchangeRatesCollection = db.collection('Prices/ExchangeRates');
        console.log('Connected to MongoDB');
    } catch (err) {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    }
}

// Helper function to fetch CoinGecko IDs for crypto symbols
async function getCoinIdsBySymbols(symbols) {
    const hardcodedIds = {
        BTC: "bitcoin",
        ETH: "ethereum",
        USDT: "tether",
        BNB: "binancecoin",
        XMR: "monero",
        XRP: "ripple",
        SOL: "solana",
    };

    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/coins/list');
        const coins = response.data;

        const coinIds = symbols.reduce((acc, symbol) => {
            const lowerSymbol = symbol.toLowerCase();
            const coin = coins.find(c => c.symbol.toLowerCase() === lowerSymbol);
            acc[symbol] = hardcodedIds[symbol] || (coin ? coin.id : null);
            return acc;
        }, {});

        return coinIds;
    } catch (error) {
        console.error('Error fetching coin list:', error);
        throw new Error('Unable to fetch coin IDs');
    }
}

// Function to fetch real-time prices from CoinGecko
async function getCryptoPrices(symbols) {
    const coinIds = await getCoinIdsBySymbols(symbols);
    const idsString = Object.values(coinIds).join(',');

    const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${idsString}&vs_currencies=usd`
    );

    const prices = {};
    for (const [symbol, id] of Object.entries(coinIds)) {
        if (response.data[id] && response.data[id].usd) {
            prices[symbol] = `$${response.data[id].usd.toFixed(2)}`;
        }
    }
    return prices;
}

// Function to update crypto prices in MongoDB
async function updateCryptoPrices() {
    try {
        const prices = await getCryptoPrices(cryptoSymbols);

        const priceEntries = Object.entries(prices).map(([symbol, price]) => ({
            symbol,
            price,
            timestamp: new Date(),
        }));
        await cryptoPricesCollection.insertMany(priceEntries);

        return prices;
    } catch (error) {
        console.error('Error updating crypto prices:', error);
        throw new Error('Unable to update crypto prices');
    }
}

// Function to fetch exchange rates
async function getExchangeRates() {
    const currencies = ["USD", "EUR", "JPY", "GBP", "CNY"];

    try {
        const apiUrl = `https://open.er-api.com/v6/latest/USD`;
        const response = await axios.get(apiUrl);

        if (response.data && response.data.rates) {
            const rates = response.data.rates;
            const filteredRates = {};

            currencies.forEach(currency => {
                if (rates[currency]) {
                    filteredRates[currency] = rates[currency];
                }
            });

            return filteredRates;
        } else {
            throw new Error('Failed to fetch exchange rates');
        }
    } catch (error) {
        console.error('Error fetching exchange rates:', error);
        throw new Error('Unable to fetch exchange rates');
    }
}

// Function to update exchange rates in MongoDB
async function updateExchangeRates() {
    try {
        const rates = await getExchangeRates();

        const rateEntries = Object.entries(rates).map(([currency, rate]) => ({
            currency,
            rate,
            timestamp: new Date(),
        }));
        await exchangeRatesCollection.insertMany(rateEntries);

        return rates;
    } catch (error) {
        console.error('Error updating exchange rates:', error);
        throw new Error('Unable to update exchange rates');
    }
}

// Express endpoint to trigger crypto price update
app.get('/update-prices', async (req, res) => {
    try {
        const prices = await updateCryptoPrices();
        res.json({
            message: 'Crypto prices updated successfully',
            data: prices,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Express endpoint to get exchange rates and save them to MongoDB
app.get('/update-exchange-rates', async (req, res) => {
    try {
        const rates = await updateExchangeRates();
        res.json({
            message: 'Exchange rates updated successfully',
            data: rates,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to check a wallet's content
app.post('/check-wallet', async (req, res) => {
    const { walletAddress } = req.body;

    if (!walletAddress || !web3.utils.isAddress(walletAddress)) {
        return res.status(400).json({ error: 'Invalid or missing Ethereum address' });
    }

    try {
        const balanceWei = await web3.eth.getBalance(walletAddress);
        const balanceEth = web3.utils.fromWei(balanceWei, 'ether');

        const walletDetails = {
            address: walletAddress,
            balance: {
                ETH: {
                    amount: balanceEth,
                },
            },
        };

        res.json(walletDetails);
    } catch (error) {
        console.error('Error checking wallet:', error);
        res.status(500).json({ error: 'Error fetching wallet details' });
    }
});

// Root endpoint
app.get('/', (req, res) => {
    res.send('Welcome to the DecentraPay API. Use /update-prices to update crypto prices, and /update-exchange-rates to update USD exchange rates. Use /check-wallet to fetch wallet details.');
});

// Start the server after MongoDB connection
connectToMongoDB().then(() => {
    app.listen(UPDATE_PRICE_PORT, () => {
        console.log(`Server is running on http://localhost:${UPDATE_PRICE_PORT}`);
    });
});