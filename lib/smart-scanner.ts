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
            if (quote.averageDailyVolume10Day && quote.regularMarketVolume) {
                const volumeRatio = quote.regularMarketVolume / quote.averageDailyVolume10Day;
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
            const changePercent = quote.regularMarketChangePercent || 0;
            if (changePercent >= 5) {
                results.push({
                    symbol: quote.symbol,
                    name: quote.shortName || quote.longName,
                    source: 'technical',
                    signal: `+${changePercent.toFixed(1)}% today`,
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
 * Scan social media buzz (X, Reddit, StockTwits via Google News)
 */
export async function scanSocialBuzz(): Promise<DiscoveredStock[]> {
    const results: DiscoveredStock[] = [];

    const searchTerms = [
        'stock trending twitter',
        'reddit wallstreetbets trending',
        'stocktwits trending stocks',
        'meme stock momentum'
    ];

    try {
        for (const term of searchTerms) {
            const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(term)}&hl=en-US&gl=US&ceid=US:en`;

            const response = await fetch(rssUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                cache: 'no-store'
            });

            if (!response.ok) continue;

            const xml = await response.text();

            // Extract stock symbols
            // 1. Prioritize $STICKER (Cashtags)
            // 2. Look for (TICKER) in parentheses
            // 3. Standalone uppercase 2-5 chars only if followed by "stock" or "shares" to reduce noise
            const tickerMatches = xml.matchAll(/\$([A-Z]{2,5})\b|\(([A-Z]{2,5})\)|(?:^|\s)([A-Z]{2,5})(?:\s+stock|\s+shares)/gi);

            for (const match of tickerMatches) {
                const symbol = (match[1] || match[2])?.toUpperCase();
                if (symbol && symbol.length >= 2 && symbol.length <= 5) {
                    // Avoid common words
                    // Avoid common words and financial noise
                    const excludeWords = [
                        'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'OUT',
                        'CEO', 'IPO', 'ETF', 'NYSE', 'SEC', 'NASDAQ', 'GDP', 'CPI', 'FED', 'FOMC',
                        'GET', 'TRADE', 'BEST', 'ADDS', 'AFTER', 'NEXT', 'ONLY', 'TIME', 'BUY', 'SELL', 'ITS', 'FREE', 'LIVE',
                        'NOW', 'NEW', 'GOOD', 'BIG', 'TOP', 'SEE', 'DAY', 'WEEK', 'YEAR', 'EST', 'EDT', 'AM', 'PM'
                    ];
                    if (!excludeWords.includes(symbol)) {
                        const existing = results.find(r => r.symbol === symbol);
                        if (!existing) {
                            results.push({
                                symbol: symbol,
                                source: 'social',
                                signal: 'Social media buzz',
                                strength: Math.round(55 + Math.random() * 30),
                                timestamp: new Date()
                            });
                        }
                    }
                }
            }
        }

        console.log(`[SmartScanner] Social scan found ${results.length} stocks`);
    } catch (e) {
        console.error('[SmartScanner] Social scan error:', e);
    }

    return results.slice(0, 15); // Limit to top 15
}

/**
 * Scan for stocks with breaking news (earnings, upgrades, etc.)
 */
export async function scanBreakingNews(): Promise<DiscoveredStock[]> {
    const results: DiscoveredStock[] = [];

    const newsQueries = [
        'stock upgrade today',
        'earnings beat stock',
        'stock price target raised',
        'unusual options activity stock'
    ];

    try {
        for (const query of newsQueries) {
            const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;

            const response = await fetch(rssUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                cache: 'no-store'
            });

            if (!response.ok) continue;

            const xml = await response.text();

            // Extract symbols
            const tickerMatches = xml.matchAll(/\$([A-Z]{2,5})\b|\(([A-Z]{2,5})\)/gi);

            for (const match of tickerMatches) {
                const symbol = (match[1] || match[2])?.toUpperCase();
                if (symbol && symbol.length >= 2 && symbol.length <= 5) {
                    const excludeWords = [
                        'NYSE', 'NASDAQ', 'SEC', 'CEO', 'IPO', 'ETF', 'GDP', 'CPI', 'FED', 'FOMC',
                        'GET', 'TRADE', 'BEST', 'ADDS', 'AFTER', 'NEXT', 'ONLY', 'TIME', 'BUY', 'SELL', 'ITS',
                        'EST', 'EDT', 'USA', 'USD', 'UK', 'EU', 'AI'
                    ];
                    if (!excludeWords.includes(symbol)) {
                        const existing = results.find(r => r.symbol === symbol);
                        if (!existing) {
                            let signalType = 'Breaking news';
                            if (query.includes('upgrade')) signalType = 'Analyst upgrade';
                            if (query.includes('earnings')) signalType = 'Earnings catalyst';
                            if (query.includes('options')) signalType = 'Options activity';

                            results.push({
                                symbol: symbol,
                                source: query.includes('options') ? 'options' : 'news',
                                signal: signalType,
                                strength: Math.round(65 + Math.random() * 25),
                                timestamp: new Date()
                            });
                        }
                    }
                }
            }
        }

        console.log(`[SmartScanner] News scan found ${results.length} stocks`);
    } catch (e) {
        console.error('[SmartScanner] News scan error:', e);
    }

    return results.slice(0, 15);
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

    // Run all scans in parallel
    const [volumeStocks, gainerStocks, socialStocks, newsStocks] = await Promise.all([
        scanUnusualVolume(),
        scanTopGainers(),
        scanSocialBuzz(),
        scanBreakingNews()
    ]);

    // Combine all discoveries
    const allDiscoveries = [
        ...volumeStocks,
        ...gainerStocks,
        ...socialStocks,
        ...newsStocks
    ];

    // Consolidate and deduplicate
    const consolidated = consolidateDiscoveries(allDiscoveries);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[SmartScanner] Scan complete in ${elapsed}s. Found ${consolidated.length} unique stocks.`);

    // Return top 30 for deep analysis
    return consolidated.slice(0, 30);
}
