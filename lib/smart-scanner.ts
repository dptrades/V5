/**
 * Smart Market Scanner
 * Dynamically discovers high-potential stocks using multiple signals
 */

// Import and re-export types for backwards compatibility
import type { DiscoveredStock } from '../types/stock';
export type { DiscoveredStock } from '../types/stock';

// Top gainers/volume from Yahoo Finance screener
const YAHOO_SCREENER_URL = 'https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved';

/**
 * Scan for unusual volume stocks (2x+ average)
 * Uses Yahoo Finance's built-in screeners
 */
export async function scanUnusualVolume(): Promise<DiscoveredStock[]> {
    const results: DiscoveredStock[] = [];

    try {
        // Fetch most active stocks
        const response = await fetch(
            'https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=most_actives&count=25',
            {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                cache: 'no-store'
            }
        );

        if (!response.ok) {
            console.error('[SmartScanner] Volume scan failed:', response.status);
            return results;
        }

        const data = await response.json();
        const quotes = data?.finance?.result?.[0]?.quotes || [];

        for (const quote of quotes) {
            // Filter: Only US stocks with significant volume
            if (!quote.symbol || quote.symbol.includes('.') || quote.symbol.includes('-')) continue;

            const currentVolume = quote.preMarketVolume || quote.regularMarketVolume;
            if (quote.averageDailyVolume10Day && currentVolume) {
                const volumeRatio = currentVolume / quote.averageDailyVolume10Day;
                if (volumeRatio >= 1.5) {
                    results.push({
                        symbol: quote.symbol,
                        name: quote.shortName || quote.longName,
                        source: 'volume',
                        signal: `${volumeRatio.toFixed(1)}x avg volume`,
                        strength: Math.min(100, Math.round(volumeRatio * 20)),
                        timestamp: new Date()
                    });
                }
            }
        }

        console.log(`[SmartScanner] Volume scan found ${results.length} stocks`);
    } catch (e) {
        console.error('[SmartScanner] Volume scan error:', e);
    }

    return results;
}

/**
 * Scan for top gainers (momentum)
 */
export async function scanTopGainers(): Promise<DiscoveredStock[]> {
    const results: DiscoveredStock[] = [];

    try {
        const response = await fetch(
            'https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=day_gainers&count=25',
            {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                cache: 'no-store'
            }
        );

        if (!response.ok) return results;

        const data = await response.json();
        const quotes = data?.finance?.result?.[0]?.quotes || [];

        for (const quote of quotes) {
            if (!quote.symbol || quote.symbol.includes('.') || quote.symbol.includes('-')) continue;
            const changePercent = quote.preMarketChangePercent || quote.regularMarketChangePercent || 0;
            if (changePercent >= 5) {
                results.push({
                    symbol: quote.symbol,
                    name: quote.shortName || quote.longName,
                    source: 'technical',
                    signal: `+${changePercent.toFixed(1)}% pre-mkt/today`,
                    strength: Math.min(100, Math.round(changePercent * 5)),
                    timestamp: new Date()
                });
            }
        }

        console.log(`[SmartScanner] Gainers scan found ${results.length} stocks`);
    } catch (e) {
        console.error('[SmartScanner] Gainers scan error:', e);
    }

    return results;
}



/**
 * Consolidate and deduplicate discovered stocks
 * Merge signals for same symbol, boost strength for multiple sources
 */
export function consolidateDiscoveries(discoveries: DiscoveredStock[]): DiscoveredStock[] {
    const symbolMap = new Map<string, DiscoveredStock>();

    for (const discovery of discoveries) {
        const existing = symbolMap.get(discovery.symbol);
        if (existing) {
            // Boost strength for multiple signals
            existing.strength = Math.min(100, existing.strength + 15);
            existing.signal = `${existing.signal} + ${discovery.signal}`;
        } else {
            symbolMap.set(discovery.symbol, { ...discovery });
        }
    }

    // Sort by strength descending
    return Array.from(symbolMap.values())
        .sort((a, b) => b.strength - a.strength);
}

/**
 * Run full smart scan - combines all discovery methods
 */
export async function runSmartScan(): Promise<DiscoveredStock[]> {
    console.log('[SmartScanner] Starting full market scan...');
    const startTime = Date.now();

    // Run remaining scans in parallel
    const [volumeStocks, gainerStocks] = await Promise.all([
        scanUnusualVolume(),
        scanTopGainers()
    ]);

    // Combine all discoveries
    const allDiscoveries = [
        ...volumeStocks,
        ...gainerStocks
    ];

    // Consolidate and deduplicate
    const consolidated = consolidateDiscoveries(allDiscoveries);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[SmartScanner] Scan complete in ${elapsed}s. Found ${consolidated.length} unique stocks.`);

    // Return top 30 for deep analysis
    return consolidated.slice(0, 30);
}
