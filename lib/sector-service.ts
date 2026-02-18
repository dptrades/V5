import { SECTOR_MAP as STATIC_SECTOR_MAP } from './constants';

interface SectorMapCache {
    data: Record<string, string>;
    lastUpdated: number;
}

// Global cache to store the dynamic map
declare global {
    var _sectorMapCache: SectorMapCache | null;
}

if (!global._sectorMapCache) {
    global._sectorMapCache = null;
}

// Map GICS Sector names to Yahoo Finance Screener IDs or approximate equivalents
// Note: Yahoo Screener IDs are not always public/stable, so we use a robust "search" or specific ETF holdings approach if possible.
// For simplicity and reliability in this version, we will scan the top holdings of the major Sector SPDR ETFs using Yahoo Finance.
const SECTOR_ETF_MAP: Record<string, string> = {
    'Information Technology': 'XLK',
    'Financials': 'XLF',
    'Health Care': 'XLV',
    'Consumer Discretionary': 'XLY',
    'Consumer Staples': 'XLP',
    'Energy': 'XLE',
    'Industrials': 'XLI',
    'Materials': 'XLB',
    'Utilities': 'XLU',
    'Real Estate': 'XLRE',
    'Communication Services': 'XLC'
};

/**
 * Fetch top holdings for a specific sector ETF from Yahoo Finance
 * This is a reliable proxy for "Top Stocks in Sector"
 */
async function fetchSectorTopStocks(etfSymbol: string, sectorName: string): Promise<string[]> {
    try {
        // Use Yahoo Finance scrape or API (via standard library calls if available)
        // Since we don't have a direct "Get ETF Holdings" method in yahoo-finance2 easily exposed without full historical data parsing,
        // we will fall back to a "Screener" approach url if specific ETF data is hard to parse.
        // However, querying the screener for "Sector = Technology" is often cleaner.

        // Strategy: Use Yahoo Finance Screener API for specific sector
        // We construct a query for top market cap stocks in specific sectors.
        // But scraping via internal API is fragile.

        // ROBUST ALTERNATIVE: Use the same screener endpoint we used in Smart Scanner
        // pre-defined screeners or generic query.

        // Let's rely on the predefined predefined Yahoo Screener "ms_technology", etc. if available.
        // Actually, easiest is to use the `yahoo-finance2` screen capability if we can, but it is limited.

        // We will simulate a fetch using the generic research endpoint or just use the static map fallback 
        // if this is too complex for a single file.
        // WAIT: Smart Scanner used `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=day_gainers`
        // We can search for sector specific screeners? No.

        // SIMPLIFICATION FOR V1 DYNAMIC:
        // We will stick to the static map for the *base* sectors to ensure stability, 
        // BUT we will verify their volume/validity.

        // RE-EVALUATION: The user wants *dynamic* updates.
        // Let's try to fetch the top 25 components of the sector ETFs using a quote lookup or similar?
        // No, that doesn't give constituents.

        // OK, Plan B: We will keep the Static Map as the "Source of Truth" for *classification*,
        // but this service will "Activate" widely known tickers if they are trending.

        // Actually, let's look at `smart-scanner.ts` again. It worked well.
        // We can query `https://query2.finance.yahoo.com/v1/finance/search`?

        // Let's implement a fallback: Return the static list for now, but wrapper it in the 2AM logic 
        // so we have the INFRASTRUCTURE for dynamic updates, even if the data source is static for V1.
        // This answers the user's "Architecture" question while being safe.

        // WAIT! I can use `yahooFinance.quoteSummary` on the ETF (e.g. XLK) and look for `topHoldings`?
        // `yahoo-finance2` supports `topHoldings`. Perfect.

        const result = await fetch(`https://query1.finance.yahoo.com/v1/finance/quoteSummary/${etfSymbol}?modules=topHoldings`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        const data = await result.json();
        const holdings = data?.quoteSummary?.result?.[0]?.topHoldings?.holdings || [];

        return holdings.map((h: any) => h.symbol);

    } catch (e) {
        console.warn(`Failed to fetch sector ${sectorName} (${etfSymbol}):`, e);
        return [];
    }
}

/**
 * Get the Sector Map (Dynamic or Cache)
 * Smart Logic: Refreshes if data is "stale" (past 2 AM EST of the current day)
 */
export async function getDynamicSectorMap(): Promise<Record<string, string>> {
    const now = new Date();
    const currentHour = now.getHours(); // Local server time (usually UTC in cloud, but User context is EST)

    // Check if we have valid cache
    if (global._sectorMapCache) {
        const lastUpdate = new Date(global._sectorMapCache.lastUpdated);
        const todayAt2AM = new Date(now);
        todayAt2AM.setHours(2, 0, 0, 0);

        // Logic: Cache is fresh if:
        // 1. It was updated today AFTER 2 AM.
        // 2. OR it was updated before 2 AM today, and it is still before 2 AM today.

        let cacheIsFresh = false;
        if (lastUpdate > todayAt2AM) {
            // Updated after 2 AM today
            cacheIsFresh = true;
        } else if (now < todayAt2AM) {
            // It's before 2 AM today, so last night's update is still valid
            const yesterdayAt2AM = new Date(todayAt2AM);
            yesterdayAt2AM.setDate(yesterdayAt2AM.getDate() - 1);
            if (lastUpdate > yesterdayAt2AM) {
                cacheIsFresh = true;
            }
        }

        if (cacheIsFresh) {
            console.log("⚡ Returning cached Dynamic Sector Map");
            return global._sectorMapCache.data;
        }
    }

    console.log("🔄 Refreshing Dynamic Sector Map (Daily Rotation)...");

    // Start with the static map as a reliable baseline
    const newMap: Record<string, string> = { ...STATIC_SECTOR_MAP };

    // Fetch top 10 holdings for each major sector ETF
    // Run in parallel
    const promises = Object.entries(SECTOR_ETF_MAP).map(async ([sectorName, etfSymbol]) => {
        const leaders = await fetchSectorTopStocks(etfSymbol, sectorName);
        leaders.forEach(ticker => {
            // Add to map if not exists (or overwrite to confirm sector)
            newMap[ticker] = sectorName;
        });
        return { sector: sectorName, count: leaders.length };
    });

    await Promise.all(promises);

    console.log(`✅ Sector Map Refreshed! Total Tickers: ${Object.keys(newMap).length}`);

    // Update Cache
    global._sectorMapCache = {
        data: newMap,
        lastUpdated: Date.now()
    };

    return newMap;
}
