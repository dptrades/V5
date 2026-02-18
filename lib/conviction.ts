import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();
import { calculateIndicators, calculateConfluenceScore } from './indicators';
import { calculateSentimentScore } from './news';
import { getNewsData } from './news-service';
import { fetchAlpacaBars } from './alpaca';
import { publicClient } from './public-api';
import { runSmartScan, DiscoveredStock } from './smart-scanner';
import { getSectorMap, SCANNER_WATCHLIST } from './constants';
import { generateOptionSignal } from './options';

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
    var _megaCapCacheV2: { data: ConvictionStock[], timestamp: number } | null;
    var _alphaHunterCacheV2: { data: ConvictionStock[], timestamp: number } | null;
}

// Initialize global cache if not exists (V2 to force refresh with names)
if (!global._megaCapCacheV2) global._megaCapCacheV2 = null;
if (!global._alphaHunterCacheV2) global._alphaHunterCacheV2 = null;

let isScanning = false;

export async function scanConviction(forceRefresh = false): Promise<ConvictionStock[]> {
    const marketSession = publicClient.getMarketSession();

    // Logic: If market is OFF, only scan if cache is empty (one-time baseline fetch).
    // Otherwise, always serve cache during OFF hours to prevent redundant load.
    if (marketSession === 'OFF' && global._megaCapCacheV2 && !forceRefresh) {
        console.log("🌙 Market is CLOSED. Serving preserved Top Picks cache.");
        return global._megaCapCacheV2.data;
    }

    // Return cached data if valid and not force-refresh
    if (!forceRefresh && global._megaCapCacheV2 && (Date.now() - global._megaCapCacheV2.timestamp < CACHE_TTL)) {
        console.log("⚡ Returning cached mega-cap conviction data");
        return global._megaCapCacheV2.data;
    }

    // Clear old cache to force immediate update for user
    if (forceRefresh) global._megaCapCacheV2 = null;

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

    // Build symbol list - strictly use MEGA CAPS
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
                // 1. Fetch Data (Hybrid: Alpaca for Live Price/Chart, Yahoo for Fundamentals)
                console.log(`[Conviction] Fetching data for ${symbol}...`);
                const [quote, yahooChart, alpacaBars, socialNews] = await Promise.all([
                    (yahooFinance.quoteSummary(symbol, { modules: ['financialData', 'defaultKeyStatistics', 'recommendationTrend', 'price', 'assetProfile'] }) as Promise<any>).catch(e => { console.error(`[Yahoo] Quote Error ${symbol}:`, e.message); return null; }),
                    (yahooFinance.chart(symbol, { period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), interval: '1d' }) as Promise<any>).catch(e => { console.error(`[Yahoo] Chart Error ${symbol}:`, e.message); return null; }),
                    (fetchAlpacaBars(symbol, '1Day', 253).then(b => { return b; })),
                    (getNewsData(symbol, 'social') as Promise<any>).catch(e => [])
                ]);

                const publicQuote = publicQuoteMap.get(symbol);

                // DECISION: Use Public.com for live price, Alpaca for Chart, Yahoo as fallback
                let cleanData: any[] = [];
                let currentPrice = publicQuote?.price || 0;
                let usingAlpaca = false;

                if (alpacaBars && alpacaBars.length > 50) {
                    usingAlpaca = true;
                    cleanData = alpacaBars.map((b: any) => ({
                        time: new Date(b.t).getTime(),
                        open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v
                    }));
                    currentPrice = alpacaBars[alpacaBars.length - 1].c;
                } else if (yahooChart && yahooChart.quotes && yahooChart.quotes.length > 50) {
                    cleanData = yahooChart.quotes.map((q: any) => ({
                        time: new Date(q.date).getTime(),
                        open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume
                    }));
                    // currentPrice will be set from quote later, or last close
                    currentPrice = cleanData[cleanData.length - 1].close;
                } else {
                    console.warn(`⚠️ Skipping ${symbol}: Missing Chart Data (Alpaca & Yahoo failed)`);
                    return null;
                }


                const indicators = calculateIndicators(cleanData);
                const latest = indicators[indicators.length - 1];

                // Synchronized Technical Scoring
                const confluence = calculateConfluenceScore(latest);
                const techScore = confluence.strength;
                const trend = confluence.trend;
                const rsi = latest.rsi14 || 50;


                // 3. Process Fundamentals (Graceful Fallback)
                const financialData = quote?.financialData || {};
                const stats = quote?.defaultKeyStatistics || {};
                let fundScore = 50;
                const pe = financialData.trailingPE || stats.forwardPE || 0;
                const revGrowth = financialData.revenueGrowth || 0;

                if (revGrowth > 0.10) fundScore += 15;
                if (pe > 0 && pe < 40) fundScore += 10;
                if (pe > 100) fundScore -= 10;
                const margins = financialData.profitMargins || 0;
                if (margins > 0.20) fundScore += 10;
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

                // Upside potential
                if (targetPrice > finalPrice) {
                    const upside = ((targetPrice - finalPrice) / finalPrice) * 100;
                    if (upside > 10) analystScore += 10;
                }


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

                // Helper to calc avg volume
                const calcVolStats = (data: any[]) => {
                    if (data.length < 10) return { avg: 0, diff: 0 };
                    // Use up to last 252 bars (approx 1 year)
                    const lookback = data.slice(-252);
                    const sum = lookback.reduce((acc, val) => acc + (val.volume || 0), 0);
                    const avg = sum / lookback.length;
                    const lastVol = data[data.length - 1].volume || 0;
                    const diff = avg > 0 ? ((lastVol - avg) / avg) * 100 : 0;
                    return { avg, diff };
                };

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
                if (fundScore > 70) reasons.push("Solid Fundamentals");
                if (analystScore > 80) reasons.push(`Analyst Consensus: ${ratingText}`);
                if (socialScore > 75) reasons.push("High Social Interest");
                if (volumeDiff > 50) reasons.push(`High Volume (+${Math.round(volumeDiff)}%)`);

                // Generate Option Signal
                // Use ATR if available, else 2% proxy
                const atr = latest.atr14 || (latest.close * 0.02);
                const trendLower = trend.toLowerCase() as 'bullish' | 'bearish' | 'neutral';
                const optionSignal = await generateOptionSignal(latest.close, atr, trendLower, rsi, latest.ema50, latest, symbol);


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
                        pe: pe,
                        marketCap: (quote?.price as any)?.marketCap || 0,
                        revenueGrowth: revGrowth,
                        rsi: Math.round(rsi),
                        trend,
                        analystRating: ratingText,
                        analystTarget: targetPrice,
                        socialSentiment: socialLabel
                    },
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
    const sorted = results.sort((a, b) => b.score - a.score);

    // Update Cache
    global._megaCapCacheV2 = {
        data: sorted,
        timestamp: Date.now()
    };
    isScanning = false;
    console.log(`🏁 [Scanner] Scan complete. Found ${results.length} stocks. Returning top ${sorted.slice(0, 50).length}.`);
    return sorted.slice(0, 50);
}

// Alpha Hunter - Broader Market Scan with Smart Discovery
export async function scanAlphaHunter(forceRefresh = false): Promise<ConvictionStock[]> {
    const marketSession = publicClient.getMarketSession();

    // Logic: If market is OFF, only scan if cache is empty.
    if (marketSession === 'OFF' && global._alphaHunterCacheV2 && !forceRefresh) {
        console.log("🌙 Market is CLOSED. Serving preserved Alpha Hunter cache.");
        return global._alphaHunterCacheV2.data;
    }

    // Return cached data if valid
    if (!forceRefresh && global._alphaHunterCacheV2 && (Date.now() - global._alphaHunterCacheV2.timestamp < CACHE_TTL)) {
        console.log("⚡ Returning cached Alpha Hunter data");
        return global._alphaHunterCacheV2.data;
    }

    // Clear old cache to force immediate update for user
    if (forceRefresh) global._alphaHunterCacheV2 = null;

    isScanning = true;
    const results: ConvictionStock[] = [];

    // Updated score weightings (now includes discovery bonus)
    const W_TECH = 0.25;
    const W_FUND = 0.20;
    const W_ANALYST = 0.15;
    const W_SOCIAL = 0.15;
    const W_DISCOVERY = 0.25; // Bonus for smart discovery signals

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

    // Limit total symbols to prevent timeout
    symbolsToScan = symbolsToScan.slice(0, 150);
    console.log(`📊 Total symbols to scan: ${symbolsToScan.length}`);

    // 4. Batch Processing Helper
    const processBatch = async (batch: string[]) => {
        // Fetch ALL Public.com quotes for this batch at once
        const publicQuotes = await publicClient.getQuotes(batch, forceRefresh);
        const publicQuoteMap = new Map(publicQuotes.map(q => [q.symbol, q]));

        const promises = batch.map(async (symbol) => {
            try {
                // 1. Fetch Data (Hybrid: Alpaca for Live Price/Chart, Yahoo for Fundamentals)
                console.log(`[Alpha Hunter] Fetching data for ${symbol}...`);
                const [quote, yahooChart, alpacaBars, socialNews] = await Promise.all([
                    (yahooFinance.quoteSummary(symbol, { modules: ['financialData', 'defaultKeyStatistics', 'recommendationTrend', 'price', 'assetProfile'] }) as Promise<any>).catch(e => { console.error(`[Yahoo] Quote Error ${symbol}:`, e.message); return null; }),
                    (yahooFinance.chart(symbol, { period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), interval: '1d' }) as Promise<any>).catch(e => { console.error(`[Yahoo] Chart Error ${symbol}:`, e.message); return null; }),
                    (fetchAlpacaBars(symbol, '1Day', 253).then(b => { return b; })),
                    (getNewsData(symbol, 'social') as Promise<any>).catch(e => [])
                ]);

                const publicQuote = publicQuoteMap.get(symbol);

                // DECISION: Use Public.com for live price, Alpaca for Chart, Yahoo as fallback
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
                }
                else if (yahooChart && yahooChart.quotes && yahooChart.quotes.length > 50) {
                    cleanData = yahooChart.quotes.map((q: any) => ({
                        time: new Date(q.date).getTime(),
                        open: q.open, high: q.high, low: q.low, close: q.close, volume: q.volume
                    }));
                    // currentPrice will be set from quote later, or last close
                    currentPrice = cleanData[cleanData.length - 1].close;
                } else {
                    console.warn(`⚠️ Skipping ${symbol}: Missing Chart Data (Alpaca & Yahoo failed)`);
                    return null;
                }


                const indicators = calculateIndicators(cleanData);
                const latest = indicators[indicators.length - 1];

                // Synchronized Technical Scoring
                const confluence = calculateConfluenceScore(latest);
                const techScore = confluence.strength;
                const trend = confluence.trend;
                const rsi = latest.rsi14 || 50;


                // 3. Process Fundamentals (Graceful Fallback)
                const financialData = quote?.financialData || {};
                const stats = quote?.defaultKeyStatistics || {};
                let fundScore = 50;
                const pe = financialData.trailingPE || stats.forwardPE || 0;
                const revGrowth = financialData.revenueGrowth || 0;

                if (revGrowth > 0.10) fundScore += 15;
                if (pe > 0 && pe < 40) fundScore += 10;
                if (pe > 100) fundScore -= 10;
                const margins = financialData.profitMargins || 0;
                if (margins > 0.20) fundScore += 10;
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

                // Upside potential
                if (targetPrice > finalPrice) {
                    const upside = ((targetPrice - finalPrice) / finalPrice) * 100;
                    if (upside > 10) analystScore += 10;
                }


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

                // Helper to calc avg volume
                const calcVolStats = (data: any[]) => {
                    if (data.length < 10) return { avg: 0, diff: 0 };
                    // Use up to last 252 bars (approx 1 year)
                    const lookback = data.slice(-252);
                    const sum = lookback.reduce((acc, val) => acc + (val.volume || 0), 0);
                    const avg = sum / lookback.length;
                    const lastVol = data[data.length - 1].volume || 0;
                    const diff = avg > 0 ? ((lastVol - avg) / avg) * 100 : 0;
                    return { avg, diff };
                };

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

                // Reasons
                const reasons: string[] = [];
                if (discovery) reasons.push(`🔍 ${discovery.signal}`);
                if (trend === 'BULLISH') reasons.push("Strong Technical Uptrend");
                if (techScore > 70) reasons.push("Bullish Momentum (RSI)");
                if (fundScore > 70) reasons.push("Solid Fundamentals");
                if (analystScore > 80) reasons.push(`Analyst Consensus: ${ratingText}`);
                if (socialScore > 75) reasons.push("High Social Interest");
                if (volumeDiff > 50) reasons.push(`High Volume (+${Math.round(volumeDiff)}%)`);

                // Generate Option Signal
                // Use ATR if available, else 2% proxy
                const atr = latest.atr14 || (latest.close * 0.02);
                const trendLower = trend.toLowerCase() as 'bullish' | 'bearish' | 'neutral';
                const optionSignal = await generateOptionSignal(latest.close, atr, trendLower, rsi, latest.ema50, latest, symbol);


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
                        pe: pe,
                        marketCap: (quote?.price as any)?.marketCap || 0,
                        revenueGrowth: revGrowth,
                        rsi: Math.round(rsi),
                        trend,
                        analystRating: ratingText,
                        analystTarget: targetPrice,
                        socialSentiment: socialLabel
                    },
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
    const sorted = results.sort((a, b) => b.score - a.score);

    // Update Cache
    global._alphaHunterCacheV2 = {
        data: sorted,
        timestamp: Date.now()
    };
    isScanning = false;

    if (sorted.length === 0) {
        return [];
    }

    return sorted.slice(0, 50);
}
