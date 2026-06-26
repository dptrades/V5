import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();
import { calculateIndicators, calculateConfluenceScore } from './indicators';
import { calculateSentimentScore, getNewsData } from './news';
import { fetchAlpacaBars } from './alpaca';
import { publicClient } from './public-api';
import { runSmartScan, DiscoveredStock } from './smart-scanner';
import { getSectorMap, SCANNER_WATCHLIST, CONVICTION_SCORE_THRESHOLD, MAX_STOCKS_PER_SECTOR, MIN_TECHNICAL_SCORE, MIN_ANALYST_SCORE } from './constants';
import { generateOptionSignal } from './options';
import { logger } from './logger';
import { isCacheStaleBy930AM } from './refresh-utils';
import { saveToBlob, getFromBlob } from './blob-storage';

export const RELATIVE_CONVICTION_CACHE_PATH = 'data/conviction_cache.json';
export const RELATIVE_ALPHA_CACHE_PATH = 'data/alpha_hunter_cache.json';


// Import and re-export types for backwards compatibility
import type { ConvictionStock } from '../types/stock';
import type { OptionRecommendation } from '../types/options';
export type { ConvictionStock } from '../types/stock';

// Enable dynamic discovery - expand search beyond mega caps
const ENABLE_SMART_DISCOVERY = true;

// STRICT Mega Cap Watchlist for "Top Picks" Widget (The "Magnificent 7" + Global Titans)
const MEGA_CAP_WATCHLIST = Array.from(new Set([
    'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', // Mag 7
    'AVGO', 'LLY', 'UNH', 'V', 'JPM', 'XOM', 'WMT', 'MA',    // Top Non-Tech
    'JNJ', 'PG', 'HD', 'COST', 'ABBV', 'MRK', 'KO', 'PEP',   // Top Consumer/Pharma
    'BAC', 'CSCO', 'AMD', 'NFLX', 'CRM', 'ADBE', 'DIS',      // Top Tech/Media
    'MCD', 'TMO', 'ABT', 'LIN', 'ACN', 'DHR', 'TXN', 'QCOM', // Industrial/Tech
    'PM', 'CAT', 'IBM', 'GE', 'UBER', 'ISRG', 'INTU' // Key Leaders
]));

// High Mega Cap & Large Cap Stocks - Explicitly includes Top 50 + Sector Leaders
const CONVICTION_WATCHLIST = Array.from(new Set([
    // --- TOP 50 MEGACAPS (Global Leaders) ---
    'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AVGO', 'LLY', 'UNH',
    'V', 'JPM', 'MA', 'XOM', 'JNJ', 'PG', 'HD', 'ADBE', 'CRM', 'COST',
    'PEP', 'CVX', 'MRK', 'NFLX', 'ABBV', 'AMD', 'KO', 'BAC', 'MCD', 'WMT',
    'TMO', 'CSCO', 'NKE', 'PFE', 'DIS', 'ASML', 'ABT', 'LIN', 'DHR', 'ACN',
    'INTU', 'VRTX', 'T', 'BX', 'QCOM', 'MS', 'GE', 'HON', 'UNP', 'CAT', 'PM',

    // --- ADDITIONAL SEMICONDUCTORS & HARDWARE ---
    'TXN', 'AMAT', 'MU', 'LRCX', 'ADI', 'KLAC', 'MCHP', 'MRVL', 'STM', 'NXPI', 'ON', 'MPWR',
    'IBM', 'APH', 'TEL', 'HPQ', 'DELL', 'ANET', 'GLW', 'STX', 'WDC', 'HPE', 'NTAP', 'PSTG', 'SMCI',

    // --- ADDITIONAL SOFTWARE & CLOUD ---
    'ORCL', 'UBER', 'ABNB', 'PANW', 'SNOW', 'PLTR', 'CRWD', 'WDAY', 'ADSK', 'SNPS', 'CDNS',
    'FTNT', 'ZS', 'DDOG', 'NET', 'TEAM', 'HUBS', 'MDB', 'SQ', 'SHOP', 'TTD', 'RBLX', 'ZM', 'DOCU', 'OKTA', 'TWLO',

    // --- ADDITIONAL FINANCE & PAYMENTS ---
    'WFC', 'C', 'GS', 'BLK', 'AXP', 'SPGI', 'MCO', 'PGR', 'CB', 'MMC', 'AON', 'ICE', 'CME',
    'SCHW', 'KKR', 'APO', 'USB', 'PNC', 'TFC', 'BK', 'STT', 'COF', 'DFS', 'HIG', 'ALL', 'TRV', 'AIG', 'MET', 'PRU',
    'PYPL', 'HOOD', 'SOFI', 'COIN', 'AFRM', 'UPST',

    // --- ADDITIONAL HEALTHCARE & PHARMA ---
    'ISRG', 'SYK', 'ELV', 'CVS', 'CI', 'GILD', 'REGN', 'BMY', 'ZTS', 'BSX', 'BDX', 'HUM', 'MCK', 'COR', 'HCA', 'DXCM',
    'EW', 'ALGN', 'RMD', 'STE', 'BAX', 'ILMN', 'BIIB', 'MRNA', 'BNTX', 'NVS', 'AZN', 'SNY',

    // --- ADDITIONAL CONSUMER DISCRETIONARY & RETAIL ---
    'TGT', 'LOW', 'TJX', 'BKNG', 'MAR', 'HLT', 'CMG', 'YUM', 'DRI', 'DPZ',
    'LULU', 'ORLY', 'AZO', 'ROST', 'FAST', 'TSCO', 'ULTA', 'BBY', 'DG', 'DLTR', 'KSS', 'M', 'JWN', 'GPS', 'AEO', 'ANF',
    'CROX', 'DECK', 'ONON', 'SKX', 'WSM', 'RH', 'W', 'ETSY', 'EBAY', 'CHWY',

    // --- ADDITIONAL CONSUMER STAPLES ---
    'EL', 'CL', 'KMB', 'GIS', 'K', 'HSY', 'MDLZ', 'MNST', 'STZ', 'BF-B', 'ADM', 'SYY',
    'KR', 'ACI', 'BJ', 'WBA',

    // --- ADDITIONAL COMMUNICATION & MEDIA ---
    'CMCSA', 'TMUS', 'VZ', 'CHTR', 'WBD', 'PARA', 'LYV', 'SIRI', 'FOXA', 'OMC', 'IPG', 'TTWO', 'EA',

    // --- ADDITIONAL ENERGY & UTILITIES ---
    'COP', 'SLB', 'EOG', 'PXD', 'MPC', 'PSX', 'VLO', 'OXY', 'HES', 'DVN', 'FANG', 'HAL', 'BKR', 'KMI', 'WMB',
    'NEE', 'DUK', 'SO', 'D', 'AEP', 'SRE', 'EXC', 'XEL', 'ED', 'PEG', 'WEC', 'ES', 'ETR', 'FE', 'PPL',

    // --- ADDITIONAL INDUSTRIAL & AEROSPACE ---
    'DE', 'LMT', 'RTX', 'BA', 'GD', 'NOC', 'LHX', 'TXT', 'HWM', 'TDG',
    'MMM', 'ETN', 'ITW', 'PH', 'EMR', 'CMI', 'PCAR', 'ROK', 'AME', 'DOV', 'SWK', 'GWW', 'FAST', 'URI', 'XYL',

    // --- ADDITIONAL MATERIALS & REAL ESTATE ---
    'LIN', 'SHW', 'APD', 'ECL', 'FCX', 'NEM', 'SCCO', 'NUE', 'STLD', 'CLF', 'X', 'AA', 'MOS', 'CF', 'CTVA', 'FMC', 'ALB',
    'PLD', 'AMT', 'CCI', 'EQIX', 'DLR', 'PSA', 'O', 'SPG', 'VICI', 'WELL', 'AVB', 'EQR', 'INVH', 'MAA', 'ESS', 'CPT',

    // --- INDICES (Context) ---
    'SPY', 'QQQ', 'DIA', 'IWM'
]));


// Alpha Hunter Watchlist - Broader Market Coverage (including growth, momentum, and speculative plays)
const ALPHA_HUNTER_WATCHLIST = Array.from(new Set([
    ...SCANNER_WATCHLIST,
    // Core holdings + Specific growth names not in scanner
    'NVDA', 'MSFT', 'META', 'AMZN', 'GOOGL', 'TSLA', 'AAPL', 'AMD',
    'MU', 'CIEN', 'LUV', 'STX', 'CDE', 'AA', 'AU', 'CRWD', 'HWM', 'NGD',
    'JPM', 'V', 'LLY', 'UNH', 'XOM', 'CAT', 'PLTR',
    'HOOD', 'SOFI', 'RIVN', 'LCID', 'GME'
]));


// Separate caches for each scan mode
// Separate caches for each scan mode
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes (Standard Auto-Refresh)

declare global {
    var _megaCapCacheV9: { data: ConvictionStock[], rawData: ConvictionStock[], timestamp: number } | null;
    var _alphaHunterCacheV8: { data: ConvictionStock[], rawData: ConvictionStock[], timestamp: number } | null;
}

// Initialize global cache if not exists
if (!global._megaCapCacheV9) global._megaCapCacheV9 = null;
if (!global._alphaHunterCacheV8) global._alphaHunterCacheV8 = null;

let isScanning = false;

/**
 * Calculates average volume and last-bar volume difference vs 1y average.
 * Extracted from both scanConviction and scanAlphaHunter processBatch to avoid duplication.
 *
 * TODO: The `processBatch` function itself is duplicated between scanConviction and scanAlphaHunter.
 * The key differences are: (1) score weights, (2) earningsTrend module in Yahoo (Top Picks only),
 * (3) volume surge detection (Alpha Hunter only), and (4) quality gate (Top Picks only).
 * These should be extracted into a single `runScan(config: ScanConfig)` function.
 */
function calcVolStats(data: any[]): { avg: number; diff: number } {
    if (data.length < 10) return { avg: 0, diff: 0 };
    const lookback = data.slice(-253, -1);
    const sum = lookback.reduce((acc: number, val: any) => acc + (val.volume || 0), 0);
    const avg = sum / (lookback.length || 1);
    const lastVol = data[data.length - 1].volume || 0;
    const diff = avg > 0 ? ((lastVol - avg) / avg) * 100 : 0;
    return { avg, diff };
}


export async function scanConviction(forceRefresh = false, returnAll = false): Promise<ConvictionStock[]> {
    const marketSession = publicClient.getMarketSession();

    // Load from Vercel Blob / Local Storage on cold start
    if (!global._megaCapCacheV9 && !forceRefresh) {
        global._megaCapCacheV9 = await getFromBlob<{ data: ConvictionStock[], rawData: ConvictionStock[], timestamp: number } | null>(
            RELATIVE_CONVICTION_CACHE_PATH,
            null
        );
    }

    // Logic: If market is OFF, only scan if cache is empty (one-time baseline fetch).
    // Otherwise, always serve cache during OFF hours to prevent redundant load.
    if (marketSession === 'OFF' && global._megaCapCacheV9 && !forceRefresh) {
        logger.log("🌙 Market is CLOSED. Serving preserved Top Picks cache.");
        return returnAll ? global._megaCapCacheV9.rawData : global._megaCapCacheV9.data;
    }

    // Return cached data if valid and not force-refresh
    if (!forceRefresh && global._megaCapCacheV9 && (Date.now() - global._megaCapCacheV9.timestamp < CACHE_TTL)) {
        const isStale = isCacheStaleBy930AM(global._megaCapCacheV9.timestamp);
        if (!isStale) {
            console.log("⚡ Returning cached mega-cap conviction data");
            return returnAll ? global._megaCapCacheV9.rawData : global._megaCapCacheV9.data;
        }
    }

    // Clear old cache to force immediate update for user
    if (forceRefresh) global._megaCapCacheV9 = null;

    isScanning = true;
    const results: ConvictionStock[] = [];

    // Updated score weightings (now includes discovery bonus)
    // Top Picks weights (Rebalanced to sum to 1.0 since discovery is disabled)
    const W_TECH = 0.30;
    const W_FUND = 0.25;
    const W_ANALYST = 0.25;
    const W_SOCIAL = 0.20;
    const W_DISCOVERY = 0;

    console.log("🚀 Starting Mega-Cap Conviction Scan (Top Picks)...");
    console.log("🔑 Public.com API Status:", publicClient.isConfigured() ? "Configured (Live) ✅" : "Missing (Estimated) ⚠️");

    // Build symbol list - strictly use all tracked sector companies
    let symbolsToScan: string[] = [...MEGA_CAP_WATCHLIST];
    let discoveryMap = new Map<string, DiscoveredStock>();

    // TOP PICKS: Strictly S&P 500 & Nasdaq top companies
    // We disable smart discovery here to maintain institutional-grade focus
    const enableDiscoveryForThisScan = false;

    if (enableDiscoveryForThisScan && ENABLE_SMART_DISCOVERY) {
        console.log("🔍 Running Smart Discovery scan...");
        try {
            const discoveries = await runSmartScan();
            for (const d of discoveries) {
                discoveryMap.set(d.symbol, d);
                if (!symbolsToScan.includes(d.symbol)) {
                    symbolsToScan.push(d.symbol);
                }
            }
            console.log(`✨ Smart Discovery added ${discoveries.length} new candidates`);
        } catch (e) {
            console.error("Smart Discovery failed:", e);
        }
    }

    // Fetch Dynamic Sector Map
    const currentSectorMap = await getSectorMap();

    // Pre-fetch SPY 20-day return for relative strength calculation
    let spy20dReturn = 0;
    try {
        const spyBars = await fetchAlpacaBars('SPY', '1Day', 30);
        if (spyBars && spyBars.length >= 21) {
            const spyClose = spyBars.map((b: any) => b.c);
            spy20dReturn = (spyClose[spyClose.length - 1] / spyClose[spyClose.length - 21]) - 1;
            console.log(`📈 [Scanner] SPY 20d return: ${(spy20dReturn * 100).toFixed(2)}%`);
        }
    } catch (e) {
        console.warn('[Scanner] SPY fetch failed for relative strength, skipping RS signal');
    }

    // Limit total symbols to prevent timeout (Raised limit for Sectors + Picks coverage)
    symbolsToScan = symbolsToScan.slice(0, 300);
    console.log(`📊 [Scanner] Total symbols to scan: ${symbolsToScan.length}`);
    if (symbolsToScan.length === 0) {
        console.error("❌ [Scanner] No symbols in watchlist!");
    }

    // 4. Batch Processing Helper
    const processBatch = async (batch: string[]) => {
        // Fetch ALL Public.com quotes for this batch at once
        const publicQuotes = await publicClient.getQuotes(batch, forceRefresh);
        const publicQuoteMap = new Map(publicQuotes.map(q => [q.symbol, q]));

        const promises = batch.map(async (symbol) => {
            try {
                // 1. Fetch Data (Optimized: Alpaca first, Yahoo fallback)
                console.log(`[Conviction] Fetching data for ${symbol}...`);
                const [quote, socialNews] = await Promise.all([
                    (yahooFinance.quoteSummary(symbol, { modules: ['financialData', 'defaultKeyStatistics', 'recommendationTrend', 'price', 'assetProfile', 'earningsTrend'] }) as Promise<any>).catch(e => { console.error(`[Yahoo] Quote Error ${symbol}:`, e.message); return null; }),
                    // Audit fix #4: despite the 'social' type arg, getNewsData() returns
                    // news-headline sentiment (Yahoo + Finnhub NLP bias), not real
                    // Reddit/Twitter/StockTwits data — see lib/news.ts. Labeled
                    // "News Sentiment" (not "Social Sentiment") in the UI accordingly.
                    (getNewsData(symbol, 'social') as Promise<any>).catch(e => [])
                ]);

                // Fetch chart data efficiently: Alpaca primary, Yahoo fallback
                let alpacaBars = await fetchAlpacaBars(symbol, '1Day', 253).catch(() => null);
                let alpaca1hBars = await fetchAlpacaBars(symbol, '1Hour', 100).catch(() => null);
                let alpaca1wBars = await fetchAlpacaBars(symbol, '1Week', 52).catch(() => null);
                let yahooChart = null;

                if (!alpacaBars || alpacaBars.length <= 50) {
                    yahooChart = await (yahooFinance.chart(symbol, { period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), interval: '1d' }) as Promise<any>).catch(e => { console.error(`[Yahoo] Chart Error ${symbol}:`, e.message); return null; });
                }

                const publicQuote = publicQuoteMap.get(symbol);

                // DECISION: Use Public.com for live price, Alpaca/Yahoo for Chart
                let cleanData: any[] = [];
                let currentPrice = publicQuote?.price || 0;
                let usingAlpaca = false;

                if (alpacaBars && alpacaBars.length > 50) {
                    usingAlpaca = true;
                    cleanData = alpacaBars.map((b: any) => ({
                        time: new Date(b.t).getTime(),
                        open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v
                    }));
                    if (!currentPrice) currentPrice = alpacaBars[alpacaBars.length - 1].c;
                } else if (yahooChart && yahooChart.quotes && yahooChart.quotes.length > 50) {
                    cleanData = yahooChart.quotes.map((q: any) => ({
                        time: new Date(q.date).getTime(),
                        open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume
                    }));
                    // currentPrice will be set from quote later, or last close
                    if (!currentPrice) currentPrice = cleanData[cleanData.length - 1].close;
                } else {
                    console.warn(`⚠️ Skipping ${symbol}: Missing Chart Data (Alpaca & Yahoo failed)`);
                    return null;
                }


                const indicators = calculateIndicators(cleanData);
                const latest = indicators[indicators.length - 1];
                latest.timeframe = '1d';
                
                const allTimeframes = [latest];
                if (alpaca1hBars && alpaca1hBars.length > 20) {
                    const h1Data = alpaca1hBars.map((b: any) => ({ time: new Date(b.t).getTime(), open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v }));
                    const h1Inds = calculateIndicators(h1Data);
                    const h1Latest = h1Inds[h1Inds.length - 1];
                    h1Latest.timeframe = '1h';
                    allTimeframes.push(h1Latest);
                }
                if (alpaca1wBars && alpaca1wBars.length > 20) {
                    const w1Data = alpaca1wBars.map((b: any) => ({ time: new Date(b.t).getTime(), open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v }));
                    const w1Inds = calculateIndicators(w1Data);
                    const w1Latest = w1Inds[w1Inds.length - 1];
                    w1Latest.timeframe = '1w';
                    allTimeframes.push(w1Latest);
                }

                // Synchronized Technical Scoring
                const confluence = calculateConfluenceScore(latest);
                let techScore = confluence.strength;
                const trend = confluence.trend;
                const rsi = latest.rsi14 || 50;

                // Overbought penalty: extreme RSI is a warning sign, not a strength.
                // Audit fix #6: this is now the SOLE place RSI>80 is scored — the
                // confluence momentum block (lib/indicators.ts) no longer awards a
                // "bullish momentum" vote for the same condition, which previously
                // contradicted this penalty.
                if (rsi > 80) techScore = Math.max(0, techScore - 10);

                // 52-week high proximity bonus (+10 if within 5% of 52w high)
                let near52wHigh = false;
                if (cleanData.length >= 50) {
                    const high52w = Math.max(...cleanData.slice(-252).map((d: any) => d.high || 0));
                    if (high52w > 0 && latest.close >= high52w * 0.95) {
                        techScore = Math.min(100, techScore + 10);
                        near52wHigh = true;
                    }
                }

                // Relative strength vs SPY (20-day): +10 if outperforming by >5%, -5 if underperforming by >5%
                let outperformingSPY = false;
                let volumeSurge = false;
                if (cleanData.length >= 21 && spy20dReturn !== 0) {
                    const stock20dReturn = (cleanData[cleanData.length - 1].close / cleanData[cleanData.length - 21].close) - 1;
                    const relStrength = stock20dReturn - spy20dReturn;
                    if (relStrength > 0.05) { techScore = Math.min(100, techScore + 10); outperformingSPY = true; }
                    else if (relStrength < -0.05) techScore = Math.max(0, techScore - 5);
                }


                // 3. Process Fundamentals (Graceful Fallback)
                // Audit fix #8: fields below previously defaulted to 0 via `|| 0`
                // whenever Yahoo had no data for them (common for foreign filers,
                // recent IPOs, or unprofitable companies with no trailing PE) — making
                // "missing" indistinguishable from "actually reported as zero". Every
                // scoring check here is a one-directional threshold, so a 0 default
                // happened not to fire a false bonus/penalty, but the *displayed*
                // metrics (see `metrics` below) were showing a fabricated 0 as if it
                // were real. Each field now tracks presence explicitly via `*Raw`
                // (null when missing) and only contributes to fundScore when present.
                const financialData = quote?.financialData || {};
                const stats = quote?.defaultKeyStatistics || {};
                let fundScore = 50;
                const missingFundamentals: string[] = [];

                const peRaw: number | null = financialData.trailingPE ?? stats.forwardPE ?? null;
                if (peRaw == null) missingFundamentals.push('pe');
                const pe = peRaw ?? 0;
                if (peRaw != null && pe > 0 && pe < 40) fundScore += 10;
                if (peRaw != null && pe > 100) fundScore -= 10;

                const revGrowthRaw: number | null = financialData.revenueGrowth ?? null;
                if (revGrowthRaw == null) missingFundamentals.push('revenueGrowth');
                const revGrowth = revGrowthRaw ?? 0;
                if (revGrowthRaw != null && revGrowth > 0.10) fundScore += 15;

                const marginsRaw: number | null = financialData.profitMargins ?? null;
                if (marginsRaw == null) missingFundamentals.push('profitMargins');
                const margins = marginsRaw ?? 0;
                if (marginsRaw != null && margins > 0.20) fundScore += 10;

                // EPS growth bonus
                const epsGrowthRaw: number | null = financialData.earningsGrowth ?? null;
                if (epsGrowthRaw == null) missingFundamentals.push('earningsGrowth');
                const epsGrowth = epsGrowthRaw ?? 0;
                if (epsGrowthRaw != null && epsGrowth > 0.10) fundScore += 10;

                // Free cash flow margin bonus (>15% FCF/Revenue = capital-efficient business)
                const fcfRaw: number | null = financialData.freeCashflow ?? null;
                const totalRevenueRaw: number | null = financialData.totalRevenue ?? null;
                if (fcfRaw == null || totalRevenueRaw == null) missingFundamentals.push('freeCashflow');
                const fcf = fcfRaw ?? 0;
                const totalRevenue = totalRevenueRaw ?? 0;
                if (fcfRaw != null && totalRevenueRaw != null && fcf > 0 && totalRevenue > 0 && (fcf / totalRevenue) > 0.15) fundScore += 10;

                // Debt-to-equity penalty (high leverage = risk).
                // Audit fix #3: Yahoo's financialData.debtToEquity is returned on a
                // percentage scale (e.g. 150 means a 1.5x ratio), not a raw ratio. The
                // old `> 2.0` check compared a percentage-scale value against a
                // ratio-scale threshold, so it fired for nearly any company carrying
                // even trivial debt (anything >= 2, i.e. a 0.02x ratio). Normalize to
                // an actual ratio before comparing against the intended 2.0x threshold.
                const debtToEquityRaw: number | null = financialData.debtToEquity ?? null;
                if (debtToEquityRaw == null) missingFundamentals.push('debtToEquity');
                const debtToEquity = (debtToEquityRaw ?? 0) / 100;
                if (debtToEquityRaw != null && debtToEquity > 2.0) fundScore -= 10;

                // Insider ownership bonus (aligned incentives)
                const insiderPctRaw: number | null = stats.heldPercentInsiders ?? null;
                if (insiderPctRaw == null) missingFundamentals.push('insiderOwnership');
                const insiderPct = insiderPctRaw ?? 0;
                if (insiderPctRaw != null && insiderPct > 0.05) fundScore += 5;

                fundScore = Math.max(0, Math.min(100, fundScore));


                // 4. Process Analysts (Graceful Fallback)
                let analystScore = 50;
                const rating = financialData.recommendationMean;
                let ratingText = "Neutral";
                if (rating) {
                    if (rating <= 2.0) { analystScore = 90; ratingText = "Strong Buy"; }
                    else if (rating <= 3.0) { analystScore = 70; ratingText = "Buy"; }
                    else if (rating > 4.0) { analystScore = 20; ratingText = "Sell"; }
                    else { analystScore = 50; ratingText = "Hold"; }
                }
                const targetPrice = financialData.targetMeanPrice || 0;
                // Use Alpaca price if we have it, else valid Yahoo price, else latest close
                const finalPrice = usingAlpaca ? currentPrice : (financialData.currentPrice?.raw || currentPrice);

                // Audit fix #8: cross-vendor price sanity check. `currentPrice` comes
                // from Public.com (or an Alpaca bar close as fallback); Yahoo's
                // financialData.currentPrice is an independent second snapshot. Neither
                // vendor is checked against the other anywhere else in this pipeline, so
                // a stale cache entry, a wrong symbol mapping, or an unadjusted stock
                // split on one side could silently feed a bad price straight into the
                // score and into suggestedOption's strike math. Large disagreement
                // (>10%) is treated as a data error and the symbol is skipped; moderate
                // disagreement (2-10%, plausible from quote-timing/after-hours staleness
                // alone) is allowed through but flagged via _priceVerified so consumers
                // know not to fully trust the price.
                const yahooPriceCheck = financialData.currentPrice?.raw || 0;
                let priceDisagreementPct: number | undefined;
                let priceVerified = true;
                if (currentPrice > 0 && yahooPriceCheck > 0) {
                    priceDisagreementPct = Math.abs(currentPrice - yahooPriceCheck) / yahooPriceCheck;
                    if (priceDisagreementPct > 0.10) {
                        console.warn(`⚠️ [Conviction] Skipping ${symbol}: vendor price disagreement ${(priceDisagreementPct * 100).toFixed(1)}% (Public/Alpaca=$${currentPrice.toFixed(2)} vs Yahoo=$${yahooPriceCheck.toFixed(2)})`);
                        return null;
                    }
                    priceVerified = priceDisagreementPct <= 0.02;
                }

                // Upside potential
                if (targetPrice > finalPrice) {
                    const upside = ((targetPrice - finalPrice) / finalPrice) * 100;
                    if (upside > 10) analystScore += 10;
                }

                // EPS surprise / earnings momentum
                let epsSurpriseCount = 0;
                const earningsTrendData = (quote as any)?.earningsTrend?.trend || [];
                for (const et of earningsTrendData.slice(0, 2)) {
                    const actual = et?.actual?.raw ?? et?.actual;
                    const estimate = et?.estimate?.raw ?? et?.estimate;
                    if (actual != null && estimate != null && Number(actual) > Number(estimate)) {
                        epsSurpriseCount++;
                    }
                }
                if (epsSurpriseCount >= 2) analystScore = Math.min(100, analystScore + 15);
                else if (epsSurpriseCount === 1) analystScore = Math.min(100, analystScore + 8);


                // 5. Process Social
                const { score: socialScore, label: socialLabel } = calculateSentimentScore(socialNews);

                // 6. Discovery Bonus (if stock was found by smart scanner)
                const discovery = discoveryMap.get(symbol);
                const discoveryScore = discovery ? discovery.strength : 0;
                const discoverySource = discovery ? discovery.source : null;

                // 7. TOTAL SCORE (with discovery bonus)
                const finalScore = (
                    (techScore * W_TECH) +
                    (fundScore * W_FUND) +
                    (analystScore * W_ANALYST) +
                    (socialScore * W_SOCIAL) +
                    (discoveryScore * W_DISCOVERY)
                );

                // Calculate 24h Change and Volume Analysis
                let change24h = 0;
                let volume = 0;
                let volumeAvg1y = 0;
                let volumeDiff = 0;


                if (usingAlpaca && cleanData.length > 1) {
                    const last = cleanData[cleanData.length - 1];
                    const prev = cleanData[cleanData.length - 2];
                    change24h = ((last.close - prev.close) / prev.close) * 100;
                    volume = last.volume;
                    const stats = calcVolStats(cleanData);
                    volumeAvg1y = stats.avg;
                    volumeDiff = stats.diff;
                } else if (quote?.price) {
                    change24h = (quote.price.regularMarketChangePercent || 0) * 100;
                    volume = quote.price.regularMarketVolume || 0;
                    if (cleanData.length > 1) {
                        const stats = calcVolStats(cleanData);
                        volumeAvg1y = stats.avg;
                        volumeDiff = stats.diff;
                    }
                } else if (cleanData.length > 1) {
                    const last = cleanData[cleanData.length - 1];
                    const prev = cleanData[cleanData.length - 2];
                    change24h = ((last.close - prev.close) / prev.close) * 100;
                    volume = last.volume;
                    const stats = calcVolStats(cleanData);
                    volumeAvg1y = stats.avg;
                    volumeDiff = stats.diff;
                }

                // Reasons
                const reasons: string[] = [];
                if (discovery) reasons.push(`🔍 ${discovery.signal}`);
                if (trend === 'BULLISH') reasons.push("Strong Technical Uptrend");
                if (techScore > 70) reasons.push("Bullish Momentum (RSI)");
                if (near52wHigh) reasons.push('🏔️ Near 52W High');
                if (outperformingSPY) reasons.push('📈 Outperforming SPY');
                if (volumeSurge) reasons.push('🔥 Volume Surge');
                if (fundScore > 70) reasons.push("Solid Fundamentals");
                if (analystScore > 80) reasons.push(`Analyst Consensus: ${ratingText}`);
                if (epsSurpriseCount >= 2) reasons.push('📊 2x EPS Beat');
                else if (epsSurpriseCount === 1) reasons.push('📊 EPS Beat');
                if (socialScore > 75) reasons.push("High Social Interest");
                if (volumeDiff > 50) reasons.push(`High Volume (+${Math.round(volumeDiff)}%)`);

                // Generate Option Signal
                // Use ATR if available, else 2% proxy
                const atr = latest.atr14 || (latest.close * 0.02);
                const trendLower = trend.toLowerCase() as 'bullish' | 'bearish' | 'neutral';
                const optionSignal = await generateOptionSignal(latest.close, atr, trendLower, rsi, latest.ema50, latest, symbol, undefined, undefined, undefined, false, allTimeframes);


                // Add option reason if high confidence
                if (optionSignal.type !== 'WAIT') {
                    reasons.push(`🎯 Option Setup: ${optionSignal.type} @ $${optionSignal.strike}`);
                }

                return {
                    symbol,
                    name: (quote?.price as any)?.longName || (quote?.price as any)?.shortName || (quote as any)?.displayName || symbol,
                    price: finalPrice || 0,
                    score: Math.round(finalScore),
                    technicalScore: Math.round(techScore),
                    fundamentalScore: Math.round(fundScore),
                    analystScore: Math.round(analystScore),
                    sentimentScore: Math.round(socialScore),
                    metrics: {
                        // Audit fix #8: expose the raw (possibly null) value rather than
                        // the zero-filled one, so "no data" isn't shown as "reported 0".
                        pe: peRaw ?? undefined,
                        marketCap: (quote?.price as any)?.marketCap || 0,
                        revenueGrowth: revGrowthRaw ?? undefined,
                        missingFundamentals: missingFundamentals.length > 0 ? missingFundamentals : undefined,
                        rsi: Math.round(rsi),
                        trend,
                        analystRating: ratingText,
                        analystTarget: targetPrice,
                        socialSentiment: socialLabel,
                        atr14: atr,
                        ema50: latest.ema50
                    },
                    _priceVerified: priceVerified,
                    priceDisagreementPct,
                    reasons,
                    discoverySource,
                    change24h,
                    volume,
                    volumeAvg1y,
                    volumeDiff,
                    sector: currentSectorMap[symbol] || quote?.assetProfile?.sector || 'Other',

                    suggestedOption: optionSignal
                } as ConvictionStock;

            } catch (e) {
                console.error(`❌ Global Conviction Error for ${symbol}:`, e);
                return null;
            }
        });

        return Promise.all(promises);
    }

    // Process in chunks of 5
    const CHUNK_SIZE = 20;
    for (let i = 0; i < symbolsToScan.length; i += CHUNK_SIZE) {
        const batch = symbolsToScan.slice(i, i + CHUNK_SIZE);
        console.log(`📦 Processing batch ${i / CHUNK_SIZE + 1}/${Math.ceil(symbolsToScan.length / CHUNK_SIZE)}: ${batch.join(', ')}`);

        const batchResults = await processBatch(batch);

        // Filter out nulls and add to results
        batchResults.forEach(r => {
            if (r) results.push(r);
        });

        // Small delay between batches to be nice to APIs
        if (i + CHUNK_SIZE < symbolsToScan.length) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    // Sort by score desc
    const sortedRaw = results.sort((a, b) => b.score - a.score);

    // Quality gate: require minimum sub-scores to avoid technically broken stocks
    // (Alpha Hunter intentionally skips this to stay broader)
    const qualityGated = sortedRaw.filter(r =>
        r.technicalScore >= MIN_TECHNICAL_SCORE && r.analystScore >= MIN_ANALYST_SCORE
    );
    logger.log(`✅ [Top Picks] Quality gate: ${sortedRaw.length} → ${qualityGated.length} stocks (technicalScore ≥${MIN_TECHNICAL_SCORE} & analystScore ≥${MIN_ANALYST_SCORE})`);

    // Sector diversity cap: max MAX_STOCKS_PER_SECTOR (currently 6) stocks per sector
    // (audit fix #7: this comment said "max 3" while the constant has been 6 for a
    // while — drifted out of sync. Read MAX_STOCKS_PER_SECTOR in lib/constants.ts
    // for the live value rather than trusting a hardcoded number in a comment.)
    const sectorCounts: Record<string, number> = {};
    const diversified = qualityGated.filter(r => {
        const sector = r.sector || 'Other';
        sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
        return sectorCounts[sector] <= MAX_STOCKS_PER_SECTOR;
    });
    logger.log(`🏦 [Top Picks] Sector cap applied: ${qualityGated.length} → ${diversified.length} stocks (max ${MAX_STOCKS_PER_SECTOR} per sector)`);

    // Score >= CONVICTION_SCORE_THRESHOLD (currently 50, not 75 — audit fix #7:
    // this comment was stale; see lib/constants.ts for the live value)
    const sortedFiltered = diversified.filter(r => r.score >= CONVICTION_SCORE_THRESHOLD);

    // Update Cache
    global._megaCapCacheV9 = {
        data: sortedFiltered,
        rawData: sortedRaw,
        timestamp: Date.now()
    };
    await saveToBlob(RELATIVE_CONVICTION_CACHE_PATH, global._megaCapCacheV9);
    isScanning = false;
    console.log(`🏁 [Scanner] Scan complete. Found ${sortedRaw.length} total → ${sortedFiltered.length} Top Picks (quality + sector + score filtered).`);
    return returnAll ? sortedRaw : sortedFiltered;
}

// Alpha Hunter - Broader Market Scan with Smart Discovery
export async function scanAlphaHunter(forceRefresh = false, returnAll = false): Promise<ConvictionStock[]> {
    const marketSession = publicClient.getMarketSession();

    // Load from Vercel Blob / Local Storage on cold start
    if (!global._alphaHunterCacheV8 && !forceRefresh) {
        global._alphaHunterCacheV8 = await getFromBlob<{ data: ConvictionStock[], rawData: ConvictionStock[], timestamp: number } | null>(
            RELATIVE_ALPHA_CACHE_PATH,
            null
        );
    }

    // Logic: If market is OFF, only scan if cache is empty.
    if (marketSession === 'OFF' && global._alphaHunterCacheV8 && !forceRefresh) {
        logger.log("🌙 Market is CLOSED. Serving preserved Alpha Hunter cache.");
        return returnAll ? global._alphaHunterCacheV8.rawData : global._alphaHunterCacheV8.data;
    }

    // Return cached data if valid
    if (!forceRefresh && global._alphaHunterCacheV8 && (Date.now() - global._alphaHunterCacheV8.timestamp < CACHE_TTL)) {
        const isStale = isCacheStaleBy930AM(global._alphaHunterCacheV8.timestamp);
        if (!isStale) {
            console.log("⚡ Returning cached Alpha Hunter data");
            return returnAll ? global._alphaHunterCacheV8.rawData : global._alphaHunterCacheV8.data;
        }
    }

    // Clear old cache to force immediate update for user
    if (forceRefresh) global._alphaHunterCacheV8 = null;

    isScanning = true;
    const results: ConvictionStock[] = [];

    // Score weightings - balanced to prevent social/discovery dominance
    const W_TECH = 0.25;
    const W_FUND = 0.20; // Raised from 0.10 — fundamentals now matters more
    const W_ANALYST = 0.10;
    const W_SOCIAL = 0.15;
    const W_DISCOVERY = 0.30; // Reduced from 0.40 — discovery still important but balanced

    console.log("🚀 Starting Alpha Hunter Scan (Full Market)...");
    console.log("🔑 Public.com API Status:", publicClient.isConfigured() ? "Configured (Live) ✅" : "Missing (Estimated) ⚠️");

    // Build symbol list - combine broader watchlist with dynamic discoveries
    let symbolsToScan: string[] = [...ALPHA_HUNTER_WATCHLIST];
    let discoveryMap = new Map<string, DiscoveredStock>();

    // Enable Smart Discovery for Alpha Hunter
    console.log("🔍 Running Smart Discovery scan...");
    try {
        const discoveries = await runSmartScan();
        for (const d of discoveries) {
            discoveryMap.set(d.symbol, d);
            if (!symbolsToScan.includes(d.symbol)) {
                symbolsToScan.push(d.symbol);
            }
        }
        console.log(`✨ Smart Discovery added ${discoveries.length} new candidates`);
    } catch (e) {
        console.error("Smart Discovery failed:", e);
    }

    // Fetch Dynamic Sector Map
    const currentSectorMap = await getSectorMap();

    // Pre-fetch SPY 20-day return for relative strength calculation
    let spy20dReturn = 0;
    try {
        const spyBars = await fetchAlpacaBars('SPY', '1Day', 30);
        if (spyBars && spyBars.length >= 21) {
            const spyClose = spyBars.map((b: any) => b.c);
            spy20dReturn = (spyClose[spyClose.length - 1] / spyClose[spyClose.length - 21]) - 1;
            console.log(`📈 [Alpha Hunter] SPY 20d return: ${(spy20dReturn * 100).toFixed(2)}%`);
        }
    } catch (e) {
        console.warn('[Alpha Hunter] SPY fetch failed for relative strength, skipping RS signal');
    }

    // Limit total symbols to prevent timeout
    symbolsToScan = symbolsToScan.slice(0, 300);
    console.log(`📊 Total symbols to scan: ${symbolsToScan.length}`);

    // 4. Batch Processing Helper
    const processBatch = async (batch: string[]) => {
        // Fetch ALL Public.com quotes for this batch at once
        const publicQuotes = await publicClient.getQuotes(batch, forceRefresh);
        const publicQuoteMap = new Map(publicQuotes.map(q => [q.symbol, q]));

        const promises = batch.map(async (symbol) => {
            try {
                // 1. Fetch Data (Optimized: Alpaca first, Yahoo fallback)
                console.log(`[Alpha Hunter] Fetching data for ${symbol}...`);
                const [quote, socialNews] = await Promise.all([
                    (yahooFinance.quoteSummary(symbol, { modules: ['financialData', 'defaultKeyStatistics', 'recommendationTrend', 'price', 'assetProfile'] }) as Promise<any>).catch(e => { console.error(`[Yahoo] Quote Error ${symbol}:`, e.message); return null; }),
                    // Audit fix #4: despite the 'social' type arg, getNewsData() returns
                    // news-headline sentiment (Yahoo + Finnhub NLP bias), not real
                    // Reddit/Twitter/StockTwits data — see lib/news.ts. Labeled
                    // "News Sentiment" (not "Social Sentiment") in the UI accordingly.
                    (getNewsData(symbol, 'social') as Promise<any>).catch(e => [])
                ]);

                // Fetch chart data efficiently: Alpaca primary, Yahoo fallback
                let alpacaBars = await fetchAlpacaBars(symbol, '1Day', 253).catch(() => null);
                let alpaca1hBars = await fetchAlpacaBars(symbol, '1Hour', 100).catch(() => null);
                let alpaca1wBars = await fetchAlpacaBars(symbol, '1Week', 52).catch(() => null);
                let yahooChart = null;

                if (!alpacaBars || alpacaBars.length <= 50) {
                    yahooChart = await (yahooFinance.chart(symbol, { period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), interval: '1d' }) as Promise<any>).catch(e => { console.error(`[Yahoo] Chart Error ${symbol}:`, e.message); return null; });
                }

                const publicQuote = publicQuoteMap.get(symbol);

                // DECISION: Use Public.com for live price, Alpaca/Yahoo for Chart
                let cleanData: any[] = [];
                let currentPrice = publicQuote?.price || 0;
                let usingAlpaca = false;

                if (alpacaBars && alpacaBars.length > 50) {
                    usingAlpaca = true;
                    cleanData = alpacaBars.map((b: any) => ({
                        time: new Date(b.t).getTime(),
                        open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v
                    }));
                    if (!currentPrice) currentPrice = alpacaBars[alpacaBars.length - 1].c;
                } else if (yahooChart && yahooChart.quotes && yahooChart.quotes.length > 50) {
                    cleanData = yahooChart.quotes.map((q: any) => ({
                        time: new Date(q.date).getTime(),
                        open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume
                    }));
                    // currentPrice will be set from quote later, or last close
                    if (!currentPrice) currentPrice = cleanData[cleanData.length - 1].close;
                } else {
                    console.warn(`⚠️ Skipping ${symbol}: Missing Chart Data (Alpaca & Yahoo failed)`);
                    return null;
                }


                const indicators = calculateIndicators(cleanData);
                const latest = indicators[indicators.length - 1];
                latest.timeframe = '1d';
                
                const allTimeframes = [latest];
                if (alpaca1hBars && alpaca1hBars.length > 20) {
                    const h1Data = alpaca1hBars.map((b: any) => ({ time: new Date(b.t).getTime(), open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v }));
                    const h1Inds = calculateIndicators(h1Data);
                    const h1Latest = h1Inds[h1Inds.length - 1];
                    h1Latest.timeframe = '1h';
                    allTimeframes.push(h1Latest);
                }
                if (alpaca1wBars && alpaca1wBars.length > 20) {
                    const w1Data = alpaca1wBars.map((b: any) => ({ time: new Date(b.t).getTime(), open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v }));
                    const w1Inds = calculateIndicators(w1Data);
                    const w1Latest = w1Inds[w1Inds.length - 1];
                    w1Latest.timeframe = '1w';
                    allTimeframes.push(w1Latest);
                }

                // Synchronized Technical Scoring
                const confluence = calculateConfluenceScore(latest);
                let techScore = confluence.strength;
                const trend = confluence.trend;
                const rsi = latest.rsi14 || 50;

                // Overbought penalty: extreme RSI is a warning sign, not a strength.
                // Audit fix #6: this is now the SOLE place RSI>80 is scored — the
                // confluence momentum block (lib/indicators.ts) no longer awards a
                // "bullish momentum" vote for the same condition, which previously
                // contradicted this penalty.
                if (rsi > 80) techScore = Math.max(0, techScore - 10);

                // 52-week high proximity bonus (+10 if within 5% of 52w high)
                let near52wHigh = false;
                if (cleanData.length >= 50) {
                    const high52w = Math.max(...cleanData.slice(-252).map((d: any) => d.high || 0));
                    if (high52w > 0 && latest.close >= high52w * 0.95) {
                        techScore = Math.min(100, techScore + 10);
                        near52wHigh = true;
                    }
                }

                // Relative strength vs SPY (20-day): +10 if outperforming by >5%, -5 if underperforming by >5%
                let outperformingSPY = false;
                let volumeSurge = false;
                if (cleanData.length >= 21 && spy20dReturn !== 0) {
                    const stock20dReturn = (cleanData[cleanData.length - 1].close / cleanData[cleanData.length - 21].close) - 1;
                    const relStrength = stock20dReturn - spy20dReturn;
                    if (relStrength > 0.05) { techScore = Math.min(100, techScore + 10); outperformingSPY = true; }
                    else if (relStrength < -0.05) techScore = Math.max(0, techScore - 5);
                }


                // 3. Process Fundamentals (Graceful Fallback)
                // Audit fix #8: fields below previously defaulted to 0 via `|| 0`
                // whenever Yahoo had no data for them (common for foreign filers,
                // recent IPOs, or unprofitable companies with no trailing PE) — making
                // "missing" indistinguishable from "actually reported as zero". Every
                // scoring check here is a one-directional threshold, so a 0 default
                // happened not to fire a false bonus/penalty, but the *displayed*
                // metrics (see `metrics` below) were showing a fabricated 0 as if it
                // were real. Each field now tracks presence explicitly via `*Raw`
                // (null when missing) and only contributes to fundScore when present.
                const financialData = quote?.financialData || {};
                const stats = quote?.defaultKeyStatistics || {};
                let fundScore = 50;
                const missingFundamentals: string[] = [];

                const peRaw: number | null = financialData.trailingPE ?? stats.forwardPE ?? null;
                if (peRaw == null) missingFundamentals.push('pe');
                const pe = peRaw ?? 0;
                if (peRaw != null && pe > 0 && pe < 40) fundScore += 10;
                if (peRaw != null && pe > 100) fundScore -= 10;

                const revGrowthRaw: number | null = financialData.revenueGrowth ?? null;
                if (revGrowthRaw == null) missingFundamentals.push('revenueGrowth');
                const revGrowth = revGrowthRaw ?? 0;
                if (revGrowthRaw != null && revGrowth > 0.10) fundScore += 15;

                const marginsRaw: number | null = financialData.profitMargins ?? null;
                if (marginsRaw == null) missingFundamentals.push('profitMargins');
                const margins = marginsRaw ?? 0;
                if (marginsRaw != null && margins > 0.20) fundScore += 10;

                // EPS growth bonus
                const epsGrowthRaw: number | null = financialData.earningsGrowth ?? null;
                if (epsGrowthRaw == null) missingFundamentals.push('earningsGrowth');
                const epsGrowth = epsGrowthRaw ?? 0;
                if (epsGrowthRaw != null && epsGrowth > 0.10) fundScore += 10;

                // Free cash flow margin bonus (>15% FCF/Revenue = capital-efficient business)
                const fcfRaw: number | null = financialData.freeCashflow ?? null;
                const totalRevenueRaw: number | null = financialData.totalRevenue ?? null;
                if (fcfRaw == null || totalRevenueRaw == null) missingFundamentals.push('freeCashflow');
                const fcf = fcfRaw ?? 0;
                const totalRevenue = totalRevenueRaw ?? 0;
                if (fcfRaw != null && totalRevenueRaw != null && fcf > 0 && totalRevenue > 0 && (fcf / totalRevenue) > 0.15) fundScore += 10;

                // Debt-to-equity penalty (high leverage = risk).
                // Audit fix #3: Yahoo's financialData.debtToEquity is returned on a
                // percentage scale (e.g. 150 means a 1.5x ratio), not a raw ratio. The
                // old `> 2.0` check compared a percentage-scale value against a
                // ratio-scale threshold, so it fired for nearly any company carrying
                // even trivial debt (anything >= 2, i.e. a 0.02x ratio). Normalize to
                // an actual ratio before comparing against the intended 2.0x threshold.
                const debtToEquityRaw: number | null = financialData.debtToEquity ?? null;
                if (debtToEquityRaw == null) missingFundamentals.push('debtToEquity');
                const debtToEquity = (debtToEquityRaw ?? 0) / 100;
                if (debtToEquityRaw != null && debtToEquity > 2.0) fundScore -= 10;

                // Insider ownership bonus (aligned incentives)
                const insiderPctRaw: number | null = stats.heldPercentInsiders ?? null;
                if (insiderPctRaw == null) missingFundamentals.push('insiderOwnership');
                const insiderPct = insiderPctRaw ?? 0;
                if (insiderPctRaw != null && insiderPct > 0.05) fundScore += 5;

                fundScore = Math.max(0, Math.min(100, fundScore));


                // 4. Process Analysts (Graceful Fallback)
                let analystScore = 50;
                const rating = financialData.recommendationMean;
                let ratingText = "Neutral";
                if (rating) {
                    if (rating <= 2.0) { analystScore = 90; ratingText = "Strong Buy"; }
                    else if (rating <= 3.0) { analystScore = 70; ratingText = "Buy"; }
                    else if (rating > 4.0) { analystScore = 20; ratingText = "Sell"; }
                    else { analystScore = 50; ratingText = "Hold"; }
                }
                const targetPrice = financialData.targetMeanPrice || 0;
                // Use Alpaca price if we have it, else valid Yahoo price, else latest close
                const finalPrice = usingAlpaca ? currentPrice : (financialData.currentPrice?.raw || currentPrice);

                // Audit fix #8: cross-vendor price sanity check. `currentPrice` comes
                // from Public.com (or an Alpaca bar close as fallback); Yahoo's
                // financialData.currentPrice is an independent second snapshot. Neither
                // vendor is checked against the other anywhere else in this pipeline, so
                // a stale cache entry, a wrong symbol mapping, or an unadjusted stock
                // split on one side could silently feed a bad price straight into the
                // score and into suggestedOption's strike math. Large disagreement
                // (>10%) is treated as a data error and the symbol is skipped; moderate
                // disagreement (2-10%, plausible from quote-timing/after-hours staleness
                // alone) is allowed through but flagged via _priceVerified so consumers
                // know not to fully trust the price.
                const yahooPriceCheck = financialData.currentPrice?.raw || 0;
                let priceDisagreementPct: number | undefined;
                let priceVerified = true;
                if (currentPrice > 0 && yahooPriceCheck > 0) {
                    priceDisagreementPct = Math.abs(currentPrice - yahooPriceCheck) / yahooPriceCheck;
                    if (priceDisagreementPct > 0.10) {
                        console.warn(`⚠️ [Conviction] Skipping ${symbol}: vendor price disagreement ${(priceDisagreementPct * 100).toFixed(1)}% (Public/Alpaca=$${currentPrice.toFixed(2)} vs Yahoo=$${yahooPriceCheck.toFixed(2)})`);
                        return null;
                    }
                    priceVerified = priceDisagreementPct <= 0.02;
                }

                // Upside potential
                if (targetPrice > finalPrice) {
                    const upside = ((targetPrice - finalPrice) / finalPrice) * 100;
                    if (upside > 10) analystScore += 10;
                }

                // EPS surprise / earnings momentum
                let epsSurpriseCount = 0;
                const earningsTrendData = (quote as any)?.earningsTrend?.trend || [];
                for (const et of earningsTrendData.slice(0, 2)) {
                    const actual = et?.actual?.raw ?? et?.actual;
                    const estimate = et?.estimate?.raw ?? et?.estimate;
                    if (actual != null && estimate != null && Number(actual) > Number(estimate)) {
                        epsSurpriseCount++;
                    }
                }
                if (epsSurpriseCount >= 2) analystScore = Math.min(100, analystScore + 15);
                else if (epsSurpriseCount === 1) analystScore = Math.min(100, analystScore + 8);


                // 5. Process Social
                const { score: socialScore, label: socialLabel } = calculateSentimentScore(socialNews);

                // 6. Discovery Bonus (if stock was found by smart scanner)
                const discovery = discoveryMap.get(symbol);
                const discoveryScore = discovery ? discovery.strength : 0;
                const discoverySource = discovery ? discovery.source : null;

                // 7. TOTAL SCORE (with discovery bonus)
                const finalScore = (
                    (techScore * W_TECH) +
                    (fundScore * W_FUND) +
                    (analystScore * W_ANALYST) +
                    (socialScore * W_SOCIAL) +
                    (discoveryScore * W_DISCOVERY)
                );

                // Calculate 24h Change and Volume Analysis
                let change24h = 0;
                let volume = 0;
                let volumeAvg1y = 0;
                let volumeDiff = 0;


                if (usingAlpaca && cleanData.length > 1) {
                    const last = cleanData[cleanData.length - 1];
                    const prev = cleanData[cleanData.length - 2];
                    change24h = ((last.close - prev.close) / prev.close) * 100;
                    volume = last.volume;
                    const stats = calcVolStats(cleanData);
                    volumeAvg1y = stats.avg;
                    volumeDiff = stats.diff;
                } else if (quote?.price) {
                    change24h = (quote.price.regularMarketChangePercent || 0) * 100;
                    volume = quote.price.regularMarketVolume || 0;
                    // If we have chart data from Yahoo, use it for stats
                    if (cleanData.length > 1) {
                        const stats = calcVolStats(cleanData);
                        volumeAvg1y = stats.avg;
                        volumeDiff = stats.diff;
                    }
                } else if (cleanData.length > 1) {
                    const last = cleanData[cleanData.length - 1];
                    const prev = cleanData[cleanData.length - 2];
                    change24h = ((last.close - prev.close) / prev.close) * 100;
                    volume = last.volume;
                    const stats = calcVolStats(cleanData);
                    volumeAvg1y = stats.avg;
                    volumeDiff = stats.diff;
                }

                // Alpha Hunter: Volume surge detection — boost techScore if today is 1.5x the 20-day avg
                if (cleanData.length >= 21 && volume > 0) {
                    const vol20dAvg = cleanData.slice(-21, -1).reduce((sum: number, d: any) => sum + (d.volume || 0), 0) / 20;
                    if (vol20dAvg > 0 && volume > vol20dAvg * 1.5) {
                        techScore = Math.min(100, techScore + 10);
                        volumeSurge = true;
                    }
                }

                // Reasons
                const reasons: string[] = [];
                if (discovery) reasons.push(`🔍 ${discovery.signal}`);
                if (trend === 'BULLISH') reasons.push("Strong Technical Uptrend");
                if (techScore > 70) reasons.push("Bullish Momentum (RSI)");
                if (near52wHigh) reasons.push('🏔️ Near 52W High');
                if (outperformingSPY) reasons.push('📈 Outperforming SPY');
                if (volumeSurge) reasons.push('🔥 Volume Surge');
                if (fundScore > 70) reasons.push("Solid Fundamentals");
                if (analystScore > 80) reasons.push(`Analyst Consensus: ${ratingText}`);
                if (epsSurpriseCount >= 2) reasons.push('📊 2x EPS Beat');
                else if (epsSurpriseCount === 1) reasons.push('📊 EPS Beat');
                if (socialScore > 75) reasons.push("High Social Interest");
                if (volumeDiff > 50) reasons.push(`High Volume (+${Math.round(volumeDiff)}%)`);

                // Generate Option Signal
                // Use ATR if available, else 2% proxy
                const atr = latest.atr14 || (latest.close * 0.02);
                const trendLower = trend.toLowerCase() as 'bullish' | 'bearish' | 'neutral';
                const optionSignal = await generateOptionSignal(latest.close, atr, trendLower, rsi, latest.ema50, latest, symbol, undefined, undefined, undefined, false, allTimeframes);


                // Add option reason if high confidence
                if (optionSignal.type !== 'WAIT') {
                    reasons.push(`🎯 Option Setup: ${optionSignal.type} @ $${optionSignal.strike}`);
                }

                return {
                    symbol,
                    name: (quote?.price as any)?.longName || (quote?.price as any)?.shortName || (quote as any)?.displayName || symbol,
                    price: finalPrice,
                    score: Math.round(finalScore),
                    technicalScore: Math.round(techScore),
                    fundamentalScore: Math.round(fundScore),
                    analystScore: Math.round(analystScore),
                    sentimentScore: Math.round(socialScore),
                    metrics: {
                        // Audit fix #8: expose the raw (possibly null) value rather than
                        // the zero-filled one, so "no data" isn't shown as "reported 0".
                        pe: peRaw ?? undefined,
                        marketCap: (quote?.price as any)?.marketCap || 0,
                        revenueGrowth: revGrowthRaw ?? undefined,
                        missingFundamentals: missingFundamentals.length > 0 ? missingFundamentals : undefined,
                        rsi: Math.round(rsi),
                        trend,
                        analystRating: ratingText,
                        analystTarget: targetPrice,
                        socialSentiment: socialLabel,
                        atr14: atr,
                        ema50: latest.ema50
                    },
                    _priceVerified: priceVerified,
                    priceDisagreementPct,
                    reasons,
                    discoverySource,
                    change24h,
                    volume,
                    volumeAvg1y,
                    volumeDiff,
                    sector: currentSectorMap[symbol] || quote?.assetProfile?.sector || 'Other',

                    suggestedOption: optionSignal
                } as ConvictionStock;

            } catch (e) {
                console.error(`❌ Global Alpha Hunter Error for ${symbol}:`, e);
                return null;
            }
        });

        return Promise.all(promises);
    }

    // Process in chunks of 5
    const CHUNK_SIZE = 20;
    for (let i = 0; i < symbolsToScan.length; i += CHUNK_SIZE) {
        const batch = symbolsToScan.slice(i, i + CHUNK_SIZE);
        console.log(`📦 Processing batch ${i / CHUNK_SIZE + 1}/${Math.ceil(symbolsToScan.length / CHUNK_SIZE)}: ${batch.join(', ')}`);

        const batchResults = await processBatch(batch);

        // Filter out nulls and add to results
        batchResults.forEach(r => {
            if (r) results.push(r);
        });

        // Small delay between batches to be nice to APIs
        if (i + CHUNK_SIZE < symbolsToScan.length) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    // Sort by score desc
    const sortedRaw = results.sort((a, b) => b.score - a.score);
    // Filter >= 75
    const sortedFiltered = sortedRaw.filter(r => r.score >= CONVICTION_SCORE_THRESHOLD);

    // Update Cache
    global._alphaHunterCacheV8 = {
        data: sortedFiltered,
        rawData: sortedRaw,
        timestamp: Date.now()
    };
    await saveToBlob(RELATIVE_ALPHA_CACHE_PATH, global._alphaHunterCacheV8);
    isScanning = false;

    const finalReturn = returnAll ? sortedRaw : sortedFiltered;
    if (finalReturn.length === 0) {
        return [];
    }

    return finalReturn;
}
