const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Basic .env.local parser
function loadEnv() {
    const envPath = path.join(__dirname, '..', '.env.local');
    if (!fs.existsSync(envPath)) return {};
    const content = fs.readFileSync(envPath, 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) env[match[1]] = match[2].trim().replace(/^"(.*)"$/, '$1');
    });
    return env;
}

const env = loadEnv();
const API_SECRET = env.PUBLIC_API_SECRET;
const BASE_URL = 'https://api.public.com';

async function diagnose() {
    console.log("--- Public.com API Diagnostic (Standalone JS) ---");
    if (!API_SECRET) {
        console.error("ERROR: PUBLIC_API_SECRET not found in .env.local");
        return;
    }
    console.log("Secret found (length):", API_SECRET.length);

    try {
        console.log("\n1. Requesting Access Token...");
        const tokenRes = await axios.post(`${BASE_URL}/userapiauthservice/personal/access-tokens`, {
            secret: API_SECRET,
            validityInMinutes: 15
        }).catch(e => {
            console.error("Token Request Failed:", e.response?.status, e.response?.data || e.message);
            throw e;
        });

        const token = tokenRes.data.accessToken;
        console.log("SUCCESS: Token obtained.");

        console.log("\n2. Fetching Account Info...");
        const accountRes = await axios.get(`${BASE_URL}/userapigateway/trading/account`, {
            headers: { 'Authorization': `Bearer ${token}` }
        }).catch(e => {
            console.error("Account Fetch Failed:", e.response?.status, e.response?.data || e.message);
            throw e;
        });

        const accounts = accountRes.data.accounts || [];
        console.log(`SUCCESS: Found ${accounts.length} accounts.`);
        if (accounts.length === 0) {
            console.error("No accounts found.");
            return;
        }

        const account = accounts.find(a => a.accountType === 'BROKERAGE') || accounts[0];
        const accountId = account.accountId;
        console.log("Using Account ID:", accountId);

        console.log(`\n3. Fetching Quote for NVDA...`);
        const quoteRes = await axios.post(`${BASE_URL}/userapigateway/marketdata/${accountId}/quotes`, {
            instruments: [{ symbol: 'NVDA', type: 'EQUITY' }]
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        }).catch(e => {
            console.error("Quote Fetch Failed:", e.response?.status, e.response?.data || e.message);
            throw e;
        });

        console.log("SUCCESS: Quote received!");
        console.log(JSON.stringify(quoteRes.data, null, 2));

    } catch (e) {
        console.error("\nDIAGNOSTIC FAILED.");
    }
}

diagnose();
