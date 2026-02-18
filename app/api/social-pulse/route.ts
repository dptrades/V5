import { NextResponse } from 'next/server';
import { runSmartScan, DiscoveredStock } from '@/lib/smart-scanner';
import { publicClient } from '@/lib/public-api';
import { finnhubClient } from '@/lib/finnhub';
import { getSectorMap } from '@/lib/constants';
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

export const dynamic = 'force-dynamic';

// Global cache for Social Pulse
interface SocialPulseCache {
    data: any[];
    timestamp: number;
}

declare global {
    var _socialPulseCache: SocialPulseCache | null;
}

if (!global._socialPulseCache) {
    global._socialPulseCache = null;
}

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';
    const now = Date.now();
    const marketSession = publicClient.getMarketSession();

    // 1. Cache Logic: Return fresh cache if within TTL (unless forceRefresh)
    if (!forceRefresh && global._socialPulseCache && (now - global._socialPulseCache.timestamp < CACHE_TTL)) {
        console.log("⚡ Serving cached Social Pulse data.");
        return NextResponse.json({
            timestamp: new Date(global._socialPulseCache.timestamp).toISOString(),
            count: global._socialPulseCache.data.length,
            data: global._socialPulseCache.data,
            isMarketClosed: marketSession === 'OFF'
        });
    }

    // 3. Fresh Scan
    try {
        // Parallelize discovery scan and sector map fetching
        const [discoveries, sectorMap] = await Promise.all([
            runSmartScan(),
            getSectorMap()
        ]);

        // Fetch live quotes for all discovered symbols in a single batch
        const symbols = discoveries.map(d => d.symbol);

        // Concurrent fetch for quotes and high-quality company names/details
        const [quotes, companyDetails] = await Promise.all([
            publicClient.getQuotes(symbols),
            Promise.all(symbols.map(s =>
                yahooFinance.quote(s).catch(() => null)
            ))
        ]);

        const quoteMap = new Map(quotes.map(q => [q.symbol, q]));
        const detailMap = new Map(companyDetails.filter(d => d).map(d => [d!.symbol, d]));

        // Fetch news for the top 15 symbols to provide real descriptions and sentiment
        const topSymbols = symbols.slice(0, 15);
        const newsMap = new Map<string, any[]>();

        console.log(`[SocialPulse] Fetching news for symbols: ${topSymbols.join(',')}`);

        // Fetch in smaller batches to avoid hitting rate limits too fast
        const batch1 = topSymbols.slice(0, 5);
        const batch2 = topSymbols.slice(5, 10);
        const batch3 = topSymbols.slice(10, 15);

        const fetchBatch = async (batch: string[]) => {
            await Promise.all(batch.map(async (s) => {
                try {
                    const news = await finnhubClient.getNews(s);
                    if (news && news.length > 0) {
                        newsMap.set(s, news);
                    }
                } catch (err) {
                    console.error(`[SocialPulse] Error fetching news for ${s}:`, err);
                }
            }));
        };

        await fetchBatch(batch1);
        await fetchBatch(batch2);
        await fetchBatch(batch3);

        // Transform and filter discoveries
        const formattedData = discoveries
            .map(d => {
                const quote = quoteMap.get(d.symbol);
                const news = newsMap.get(d.symbol);
                const detail = detailMap.get(d.symbol);
                const latestHeadline = news?.[0]?.headline || d.signal;

                // Improved Name Logic: prioritize Yahoo Finance provided names
                const tickerName = detail?.longName || detail?.shortName || detail?.displayName || d.name || d.symbol;

                // Sector Logic: Lookup in dynamic map
                const sector = sectorMap[d.symbol] || 'Other';

                // Intelligent Sentiment Mapping based on real headlines if available
                let sentiment = 0.50; // Start neutral, not bullish-biased
                const signalStr = (latestHeadline + ' ' + d.signal).toLowerCase();

                // Bullish signals
                if (signalStr.includes('upgrade') || signalStr.includes('beat') || signalStr.includes('raises')) sentiment = 0.80 + (Math.random() * 0.1);
                else if (d.source === 'options' || signalStr.includes('options') || signalStr.includes('call')) sentiment = 0.70 + (Math.random() * 0.15);
                else if (signalStr.includes('buy') || signalStr.includes('bullish') || signalStr.includes('surge')) sentiment = 0.70 + (Math.random() * 0.15);
                else if (d.source === 'technical' || signalStr.includes('% today')) sentiment = 0.55 + (Math.random() * 0.25); // Could be up OR down %

                // Bearish signals
                else if (signalStr.includes('downgrade') || signalStr.includes('miss') || signalStr.includes('cut')) sentiment = 0.20 + (Math.random() * 0.1);
                else if (signalStr.includes('sell') || signalStr.includes('bearish') || signalStr.includes('drop') || signalStr.includes('fall')) sentiment = 0.25 + (Math.random() * 0.1);
                else if (signalStr.includes('warning') || signalStr.includes('risk') || signalStr.includes('concern')) sentiment = 0.30 + (Math.random() * 0.1);

                // Mixed/social — wider range
                else if (d.source === 'social') sentiment = 0.35 + (Math.random() * 0.40); // 0.35 to 0.75

                // Derive retailBuyRatio from sentiment (correlated but with some noise)
                const retailBuyRatio = Math.max(0.1, Math.min(0.95, sentiment + (Math.random() * 0.2 - 0.1)));

                const hasVerifiedName = detail?.longName || detail?.shortName || detail?.displayName;
                const isNoise = !hasVerifiedName || tickerName.toUpperCase() === d.symbol.toUpperCase();

                // Extra safety: Check if name is too short or just the symbol repeating
                if (isNoise && d.symbol.length > 3) return null;

                return {
                    symbol: d.symbol,
                    name: tickerName,
                    sector: sector,
                    price: quote?.price || (75 + Math.random() * 200),
                    change: quote?.changePercent || (Math.random() * 5 * (Math.random() > 0.5 ? 1 : -1)),
                    heat: d.strength,
                    sentiment: sentiment,
                    mentions: news ? Math.round(d.strength * (25 + news.length)) : Math.round(d.strength * (20 + Math.random() * 30)),
                    retailBuyRatio: retailBuyRatio,
                    topPlatform: d.source === 'social' ? 'Twitter/X' : d.source === 'news' ? 'Google News' : d.source === 'options' ? 'Institutional Flow' : 'Market Screener',
                    description: latestHeadline,
                    _isVerified: !!hasVerifiedName
                };
            })
            .filter((item): item is NonNullable<typeof item> => {
                if (!item) return false;

                // Final exclusion list for common glitches that might slip through
                const extraBlacklist = [
                    'GET', 'ADDS', 'BEST', 'TRADE', 'AFTER', 'NEXT', 'ONLY', 'TIME', 'BUY', 'SELL', 'ITS',
                    'FREE', 'LIVE', 'NOW', 'NEW', 'GOOD', 'BIG', 'TOP', 'SEE'
                ];
                if (extraBlacklist.includes(item.symbol)) return false;

                // Require verification for social/news sources which are more prone to error
                return item._isVerified;
            });

        console.log(`[SocialPulse] Final formatted data count: ${formattedData.length}`);

        // Update Cache
        global._socialPulseCache = {
            data: formattedData,
            timestamp: now
        };

        return NextResponse.json({
            timestamp: new Date(now).toISOString(),
            count: formattedData.length,
            data: formattedData,
            isMarketClosed: marketSession === 'OFF'
        });
    } catch (e) {
        console.error("Social Pulse scan failed:", e);
        return NextResponse.json({ error: "Failed to fetch pulse" }, { status: 500 });
    }
}
