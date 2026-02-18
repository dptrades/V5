const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance(); // Instantiate!

async function testOptions() {
    try {
        console.log("Fetching NVDA options...");
        const result = await yahooFinance.options('NVDA', {}); // Empty options or precise date
        console.log("Result keys:", Object.keys(result));
        if (result.options && result.options.length > 0) {
            const chain = result.options[0];
            console.log("Expiry:", chain.expirationDate);
            console.log("Calls:", chain.calls.length);
            console.log("Puts:", chain.puts.length);
            // Sample Call
            if (chain.calls.length > 0) {
                console.log("Sample Call:", chain.calls[0]);
            }
        } else {
            console.log("No options data found.");
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

testOptions();
