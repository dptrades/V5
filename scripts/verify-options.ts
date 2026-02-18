import { publicClient } from '../lib/public-api';

async function verifyOptions() {
    console.log('🚀 Starting Advanced Public.com Options Verification...');

    if (!publicClient.isConfigured()) {
        console.error('❌ Public.com API is NOT configured. Check PUBLIC_API_SECRET in .env.local');
        return;
    }

    const TEST_SYMBOL = 'AAPL';

    try {
        console.log('\n--- 0. Checking Connection & Auth ---');
        // @ts-ignore - accessing private for debugging
        console.log('API Key present:', !!publicClient.apiKey);
        // @ts-ignore - accessing private for debugging
        console.log('API Secret present:', !!publicClient.apiSecret);

        // 1. Check Quote
        console.log(`\n--- 1. Testing Stock Quote for ${TEST_SYMBOL} ---`);
        const quote = await publicClient.getQuote(TEST_SYMBOL);
        if (quote) {
            console.log('✅ Quote Success:', JSON.stringify(quote, null, 2));
        } else {
            console.log('❌ Quote Failed (check logs above).');
        }

        // 2. Check Expirations
        console.log(`\n--- 2. Testing Option Expirations for ${TEST_SYMBOL} ---`);
        const expirations = await publicClient.getOptionExpirations(TEST_SYMBOL);
        if (expirations && expirations.length > 0) {
            console.log(`✅ Found ${expirations.length} expirations.`);
            console.log(`First 3: ${expirations.slice(0, 3).join(', ')}`);

            const targetExp = expirations[0];

            // 3. Check Option Chain
            console.log(`\n--- 3. Testing Option Chain for ${TEST_SYMBOL} on ${targetExp} ---`);
            const chain = await publicClient.getOptionChain(TEST_SYMBOL);
            if (chain && chain.options[targetExp]) {
                const strikes = Object.keys(chain.options[targetExp]);
                console.log(`✅ Chain Success. Found ${strikes.length} strikes for ${targetExp}.`);

                const middleStrike = strikes[Math.floor(strikes.length / 2)];
                const optData = chain.options[targetExp][parseFloat(middleStrike)];

                console.log(`Sample Strike ${middleStrike}:`, JSON.stringify(optData, null, 2));

                if (optData.call) {
                    // 4. Check Greeks
                    console.log(`\n--- 4. Testing Greeks for ${optData.call.symbol} ---`);
                    const greeks = await publicClient.getGreeks(optData.call.symbol);
                    if (greeks) {
                        console.log('✅ Greeks Success:', JSON.stringify(greeks, null, 2));
                    } else {
                        console.log('❌ Greeks Failed or Not Available.');
                    }
                }
            } else {
                console.log('❌ Chain Failed or No Data for Expiration.');
            }
        } else {
            console.log('❌ No Expirations found.');
        }

    } catch (e) {
        console.error('💥 Verification Crashed:', e);
    }
}

verifyOptions();
