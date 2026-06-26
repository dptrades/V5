import path from 'path';
import fs from 'fs';
import fetch from 'node-fetch';

// Load environment variables from .env.local
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^#\s][^=]*)=["']?(.*?)["']?$/);
        if (match) {
            process.env[match[1]] = match[2];
        }
    });
}

import { generateSignal } from '../components/AIAnalysisWidget';

async function verifyTicker(symbol: string) {
    console.log(`\n==================================================`);
    console.log(`🔍 VERIFYING TICKER: ${symbol}`);
    console.log(`==================================================`);

    try {
        const url = `http://localhost:3000/api/conviction/${symbol}?refresh=true`;
        console.log(`Fetching latest market data from local API...`);
        const res = await fetch(url);
        if (!res.ok) {
            console.error(`❌ Failed to fetch API for ${symbol}: ${res.status} ${res.statusText}`);
            return;
        }

        const data = await res.json() as any;
        console.log(`✅ Fetched data successfully!`);
        console.log(`Current Price: $${data.displayPrice.toFixed(2)}`);

        console.log(`Running generateSignal with latest market variables...`);
        const result = generateSignal(symbol, data.analysis, data.optionsFlow, data.fundamentals);

        console.log(`\n--- ENGINE OUTPUT ASSESSMENT ---`);
        console.log(`Signal:            ${result.signal}`);
        console.log(`Score:             ${result.score}/10`);
        console.log(`Execution Action:  ${result.executionAction}`);
        console.log(`Market Regime:     ${result.regime}`);
        console.log(`Entry Price Zone:  $${result.entryPrice.toFixed(2)}`);
        console.log(`Target Price:      $${result.targetPrice.toFixed(2)}`);
        console.log(`Stop Loss:         $${result.stopLoss.toFixed(2)}`);
        console.log(`Risk-to-Reward:    ${result.rrRatio.toFixed(2)}:1`);
        console.log(`Options Strategy:  ${result.optionStrategy}`);
        console.log(`Entry Reason:      "${result.entryReason}"`);

        console.log(`\n--- TECHNICAL DETAILS ---`);
        console.log(`1. EMAs:`);
        result.techDetails.emas.forEach(e => console.log(`   [${e.sentiment.toUpperCase()}] ${e.text}`));
        console.log(`2. RSIs:`);
        result.techDetails.rsi.forEach(r => console.log(`   [${r.sentiment.toUpperCase()}] ${r.text}`));
        console.log(`3. Bollinger Bands:`);
        console.log(`   [${result.techDetails.bb.sentiment.toUpperCase()}] ${result.techDetails.bb.text}`);
        console.log(`4. Fair Value Gap:`);
        console.log(`   [${result.techDetails.fvg.sentiment.toUpperCase()}] ${result.techDetails.fvg.text}`);
        console.log(`5. Options Flow:`);
        console.log(`   [${result.techDetails.options.sentiment.toUpperCase()}] ${result.techDetails.options.text}`);

    } catch (error: any) {
        console.error(`❌ Error verifying ${symbol}:`, error.message);
    }
}

async function run() {
    const tickers = ['TSLA', 'AMD', 'NVDA'];
    for (const ticker of tickers) {
        await verifyTicker(ticker);
    }
}

run();
