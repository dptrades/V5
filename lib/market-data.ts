import { fetchAlpacaBars, fetchAlpacaPrice } from './alpaca';
import YahooFinance from 'yahoo-finance2';
import { calculateIndicators } from './indicators';
import { ConvictionStock } from '../types/stock';
import { publicClient } from './public-api';
import { schwabClient } from './schwab';
import { calculateGammaSqueezeProbability } from './options';
import { finnhubClient } from './finnhub';
import { getMarketSession } from './refresh-utils';

const yahooFinance = new YahooFinance();

// ── Server-side MTA Cache ──────────────────────────────────────────────────────
// Caches the expensive fetchMultiTimeframeAnalysis result per symbol.
// TTL: 1 minute during market hours (live data changes), 30 minutes off-hours.
interface MtaCacheEntry {
    data: NonNullable<Awaited<ReturnType<typeof _fetchMtaUncached>>>;
    timestamp: number;
}
declare global {
    var _mtaCache: Map<string, MtaCacheEntry>;
}
if (!global._mtaCache) global._mtaCache = new Map();

const MTA_TTL_MARKET = 60 * 1000;        // 1 minute — live data
const MTA_TTL_OFFHRS = 30 * 60 * 1000;  // 30 minutes — no new data off hours

export interface TimeframeData {
    timeframe: '1h' | '4h' | '1d' | '1w';  // 10m removed — too noisy, adds a full extra API call per load
    open: number;
    close: number;
    ema9: number | null;
    ema21: number | null;
    ema50: number | null;
    ema200: number | null;
    rsi: number | null;
    adx: number | null;
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    macd: {
        macd: number;
        signal: number;
        histogram: number;
    } | null;
    bollinger: {
        upper: number;
        lower: number;
        middle: number;
        pb: number; // %B
    } | null;
    vwap: number | null;
    fvg?: {
        type: 'BULLISH' | 'BEARISH' | 'NONE';
        gapLow: number;
        gapHigh: number;
    } | null;
    priceRelToEma: {
        ema9: number; // % distance
        ema21: number;
        ema50: number;
        ema200: number;
        isNear: boolean; // if within 1% of any major EMA
    };
    divergence?: {
        type: 'BULLISH' | 'BEARISH' | 'NONE';
    } | null;
}

export interface MultiTimeframeAnalysis {
    symbol: string;
    currentPrice: number;
    headerPrice: number; // The price to show in the global header (last close during off hours)
    timeframes: TimeframeData[];
    metrics: {
        atr: number;
        avgVolume1y: number;
        volumeDiff: number;
        volatility: number; // ATR as % of price
        dayHigh: number;
        dayLow: number;
        beta?: number;
        gammaSqueeze?: {
            score: number;
            details: string[];
        };
    };
    dataSource: string;
    marketSession: 'PRE' | 'REG' | 'POST' | 'OFF';
}

// 1. Live Price Waterfall: Public -> Schwab -> Alpaca -> Yahoo
export async function fetchLivePrice(symbol: string): Promise<{ price: number, source: string } | null> {
    const start = Date.now();

    // A. Public.com (Primary for Real-Time) - 60s Cache internal
    try {
        const publicQuote = await publicClient.getQuote(symbol);
        if (publicQuote && publicQuote.price > 0) {
            console.log(`[Waterfall] ${symbol} resolved via Public.com in ${Date.now() - start}ms`);
            return { price: publicQuote.price, source: 'Public.com' };
        }
    } catch (e) {
        console.warn(`[Waterfall] Public.com failed for ${symbol}`);
    }

    // B. Schwab (Professional Fallback)
    if (schwabClient.isConfigured()) {
        try {
            const schwabGreeks = await schwabClient.getGreeks(symbol);
            if (schwabGreeks && schwabGreeks.lastPrice > 0) {
                console.log(`[Waterfall] ${symbol} resolved via Schwab in ${Date.now() - start}ms`);
                return { price: schwabGreeks.lastPrice, source: 'Schwab Pro' };
            }
        } catch (e) {
            console.warn(`[Waterfall] Schwab failed for ${symbol}`);
        }
    }

    // C. Alpaca (Retail Secondary)
    try {
        const alpacaPrice = await fetchAlpacaPrice(symbol);
        if (alpacaPrice && alpacaPrice > 0) {
            console.log(`[Waterfall] ${symbol} resolved via Alpaca in ${Date.now() - start}ms`);
            return { price: alpacaPrice, source: 'Alpaca IEX' };
        }
    } catch (e) {
        console.warn(`[Waterfall] Alpaca failed for ${symbol}`);
    }

    // D. Yahoo Finance (Final Safety Net)
    try {
        const quote = await yahooFinance.quote(symbol);
        if (quote && quote.regularMarketPrice) {
            console.log(`[Waterfall] ${symbol} resolved via Yahoo in ${Date.now() - start}ms`);
            return { price: quote.regularMarketPrice, source: 'Yahoo Finance' };
        }
    } catch (e) {
        console.error(`[Waterfall] All sources failed for ${symbol} (${Date.now() - start}ms)`);
    }

    return null;
}

// 2. Multi-Level Timeframe Fallback Strategy
async function fetchHistoricalData(symbol: string, alpacaTf: string, yahooTf: string, limit: number, schwabConfig?: any) {
    // Tier 1: Schwab Professional
    if (schwabClient.isConfigured() && schwabConfig) {
        try {
            const bars = await schwabClient.getPriceHistory(
                symbol,
                schwabConfig.periodType,
                schwabConfig.period,
                schwabConfig.frequencyType,
                schwabConfig.frequency
            );
            if (bars && bars.length > 0) {
                return { bars: bars.map(b => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume })), source: 'Schwab Professional' };
            }
        } catch (e) {
            console.warn(`[Waterfall] Schwab historical failed for ${symbol}, falling to Alpaca...`);
        }
    }

    // Tier 2: Alpaca
    try {
        const bars = await fetchAlpacaBars(symbol, alpacaTf as any, limit);
        if (bars && bars.length > 0) {
            return {
                bars: bars.map((b: any) => ({
                    time: new Date(b.t).getTime(),
                    open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v
                })),
                source: 'Alpaca'
            };
        }
    } catch (e) {
        console.warn(`[Waterfall] Alpaca historical failed for ${symbol}, falling to Yahoo...`);
    }

    // Tier 3: Yahoo Finance
    try {
        const now = new Date();
        let daysBack = (yahooTf === '1d') ? 365 * 3 : (yahooTf === '1wk') ? 365 * 10 : (yahooTf === '60m') ? 120 : (yahooTf === '5m') ? 20 : 45;
        const period1 = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
        const result = await yahooFinance.chart(symbol, { period1, interval: yahooTf as any });
        if (result && result.quotes) {
            return {
                bars: result.quotes.map((q: any) => ({
                    time: new Date(q.date).getTime(),
                    open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume
                })).filter(q => q.close !== null),
                source: 'Yahoo Finance'
            };
        }
    } catch (e) {
        console.error(`[Waterfall] Yahoo history failed for ${symbol} ${yahooTf}`, e);
    }

    return { bars: [], source: 'Error' };
}

function mapTimeframe(tf: string): {
    alpaca: string,
    yahoo: string,
    schwab: { periodType: string, period: number, frequencyType: string, frequency: number },
    bars: number
} {
    switch (tf) {
        // 10m removed: caused an extra full API call per load with minimal analytical value
        case '1h': return {
            alpaca: '1Hour',
            yahoo: '60m',
            schwab: { periodType: 'day', period: 10, frequencyType: 'minute', frequency: 60 },
            bars: 1000
        };
        case '1d': return {
            alpaca: '1Day',
            yahoo: '1d',
            schwab: { periodType: 'year', period: 5, frequencyType: 'daily', frequency: 1 },
            bars: 1000
        };
        case '1w' as any: return {
            alpaca: '1Week' as any,
            yahoo: '1wk',
            schwab: { periodType: 'year', period: 10, frequencyType: 'weekly', frequency: 1 },
            bars: 1000
        };
        default: return {
            alpaca: '1Day',
            yahoo: '1d',
            schwab: { periodType: 'year', period: 1, frequencyType: 'daily', frequency: 1 },
            bars: 1000
        };
    }
}

// Internal uncached implementation — only call via fetchMultiTimeframeAnalysis.
async function _fetchMtaUncached(symbol: string): Promise<MultiTimeframeAnalysis | null> {
    const timeframes: ('1h' | '1d' | '1w')[] = ['1h', '1d', '1w']; // 10m removed
    const results: TimeframeData[] = [];
    let dailyAtr = 0;
    let avgVolume = 0;
    let currentPrice = 0;

    const dailyConfig = mapTimeframe('1d');

    const marketSession = publicClient.getMarketSession();
    let livePrice = 0;
    let dailyData: any[] = [];

    // Run concurrently: daily bars + live price + beta + options chain (for gamma squeeze + PCR)
    const [dailyResult, liveData, finnhubMetrics, optionsChain] = await Promise.all([
        fetchHistoricalData(symbol, dailyConfig.alpaca, dailyConfig.yahoo, dailyConfig.bars, dailyConfig.schwab),
        fetchLivePrice(symbol),
        finnhubClient.getBasicFinancials(symbol).catch(() => null),
        // Pre-fetch the options chain once — shared between gammaSqueeze and PCR (no double fetch)
        (schwabClient.isConfigured()
            ? schwabClient.getOptionChainNormalized(symbol).catch(() => null)
            : Promise.resolve(null)
        ).then(chain => chain ?? publicClient.getOptionChain(symbol).catch(() => null))
    ]);

    dailyData = dailyResult.bars;
    livePrice = liveData?.price || 0;
    const beta = finnhubMetrics?.metric?.beta;
    const dataOrigin = dailyResult.source;

    if (!dailyData || dailyData.length < 50) {
        console.error(`Insufficient daily data for ${symbol}`);
        return null;
    }

    // Process Daily
    const dailyIndicators = calculateIndicators(dailyData);
    const latestDaily = dailyIndicators[dailyIndicators.length - 1];

    // HYBRID MERGE: Use live price to update the last bar's close for sub-second accuracy
    currentPrice = livePrice || latestDaily.close;
    if (livePrice > 0) {
        dailyData[dailyData.length - 1].close = livePrice;
    }

    dailyAtr = latestDaily.atr14 || 0;

    // --- NEW METRICS FOR GAMMA SQUEEZE ---
    // 1. 52-Week High/Low
    let fiftyTwoWeekHigh = 0;
    let fiftyTwoWeekLow = Infinity;
    const oneYearBars = dailyData.slice(-252);
    if (oneYearBars.length > 0) {
        fiftyTwoWeekHigh = Math.max(...oneYearBars.map(b => b.high));
        fiftyTwoWeekLow = Math.min(...oneYearBars.map(b => b.low));
    }

    // 2. Historical Volatility (30-day Annualized)
    let historicalVolatility = 0;
    const volatilityWindow = 30;
    if (dailyData.length > volatilityWindow) {
        const slice = dailyData.slice(-volatilityWindow);
        const logReturns = [];
        for (let i = 1; i < slice.length; i++) {
            const currentClose = slice[i].close;
            const prevClose = slice[i - 1].close;
            if (prevClose > 0) {
                logReturns.push(Math.log(currentClose / prevClose));
            }
        }
        if (logReturns.length > 0) {
            const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
            const variance = logReturns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / logReturns.length;
            const stdDev = Math.sqrt(variance);
            historicalVolatility = stdDev * Math.sqrt(252); // Annualize
        }
    }

    // Calculate Gamma Squeeze — passes the pre-fetched chain to avoid a second options chain fetch
    const gammaSqueeze = await calculateGammaSqueezeProbability(
        symbol,
        currentPrice,
        dailyAtr,
        fiftyTwoWeekHigh,
        fiftyTwoWeekLow,
        historicalVolatility,
        optionsChain as any
    );

    // Calculate 1y Volume Avg (~252 trading days)
    const volSlice = dailyData.slice(-252);
    avgVolume = volSlice.reduce((acc, curr) => acc + curr.volume, 0) / volSlice.length;

    // Calculate Volume Diff
    const lastVol = dailyData[dailyData.length - 1].volume;
    const volDiff = avgVolume > 0 ? ((lastVol - avgVolume) / avgVolume) * 100 : 0;

    // Analyze all timeframes (1h, 1d, 1w — 10m removed)
    await Promise.all(timeframes.map(async (tf) => {
        let data = dailyData;

        if (tf !== '1d') {
            const config = mapTimeframe(tf);
            const res = await fetchHistoricalData(symbol, config.alpaca, config.yahoo, config.bars, config.schwab);
            data = res.bars;
        }

        if (data && data.length > 0) {
            // HYBRID STITCH: Inject live price into intraday datasets
            if (livePrice > 0 && tf === '1h') {
                const lastBar = data[data.length - 1];
                // Staleness check: allow up to 5 days (covers long holiday weekends)
                const stalenessThreshold = 5 * 24 * 60 * 60 * 1000;
                const isStale = (Date.now() - lastBar.time) > stalenessThreshold;

                // 1. Time-Staleness Check (Market is active but data is really old)
                if (isStale && marketSession !== 'OFF') {
                    // console.warn(`[MarketData] ${symbol} ${tf} data is stale. Skipping.`);
                    // Relaxed for dev/demo purposes where system time might mismatch data time
                }

                // 2. Simulation Environment Sync (Dev/Test)
                // If data is "stale" (> 5 days), it likely means we are in a simulation time (e.g. 2026) 
                // but fetching real data (2025). We must shift the history to "now" to allow valid indicators.
                const hoursDiff = (Date.now() - lastBar.time) / (1000 * 60 * 60);


                if (hoursDiff > 120) { // > 5 days gap
                    // console.log(`[MarketData] Detected data lag of ${hoursDiff.toFixed(1)}h. Syncing history to present time.`);

                    // Calculate exact shift to bring the last bar to "now" (minus a small buffer if needed? no, EXACT is fine for indicators)
                    // Actually, let's keep the time-of-day alignment if possible?
                    // If we just add difference, we change 9:30 AM to 2:15 PM if that's the offset.
                    // Ideally we shift by full days?
                    // But if the gap is 1.1 years...
                    // Let's just shift by the difference. Indicators like EMA rely on relative time/sequence, not wall-clock time.

                    const timeShift = Date.now() - lastBar.time;

                    // Check for significant price level mismatch (e.g. 2025 vs 2026 prices)
                    let priceScale = 1;
                    if (livePrice && lastBar.close) {
                        const rawChange = Math.abs(livePrice - lastBar.close) / lastBar.close;
                        if (rawChange > 0.05) {
                            // console.log(`[MarketData] Price mistmatch ${(rawChange * 100).toFixed(1)}%. Scaling history.`);
                            priceScale = livePrice / lastBar.close;
                        }
                    }

                    data = data.map(b => ({
                        ...b,
                        time: b.time + timeShift,
                        open: b.open * priceScale,
                        high: b.high * priceScale,
                        low: b.low * priceScale,
                        close: b.close * priceScale
                    }));
                }

                data = [...data];
                data[data.length - 1] = {
                    ...data[data.length - 1], // Use the shifted last bar
                    close: livePrice
                };
            }

            const vwapAnchor: any = (tf === '1w') ? 'yearly' : (tf === '1d') ? 'weekly' : 'daily';
            const indicators = calculateIndicators(data, vwapAnchor);
            const last = indicators[indicators.length - 1];

            // Calculate % distance from EMAs
            const getDiff = (price: number, ema: number | undefined) => ema ? ((price - ema) / ema) * 100 : 0;
            const ema9Diff = getDiff(last.close, last.ema9);
            const ema21Diff = getDiff(last.close, last.ema21);
            const ema50Diff = getDiff(last.close, last.ema50);
            const ema200Diff = getDiff(last.close, last.ema200);

            // Check if "Near" (within 0.5%)
            const isNear = [Math.abs(ema9Diff), Math.abs(ema21Diff), Math.abs(ema50Diff), Math.abs(ema200Diff)].some(d => d < 0.5);

            // Determine Trend
            let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
            if (last.close > (last.ema50 || 0)) trend = 'BULLISH';
            else if (last.close < (last.ema50 || 0)) trend = 'BEARISH';

            const macdData = last.macd ? {
                macd: last.macd.MACD || 0,
                signal: last.macd.signal || 0,
                histogram: last.macd.histogram || 0
            } : null;

            const bbData = last.bollinger ? {
                upper: last.bollinger.upper || 0,
                lower: last.bollinger.lower || 0,
                middle: last.bollinger.middle || 0,
                pb: last.bollinger.pb || 0
            } : null;

            results.push({
                timeframe: tf,
                open: last.open,
                close: last.close,
                ema9: last.ema9 || null,
                ema21: last.ema21 || null,
                ema50: last.ema50 || null,
                ema200: last.ema200 || null,
                rsi: last.rsi14 || null,
                adx: last.adx14 || null,
                trend,
                macd: macdData,
                bollinger: bbData,
                vwap: last.vwap || null,
                fvg: last.fvg,
                priceRelToEma: {
                    ema9: ema9Diff,
                    ema21: ema21Diff,
                    ema50: ema50Diff,
                    ema200: ema200Diff,
                    isNear
                },
                divergence: (() => {
                    const last5 = indicators.slice(-5).reverse();
                    const found = last5.find(ind => ind.divergence && ind.divergence.type !== 'NONE');
                    return found ? found.divergence : { type: 'NONE' };
                })()
            });
        }
    }));

    const order: Record<string, number> = { '1h': 1, '4h': 2, '1d': 3, '1w': 4 };
    results.sort((a, b) => (order[a.timeframe] ?? 9) - (order[b.timeframe] ?? 9));

    const headerPrice = latestDaily.close;
    // For OFF sessions, currentPrice should be the post-market price from Yahoo if possible, 
    // but the hybrid stitch logic already uses livePrice (which is post-market in OFF sessions)

    // Ensure currentPrice reflects the most recent data (Post-Market)
    // while headerPrice stays as the Regular Close

    const liveSource = liveData?.source || 'Historical Only';
    const sourceString = liveSource === 'Public.com' ? `Public.com Live + ${dataOrigin}` : `${liveSource} + ${dataOrigin}`;

    return {
        symbol,
        currentPrice,
        headerPrice,
        timeframes: results,
        metrics: {
            atr: dailyAtr,
            avgVolume1y: Math.round(avgVolume),
            volumeDiff: volDiff,
            volatility: (dailyAtr / currentPrice) * 100,
            dayHigh: dailyData[dailyData.length - 1].high,
            dayLow: dailyData[dailyData.length - 1].low,
            beta,
            gammaSqueeze
        },
        dataSource: sourceString,
        marketSession
    };
}

// ── Public entry-point with caching ───────────────────────────────────────────
export async function fetchMultiTimeframeAnalysis(
    symbol: string,
    forceRefresh: boolean = false
): Promise<MultiTimeframeAnalysis | null> {
    const now = Date.now();
    const session = publicClient.getMarketSession();
    const ttl = session === 'OFF' ? MTA_TTL_OFFHRS : MTA_TTL_MARKET;

    if (!forceRefresh) {
        const cached = global._mtaCache.get(symbol);
        if (cached && (now - cached.timestamp < ttl)) {
            console.log(`⚡ [MTA Cache] ${symbol} served from cache (${Math.round((now - cached.timestamp) / 1000)}s old)`);
            return cached.data;
        }
    }

    const result = await _fetchMtaUncached(symbol);
    if (result) {
        global._mtaCache.set(symbol, { data: result, timestamp: now });
    }
    return result;
}

// Deprecated but kept for internal compatibility
async function fetchMarketData(symbol: string, alpacaTf: string, yahooTf: string, limit: number, schwabConfig?: any) {
    const res = await fetchHistoricalData(symbol, alpacaTf, yahooTf, limit, schwabConfig);
    return res.bars;
}
