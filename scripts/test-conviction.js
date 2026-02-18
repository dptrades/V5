
const fetch = require('node-fetch');

async function testConvictionApi(ticker) {
    console.log(`Testing API for ${ticker}...`);
    try {
        const response = await fetch(`http://localhost:3000/api/conviction/${ticker}`);
        if (!response.ok) {
            console.error(`API Error: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error(text);
            return;
        }

        const data = await response.json();
        console.log("Successfully fetched data:");
        console.log("Symbol:", data.symbol);
        console.log("Current Price:", data.analysis.currentPrice);
        console.log("Metrics:", data.analysis.metrics);
        console.log("Timeframes:", data.analysis.timeframes.map(t => ({
            tf: t.timeframe,
            trend: t.trend,
            rsi: t.rsi,
            adx: t.adx
        })));
        console.log("Unusual Options:", data.optionsFlow.length);
        if (data.optionsFlow.length > 0) {
            console.log("Top Option:", data.optionsFlow[0]);
        }
    } catch (error) {
        console.error("Test Failed:", error);
    }
}

// Ensure the server is running before executing this
testConvictionApi('NVDA');
