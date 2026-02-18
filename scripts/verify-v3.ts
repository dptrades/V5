import path from 'path';
import fs from 'fs';

// Manual env loading for standalone script
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#\s][^=]*)=["']?(.*?)["']?$/);
    if (match) {
        process.env[match[1]] = match[2];
    }
});

import { fetchMultiTimeframeAnalysis } from '../lib/market-data';
import { generateOptionSignal } from '../lib/options';
import { schwabClient } from '../lib/schwab';

async function verifyV3() {
    const symbol = 'TSLA';
    console.log(`\n--- V3 Verification Started for ${symbol} ---\n`);

    try {
        console.log(`[1/2] Fetching Multi-Timeframe Analysis...`);
        console.log(`Schwab Configured: ${schwabClient.isConfigured()}`);
        const analysis = await fetchMultiTimeframeAnalysis(symbol, true);

        if (analysis) {
            console.log(`✅ Success! Data Source: ${analysis.dataSource}`);
            console.log(`Current Price: $${analysis.currentPrice}`);
            console.log(`Timeframes found: ${analysis.timeframes.map(t => t.timeframe).join(', ')}`);

            const daily = analysis.timeframes.find(t => t.timeframe === '1d');
            if (daily) {
                console.log(`Daily RSI: ${daily.rsi?.toFixed(2)}`);
                console.log(`Daily EMA200: $${daily.ema200?.toFixed(2)}`);
            }

            console.log(`\n[2/2] Generating Options Signal...`);
            const optSignal = await generateOptionSignal(
                analysis.currentPrice,
                analysis.metrics.atr,
                analysis.timeframes.find(t => t.timeframe === '1d')?.trend.toLowerCase() as any || 'neutral',
                analysis.timeframes.find(t => t.timeframe === '1d')?.rsi || 50,
                analysis.timeframes.find(t => t.timeframe === '1d')?.ema50 || undefined,
                undefined, // indicators
                symbol
            );

            console.log(`✅ Options Signal: ${optSignal.type} at $${optSignal.strike}`);
            console.log(`Confidence: ${optSignal.confidence}%`);
            console.log(`Contract Price: $${optSignal.contractPrice}`);
            console.log(`Greeks (Delta): ${optSignal.probabilityITM}`);
        } else {
            console.error('❌ Failed to fetch analysis.');
        }

    } catch (error: any) {
        console.error('❌ Verification Error:', error.message);
    }
}

verifyV3();
