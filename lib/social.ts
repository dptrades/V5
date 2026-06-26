import { runSmartScan } from './smart-scanner';
import { publicClient } from './public-api';
import { finnhubClient, FinnhubSocialSentiment } from './finnhub';
import { getSectorMap } from './constants';
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

export interface SocialPulseItem {
    symbol: string;
    name: string;
    sector: string;
    price: number;
    change: number;
    heat: number;
    sentiment: number;
    mentions: number;
    retailBuyRatio: number;
    topPlatform: string;
    description: string;
    _isVerified: boolean;
    // Audit fix #4: honesty flags. _isHeuristic=true means sentiment/retailBuyRatio/
    // topPlatform below are the keyword+hash heuristic (computeSentiment), NOT real
    // platform data — true whenever Finnhub's social-sentiment endpoint returned no
    // data for this symbol (premium-gated key, illiquid name, or no recent chatter).
    _isHeuristic: boolean;
    mentionsSource: 'reddit_twitter' | 'news_articles';
}

// Global cache for Social Pulse
interface SocialPulseCache {
    data: SocialPulseItem[];
    timestamp: number;
}

declare global {
    var _socialPulseLibCache: SocialPulseCache | null;
}

if (!global._socialPulseLibCache) {
    global._socialPulseLibCache = null;
}

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * Produces a deterministic pseudo-random float in [0, scale] seeded by a string.
 * Uses djb2 hash so the same stock+signal always yields the same value across
 * page loads — eliminates jitter in sentiment/retailBuyRatio scores.
 */
function seededScore(seed: string, scale: number = 0.1): number {
    let hash = 5381;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) + hash) + seed.charCodeAt(i);
        hash = hash & hash; // Force 32-bit integer
    }
    return ((hash >>> 0) / 0xffffffff) * scale;
}

/**
 * Deterministic sentiment scorer.
 * Returns a value in [0, 1] based on keyword frequency in the signal string.
 * Uses seededScore for the fractional "noise" component so results are stable.
 */
function computeSentiment(signalStr: string, source: string, seed: string): number {
    const s = signalStr.toLowerCase();

    // Strongly bullish signals
    if (s.includes('upgrade') || s.includes('beat') || s.includes('raises') || s.includes('record high')) {
        return Math.min(1, 0.80 + seededScore(seed + 'bull-strong', 0.10));
    }
    // Options / institutional call activity
    if (source === 'options' || s.includes('call sweep') || s.includes('unusual call')) {
        return Math.min(1, 0.72 + seededScore(seed + 'options', 0.15));
    }
    // Moderately bullish
    if (s.includes('buy') || s.includes('bullish') || s.includes('surge') || s.includes('breakout')) {
        return Math.min(1, 0.68 + seededScore(seed + 'bull-mod', 0.14));
    }
    // Technical momentum
    if (source === 'technical' || s.includes('% today') || s.includes('momentum')) {
        return Math.min(1, 0.55 + seededScore(seed + 'tech', 0.22));
    }
    // Strongly bearish
    if (s.includes('downgrade') || s.includes('miss') || s.includes('cut') || s.includes('recall')) {
        return Math.max(0, 0.20 + seededScore(seed + 'bear-strong', 0.10));
    }
    // Moderately bearish
    if (s.includes('sell') || s.includes('bearish') || s.includes('drop') || s.includes('fall')) {
        return Math.max(0, 0.25 + seededScore(seed + 'bear-mod', 0.10));
    }
    // Warning/risk language
    if (s.includes('warning') || s.includes('risk') || s.includes('concern') || s.includes('probe')) {
        return Math.max(0, 0.30 + seededScore(seed + 'warn', 0.10));
    }
    // Social discovery (no strong signal)
    if (source === 'social') {
        return 0.35 + seededScore(seed + 'social', 0.40);
    }
    // Default neutral
    return 0.48 + seededScore(seed + 'neutral', 0.12);
}

/**
 * Audit fix #4: aggregate Finnhub's real /stock/social-sentiment time series
 * (Reddit + Twitter mention/sentiment counts) into a single [0,1] score, a
 * total mention count, and the platform that drove the most chatter. Returns
 * null when Finnhub has no real data for this symbol (premium-gated key,
 * illiquid name, or no recent mentions) — callers must fall back to the
 * computeSentiment() heuristic and flag the item as such, rather than
 * presenting the fallback as if it were real platform data.
 */
function aggregateSocialSentiment(data: FinnhubSocialSentiment | null): { sentiment01: number; mentions: number; platform: 'Reddit' | 'Twitter/X' } | null {
    if (!data) return null;
    const sum = (arr: Array<{ mention: number; positiveMention: number; negativeMention: number }> = []) =>
        arr.reduce((acc, p) => ({
            mention: acc.mention + (p.mention || 0),
            pos: acc.pos + (p.positiveMention || 0),
            neg: acc.neg + (p.negativeMention || 0)
        }), { mention: 0, pos: 0, neg: 0 });

    const reddit = sum(data.reddit);
    const twitter = sum(data.twitter);
    const totalMention = reddit.mention + twitter.mention;
    if (totalMention <= 0) return null;

    const totalPos = reddit.pos + twitter.pos;
    const totalNeg = reddit.neg + twitter.neg;
    const sentiment01 = Math.max(0, Math.min(1, 0.5 + 0.5 * ((totalPos - totalNeg) / totalMention)));
    return { sentiment01, mentions: totalMention, platform: reddit.mention >= twitter.mention ? 'Reddit' : 'Twitter/X' };
}

export async function scanSocialPulse(forceRefresh = false): Promise<SocialPulseItem[]> {
    const now = Date.now();
    const marketSession = publicClient.getMarketSession();

    // Cache Logic
    if (!forceRefresh && global._socialPulseLibCache && (now - global._socialPulseLibCache.timestamp < CACHE_TTL)) {
        console.log("⚡ Serving cached Social Pulse logic data.");
        return global._socialPulseLibCache.data;
    }

    try {
        const [discoveries, sectorMap] = await Promise.all([
            runSmartScan(),
            getSectorMap()
        ]);

        const symbols = discoveries.map(d => d.symbol);

        const [quotes, companyDetails] = await Promise.all([
            publicClient.getQuotes(symbols),
            Promise.all(symbols.map(s => yahooFinance.quote(s).catch(() => null)))
        ]);

        const quoteMap = new Map(quotes.map(q => [q.symbol, q]));
        const detailMap = new Map(companyDetails.filter(d => d).map(d => [d!.symbol, d]));

        const topSymbols = symbols.slice(0, 15);
        const newsMap = new Map<string, any[]>();
        const socialMap = new Map<string, FinnhubSocialSentiment | null>();

        console.log(`[SocialPulse] Fetching news for symbols: ${topSymbols.join(',')}`);

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

        // Audit fix #4: attempt REAL Reddit/Twitter mention sentiment (Finnhub
        // /stock/social-sentiment) for the leading batch only. This endpoint shares
        // Finnhub's single rate-limited queue with getNews() above, so widening this
        // to all 15 symbols would roughly double the route's run time — bounded to
        // batch1 (5 symbols) to keep the added latency small (~5.5s) while still
        // surfacing genuine platform data for the names most likely to be viewed.
        // Symbols outside this batch keep the existing heuristic, honestly flagged
        // via _isHeuristic below.
        const fetchSocialBatch = async (batch: string[]) => {
            await Promise.all(batch.map(async (s) => {
                try {
                    const data = await finnhubClient.getSocialSentiment(s);
                    socialMap.set(s, data);
                } catch (err) {
                    console.error(`[SocialPulse] Error fetching social sentiment for ${s}:`, err);
                    socialMap.set(s, null);
                }
            }));
        };

        // FIX #3: Run all three batches in parallel (was sequential awaits before)
        await Promise.all([fetchBatch(batch1), fetchBatch(batch2), fetchBatch(batch3), fetchSocialBatch(batch1)]);

        const formattedData = discoveries
            .map(d => {
                const quote = quoteMap.get(d.symbol);
                const news = newsMap.get(d.symbol);
                const detail = detailMap.get(d.symbol);
                const latestHeadline = news?.[0]?.headline || d.signal;
                const tickerName = detail?.longName || detail?.shortName || detail?.displayName || d.name || d.symbol;
                const sector = sectorMap[d.symbol] || 'Other';

                // Audit fix #4: prefer REAL Reddit/Twitter mention sentiment when
                // Finnhub returned any for this symbol; otherwise fall back to the
                // keyword+hash heuristic and flag the item as heuristic so nothing
                // downstream mistakes it for genuine platform data.
                const realSocial = aggregateSocialSentiment(socialMap.get(d.symbol) || null);

                // FIX #1: Deterministic sentiment — stable across page loads for the same stock+signal
                const signalStr = (latestHeadline + ' ' + d.signal).toLowerCase();
                const sentimentSeed = d.symbol + signalStr.slice(0, 40);
                const heuristicSentiment = computeSentiment(signalStr, d.source, sentimentSeed);
                const sentiment = realSocial ? realSocial.sentiment01 : heuristicSentiment;

                // retailBuyRatio: when we have real mention data, mirror the real
                // sentiment directly (no synthetic noise layered on top); otherwise
                // keep the existing seeded-noise heuristic.
                const retailBuyRatio = realSocial
                    ? Math.max(0.1, Math.min(0.95, realSocial.sentiment01))
                    : Math.max(0.1, Math.min(0.95, heuristicSentiment + seededScore(sentimentSeed + 'retail', 0.2) - 0.1));

                const hasVerifiedName = detail?.longName || detail?.shortName || detail?.displayName;
                const isNoise = !hasVerifiedName || tickerName.toUpperCase() === d.symbol.toUpperCase();

                if (isNoise && d.symbol.length > 3) return null;

                // FIX #2: Use real news article count labeled as "News Signals" (not fabricated mention count)
                const newsSignalCount = news ? news.length : 0;

                return {
                    symbol: d.symbol,
                    name: tickerName,
                    sector: sector,
                    price: quote?.price || 0,
                    change: quote?.changePercent || 0,
                    heat: d.strength,
                    sentiment: sentiment,
                    mentions: realSocial ? realSocial.mentions : newsSignalCount,
                    mentionsSource: realSocial ? 'reddit_twitter' as const : 'news_articles' as const,
                    retailBuyRatio: retailBuyRatio,
                    // Honest platform attribution: only name a specific social platform
                    // when real Reddit/Twitter data backs it. Otherwise this is a
                    // discovery-source label, not a claim about where the chatter lives.
                    topPlatform: realSocial
                        ? realSocial.platform
                        : (d.source === 'news' ? 'Google News' : d.source === 'options' ? 'Institutional Flow' : d.source === 'social' ? 'Social Discovery (unverified)' : 'Market Screener'),
                    description: latestHeadline,
                    _isVerified: !!hasVerifiedName,
                    _isHeuristic: !realSocial
                };
            })
            .filter((item): item is NonNullable<typeof item> => {
                if (!item) return false;
                const extraBlacklist = ['GET', 'ADDS', 'BEST', 'TRADE', 'AFTER', 'NEXT', 'ONLY', 'TIME', 'BUY', 'SELL', 'ITS', 'FREE', 'LIVE', 'NOW', 'NEW', 'GOOD', 'BIG', 'TOP', 'SEE'];
                if (extraBlacklist.includes(item.symbol)) return false;
                return item._isVerified;
            });

        console.log(`[SocialPulse] Final formatted data count: ${formattedData.length}`);

        global._socialPulseLibCache = {
            data: formattedData as SocialPulseItem[],
            timestamp: now
        };

        return formattedData as SocialPulseItem[];
    } catch (e) {
        console.error("Social Pulse scan logic failed:", e);
        throw e;
    }
}

