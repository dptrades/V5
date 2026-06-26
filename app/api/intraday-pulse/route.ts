import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { fetchMultiAlpacaBars } from '@/lib/alpaca';
import { calculateIndicators } from '@/lib/indicators';
import { scanConviction, RELATIVE_CONVICTION_CACHE_PATH, RELATIVE_ALPHA_CACHE_PATH } from '@/lib/conviction';
import { getFromBlob, saveToBlob } from '@/lib/blob-storage';

const yahooFinance = new YahooFinance();

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // 1. Get cached symbols from Top Picks and Alpha Hunter (with Blob storage fallbacks on cold start)
        if (!global._megaCapCacheV9) {
            global._megaCapCacheV9 = await getFromBlob(RELATIVE_CONVICTION_CACHE_PATH, null);
        }
        if (!global._alphaHunterCacheV8) {
            global._alphaHunterCacheV8 = await getFromBlob(RELATIVE_ALPHA_CACHE_PATH, null);
        }

        let megaCapStocks = global._megaCapCacheV9?.data || [];
        let alphaStocks = global._alphaHunterCacheV8?.data || [];

        // If caches are empty (e.g. server restart), trigger scan in background
        if (megaCapStocks.length === 0 && alphaStocks.length === 0) {
            console.log('[Intraday Pulse] Cache is empty, triggering scans in background...');
            scanConviction(false, false).catch(e => console.error('[Intraday Pulse] Background conviction scan failed:', e));
        }

        // Merge and deduplicate tickers
        const allCachedStocks = [...megaCapStocks, ...alphaStocks];
        const stockMap = new Map<string, typeof allCachedStocks[0]>();
        for (const s of allCachedStocks) {
            stockMap.set(s.symbol, s);
        }

        let symbols = Array.from(stockMap.keys());
        if (symbols.length === 0) {
            // Fallback list of mega caps so the service works immediately on startup
            symbols = ['AAPL', 'MSFT', 'AMZN', 'NVDA', 'GOOGL', 'META', 'TSLA', 'AVGO', 'NFLX', 'COST'];
        }

        // Limit symbols to a maximum of 30 to stay safe with rate limits
        symbols = symbols.slice(0, 30);

        console.log(`[Intraday Pulse] Running check on ${symbols.length} symbols...`);

        // Load triggered alerts to prevent duplicates
        const RELATIVE_ALERTS_PATH = 'data/triggered_alerts.json';
        const rawTriggered = await getFromBlob<Record<string, number>>(RELATIVE_ALERTS_PATH, {});
        
        // Expire records older than 24 hours
        const nowMs = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;
        const triggeredAlerts: Record<string, number> = {};
        for (const [key, ts] of Object.entries(rawTriggered)) {
            if (nowMs - ts < oneDayMs) {
                triggeredAlerts[key] = ts;
            }
        }
        let alertsUpdated = false;
        const today = new Date().toISOString().split('T')[0];

        // 2. Fetch live quotes in a single request from Yahoo Finance
        let quotes: any[] = [];
        try {
            const quoteResults = await yahooFinance.quote(symbols);
            quotes = Array.isArray(quoteResults) ? quoteResults : [quoteResults];
        } catch (yahooErr) {
            console.error('[Intraday Pulse] Yahoo quote fetch failed:', yahooErr);
        }

        // 3. Fetch 1H bars for symbols in a single request from Alpaca
        let barsMap: Record<string, any[]> = {};
        try {
            barsMap = await fetchMultiAlpacaBars(symbols, '1Hour', 30);
        } catch (alpacaErr) {
            console.error('[Intraday Pulse] Alpaca multi-bars fetch failed:', alpacaErr);
        }

        const alerts: any[] = [];

        // 4. Process each symbol
        for (const symbol of symbols) {
            const quote = quotes.find(q => q && q.symbol === symbol);
            if (!quote) continue;

            const livePrice = quote.regularMarketPrice || quote.postMarketPrice || 0;
            const liveVolume = quote.regularMarketVolume || 0;

            if (livePrice === 0) continue;

            const cachedStock = stockMap.get(symbol);

            // A. Price Change Since Last Scan (> 1.5% move)
            if (cachedStock && cachedStock.price > 0) {
                const changePct = ((livePrice - cachedStock.price) / cachedStock.price) * 100;
                if (Math.abs(changePct) >= 1.5) {
                    const severity = Math.abs(changePct) >= 3.0 ? 'HIGH' : 'NORMAL';
                    const direction = changePct > 0 ? 'UP' : 'DOWN';
                    const alertKey = `${symbol}_PRICE_MOVE_${direction}_${severity}_${today}`;
                    const highAlertKey = `${symbol}_PRICE_MOVE_${direction}_HIGH_${today}`;
                    
                    if (!triggeredAlerts[alertKey] && !(severity === 'NORMAL' && triggeredAlerts[highAlertKey])) {
                        alerts.push({
                            type: 'PRICE_MOVE',
                            symbol,
                            message: `${symbol} moved ${changePct > 0 ? '+' : ''}${changePct.toFixed(2)}% since last scan (Live: $${livePrice.toFixed(2)}, Cached: $${cachedStock.price.toFixed(2)})`,
                            severity
                        });
                        triggeredAlerts[alertKey] = nowMs;
                        alertsUpdated = true;
                    }
                }
            }

            // B. Volume Surge Detection (> 3x 1y average volume)
            const avgVolume = cachedStock?.volumeAvg1y || (quote.averageDailyVolume10Day || 5000000);
            if (avgVolume > 0 && liveVolume > 3 * avgVolume) {
                const alertKey = `${symbol}_VOLUME_SURGE_${today}`;
                if (!triggeredAlerts[alertKey]) {
                    alerts.push({
                        type: 'VOLUME_SURGE',
                        symbol,
                        message: `${symbol} Volume Surge: ${(liveVolume / 1_000_000).toFixed(1)}M vs 1y Avg ${(avgVolume / 1_000_000).toFixed(1)}M (3.0x+)`,
                        severity: 'HIGH'
                    });
                    triggeredAlerts[alertKey] = nowMs;
                    alertsUpdated = true;
                }
            }

            // C. 1H Timeframe indicators (RSI & EMA crossover)
            const alpacaBars = barsMap[symbol];
            if (alpacaBars && alpacaBars.length >= 2) {
                const h1Data = alpacaBars.map((b: any) => ({
                    time: new Date(b.t).getTime(),
                    open: b.o,
                    high: b.h,
                    low: b.l,
                    close: b.c,
                    volume: b.v
                }));

                // Append the latest live price to simulate the current uncompleted bar
                const lastBar = h1Data[h1Data.length - 1];
                
                // If the last bar is older than 1 hour, push a new bar. Otherwise update the last one.
                const oneHourMs = 60 * 60 * 1000;
                if (nowMs - lastBar.time > oneHourMs) {
                    const nowHourStart = new Date(nowMs);
                    nowHourStart.setMinutes(0, 0, 0);
                    const barTime = nowHourStart.getTime();

                    h1Data.push({
                        time: barTime,
                        open: livePrice,
                        high: livePrice,
                        low: livePrice,
                        close: livePrice,
                        volume: 0
                    });
                } else {
                    lastBar.close = livePrice;
                    if (livePrice > lastBar.high) lastBar.high = livePrice;
                    if (livePrice < lastBar.low) lastBar.low = livePrice;
                }

                const h1Inds = calculateIndicators(h1Data);
                if (h1Inds.length >= 2) {
                    const prev = h1Inds[h1Inds.length - 2];
                    const curr = h1Inds[h1Inds.length - 1];

                    // C1. RSI Extreme (< 30 or > 70)
                    if (curr.rsi14 !== undefined) {
                        if (curr.rsi14 > 70) {
                            const alertKey = `${symbol}_RSI_EXTREME_OVERBOUGHT_${curr.time}`;
                            if (!triggeredAlerts[alertKey]) {
                                alerts.push({
                                    type: 'RSI_EXTREME',
                                    symbol,
                                    message: `${symbol} 1H RSI Overbought at ${curr.rsi14.toFixed(1)}`,
                                    severity: curr.rsi14 > 75 ? 'HIGH' : 'NORMAL'
                                });
                                triggeredAlerts[alertKey] = nowMs;
                                alertsUpdated = true;
                            }
                        } else if (curr.rsi14 < 30) {
                            const alertKey = `${symbol}_RSI_EXTREME_OVERSOLD_${curr.time}`;
                            if (!triggeredAlerts[alertKey]) {
                                alerts.push({
                                    type: 'RSI_EXTREME',
                                    symbol,
                                    message: `${symbol} 1H RSI Oversold at ${curr.rsi14.toFixed(1)}`,
                                    severity: curr.rsi14 < 25 ? 'HIGH' : 'NORMAL'
                                });
                                triggeredAlerts[alertKey] = nowMs;
                                alertsUpdated = true;
                            }
                        }
                    }

                    // C2. EMA Crossover (9/21 cross)
                    if (prev.ema9 && prev.ema21 && curr.ema9 && curr.ema21) {
                        const prevDiff = prev.ema9 - prev.ema21;
                        const currDiff = curr.ema9 - curr.ema21;

                        if (prevDiff * currDiff < 0) {
                            const direction = currDiff > 0 ? 'above' : 'below';
                            const alertKey = `${symbol}_EMA_CROSS_${direction}_${curr.time}`;
                            if (!triggeredAlerts[alertKey]) {
                                alerts.push({
                                    type: 'EMA_CROSS',
                                    symbol,
                                    message: `${symbol} 1H EMA9 crossed ${direction} EMA21 (Price: $${livePrice.toFixed(2)})`,
                                    severity: 'HIGH'
                                });
                                triggeredAlerts[alertKey] = nowMs;
                                alertsUpdated = true;
                            }
                        }
                    }
                }
            }
        }

        // Save updated alerts cache back to Blob
        if (alertsUpdated || Object.keys(rawTriggered).length !== Object.keys(triggeredAlerts).length) {
            await saveToBlob(RELATIVE_ALERTS_PATH, triggeredAlerts);
        }

        return NextResponse.json({
            success: true,
            marketSession: quoteSession(),
            alerts,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('[Intraday Pulse API] Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Internal server error'
        }, { status: 500 });
    }
}

function quoteSession(): string {
    const now = new Date();
    const estTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const hours = estTime.getHours();
    const minutes = estTime.getMinutes();
    const timeVal = hours + minutes / 60;
    const day = estTime.getDay();

    if (day === 0 || day === 6) return 'OFF';
    if (timeVal >= 9.5 && timeVal < 16) return 'REG';
    if (timeVal >= 4 && timeVal < 9.5) return 'PRE';
    if (timeVal >= 16 && timeVal < 20) return 'POST';
    return 'OFF';
}
