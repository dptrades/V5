
import { publicClient } from './lib/public-api';

async function checkTsla() {
    const symbol = 'TSLA';
    const quote = await publicClient.getQuote(symbol);
    console.log(`Current ${symbol} Price:`, quote?.price);

    const chain = await publicClient.getOptionChain(symbol);
    if (chain) {
        console.log('Available Expirations:', chain.expirations.slice(0, 3));
        const firstExp = chain.expirations[0];
        const optionsAtFirstExp = chain.options[firstExp];

        // Let's find the 160 strike if it exists
        if (optionsAtFirstExp[160]) {
            console.log('Data for $160 Strike:', optionsAtFirstExp[160]);
        } else {
            console.log('Strike $160 not found in the first expiration.');
        }
    }
}

checkTsla();
