import { env } from './env';

const BASE_URL = 'https://paper-api.alpaca.markets/v2';
const DATA_URL = 'https://data.alpaca.markets/v2';

// Rate-limit protection
let alpacaThrottledUntil = 0;

export interface AlpacaBar {
    t: string; // Timestamp
    o: number; // Open
    h: number; // High
    l: number; // Low
    c: number; // Close
    v: number; // Volume
}

export async function fetchAlpacaBars(symbol: string, timeframe: '1Day' | '1Hour' | '15Min' = '1Day', limit: number = 100): Promise<AlpacaBar[]> {
    // Check rate-limit cooldown
    if (Date.now() < alpacaThrottledUntil) {
        console.warn(`[Alpaca] Rate limit cool-down active. Skipping ${symbol} ${timeframe}.`);
        return [];
    }
    // Fallback to provided keys if env vars fail
    const apiKey = env.ALPACA_API_KEY;
    const apiSecret = env.ALPACA_API_SECRET;

    if (!apiKey || !apiSecret) {
        console.warn(`[Alpaca] Missing Keys for ${symbol}`);
        return [];
    }

    try {
        // Correct Logic: Request a time window, but ensure API limit is high enough to capture ALL bars in that window.
        // We want the LATEST 'limit' bars.

        // Estimate bars per day based on timeframe to calculate a reasonable start date
        let barsPerDay = 1;
        if (timeframe === '1Hour') barsPerDay = 7; // 9:30 - 4:00
        else if (timeframe === '15Min') barsPerDay = 26;
        else if (timeframe === '10Min' as any) barsPerDay = 39;
        else if (timeframe === '1Week' as any) barsPerDay = 0.2; // 1 bar per week

        // Calculate days back needed ~ (limit / barsPerDay) * 3.0 (Increased from 1.5 to handle IEX data gaps)
        // Example: 1000 1h bars -> 1000/7 = 142 days -> *3.0 = 426 days back.
        const daysBack = Math.ceil((limit / barsPerDay) * 3.0) + 15;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);
        const startIso = startDate.toISOString();

        // 2. Request limit * 2 (buffer) to ensure we cover the period.
        // We just need enough to return 'limit' bars at the end.
        const apiLimit = Math.min(10000, limit * 3);

        let url = `${DATA_URL}/stocks/${symbol}/bars?timeframe=${timeframe}&limit=${apiLimit}&start=${startIso}&adjustment=raw&feed=iex`;

        // extended_hours is only valid for intraday timeframes
        // if (timeframe !== '1Day') {
        //    url += '&extended_hours=true';
        // }

        console.log(`[Alpaca] Fetching ${url}`);

        const response = await fetch(url, {
            headers: {
                'APCA-API-KEY-ID': apiKey,
                'APCA-API-SECRET-KEY': apiSecret,
                'Content-Type': 'application/json'
            },
            cache: 'no-store'
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Alpaca] Error ${response.status}: ${errorText}`);
            if (response.status === 429) {
                alpacaThrottledUntil = Date.now() + (30 * 1000);
                console.error('[Alpaca] 🛑 Rate limit hit (429). Cooldown 30s.');
            }
            return [];
        }

        const data = await response.json();
        const allBars = data.bars || [];

        // 3. Return only the requested number of LATEST bars
        return allBars.slice(-limit);
    } catch (e) {
        console.error("Failed to fetch Alpaca bars:", e);
        return [];
    }
}

export async function fetchAlpacaPrice(symbol: string): Promise<number | null> {
    if (Date.now() < alpacaThrottledUntil) {
        console.warn(`[Alpaca] Rate limit cool-down active. Skipping price for ${symbol}.`);
        return null;
    }
    const apiKey = env.ALPACA_API_KEY;
    const apiSecret = env.ALPACA_API_SECRET;

    if (!apiKey || !apiSecret) return null;

    try {
        const url = `${DATA_URL}/stocks/${symbol}/quotes/latest?feed=iex`;

        const response = await fetch(url, {
            headers: {
                'APCA-API-KEY-ID': apiKey,
                'APCA-API-SECRET-KEY': apiSecret
            },
            cache: 'no-store'
        });

        if (!response.ok) {
            if (response.status === 429) {
                alpacaThrottledUntil = Date.now() + (30 * 1000);
                console.error('[Alpaca] 🛑 Rate limit hit (429). Cooldown 30s.');
            }
            return null;
        }

        const data = await response.json();
        // Return mid-price or last trade if quote is empty
        if (data.quote && data.quote.ap && data.quote.bp) {
            return (data.quote.ap + data.quote.bp) / 2;
        }
        return null;
    } catch (e) {
        console.error("Failed to fetch Alpaca price:", e);
        return null;
    }
}
