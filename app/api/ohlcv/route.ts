import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { fetchAlpacaBars } from '@/lib/alpaca';
import { calculateIndicators } from '@/lib/indicators';
import { fetchLivePrice } from '@/lib/market-data';

const yahooFinance = new YahooFinance();

// ── Per-symbol OHLCV cache (15 min) ───────────────────────────────────────
// Prevents re-fetching the same chart data on every page navigation.
// Key: `${symbol}:${interval}`
// NOTE: this caches the RAW bars (pre-indicator), not the computed indicator
// payload. The live price is merged into the last bar and indicators are
// recalculated on every request (cheap), so the header/chart technicals stay
// in sync with the live-merged data used by /api/conviction's confluence
// matrix instead of silently lagging behind it for up to 15 minutes.
const OHLCV_CACHE_TTL = 15 * 60 * 1000;
const ohlcvCache = new Map<string, { bars: any[]; companyName: string; timestamp: number }>();

// Merge the latest live/extended-hours quote into the last bar of a daily
// series before indicators are calculated, mirroring the hybrid-merge logic
// in lib/market-data.ts's _fetchMtaUncached. Without this, RSI/EMA/MACD
// shown in the header (sourced from this route) can disagree with the
// Technical Confluence Matrix (sourced from /api/conviction), which already
// does this merge.
async function mergeLivePrice(ticker: string, bars: any[]): Promise<any[]> {
    if (!bars || bars.length === 0) return bars;
    try {
        const live = await fetchLivePrice(ticker);
        if (!live || !live.price || live.price <= 0) return bars;

        const merged = [...bars];
        const lastBar = merged[merged.length - 1];
        const now = Date.now();
        const isSameDay = new Date(lastBar.time).toDateString() === new Date(now).toDateString();

        if (isSameDay) {
            merged[merged.length - 1] = {
                ...lastBar,
                close: live.price,
                high: Math.max(lastBar.high, live.price),
                low: Math.min(lastBar.low, live.price),
                volume: Math.max(lastBar.volume, live.volume || 0)
            };
        } else {
            merged.push({
                time: now,
                open: lastBar.close,
                high: Math.max(lastBar.close, live.price),
                low: Math.min(lastBar.close, live.price),
                close: live.price,
                volume: live.volume || 0
            });
        }
        return merged;
    } catch {
        // If the live-price waterfall fails, fall back to the unmerged bars
        // rather than failing the whole chart request.
        return bars;
    }
}

// Check if ticker is a US stock (eligible for Alpaca)
function isUSStock(ticker: string): boolean {
    if (ticker.startsWith('^')) return false; // Indices (^VIX, ^GSPC)
    if (ticker.includes('=')) return false;   // Forex (EURUSD=X)
    if (ticker.endsWith('=F')) return false;  // Futures (GC=F)
    return true;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const interval = searchParams.get('interval') || '1d';

    if (!symbol) {
        return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    const ticker = symbol.toUpperCase();
    const cacheKey = `${ticker}:${interval}`;

    // Serve from cache if fresh (bars only — live price is re-merged below on every request)
    const cached = ohlcvCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < OHLCV_CACHE_TTL) {
        console.log(`[OHLCV] ⚡ Cache hit for ${ticker} ${interval}`);
        if (interval === '4h') {
            return NextResponse.json({ data: cached.bars, companyName: cached.companyName }, {
                headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=60' }
            });
        }
        const liveBars = await mergeLivePrice(ticker, cached.bars);
        const indicators = calculateIndicators(liveBars);
        return NextResponse.json({ data: indicators, companyName: cached.companyName }, {
            headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=60' }
        });
    }

    try {

        // Determine timeframe for Alpaca
        let alpacaTimeframe: '1Day' | '1Hour' | '15Min' = '1Day';
        let alpacaLimit = 253; // ~1 year of trading days

        switch (interval) {
            case '1m':
            case '5m':
            case '15m':
                alpacaTimeframe = '15Min';
                alpacaLimit = 500;
                break;
            case '30m':
            case '1h':
            case '60m':
            case '4h':
                alpacaTimeframe = '1Hour';
                alpacaLimit = 500;
                break;
            case '1d':
            case '1wk':
            case '1mo':
            default:
                alpacaTimeframe = '1Day';
                alpacaLimit = 1000; // ~4 years
                break;
        }

        // ===== TRY ALPACA FIRST (for US Stocks only) =====
        if (isUSStock(ticker)) {
            try {
                console.log(`[OHLCV] Trying Alpaca for ${ticker} (${alpacaTimeframe})`);
                const alpacaBars = await fetchAlpacaBars(ticker, alpacaTimeframe, alpacaLimit);

                if (alpacaBars && alpacaBars.length > 0) {
                    console.log(`[OHLCV] Alpaca returned ${alpacaBars.length} bars for ${ticker}`);

                    const data = alpacaBars.map((bar) => ({
                        time: new Date(bar.t).getTime(),
                        open: bar.o,
                        high: bar.h,
                        low: bar.l,
                        close: bar.c,
                        volume: bar.v
                    }));

                    // Alpaca doesn't provide company names, so we'll fetch it from Yahoo
                    let companyName = ticker;
                    try {
                        const quoteSummary: any = await yahooFinance.quoteSummary(ticker, { modules: ['price'] });
                        companyName = quoteSummary?.price?.longName || quoteSummary?.price?.shortName || ticker;
                    } catch (e) {
                        // Fallback to ticker if Yahoo fails
                    }

                    // 4H aggregation if needed
                    if (interval === '4h' && data.length > 0) {
                        const bars4h = aggregate4H(data);
                        ohlcvCache.set(cacheKey, { bars: bars4h, companyName, timestamp: Date.now() });
                        return NextResponse.json({ data: bars4h, companyName }, {
                            headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=60' }
                        });
                    }

                    ohlcvCache.set(cacheKey, { bars: data, companyName, timestamp: Date.now() });
                    const liveBars = await mergeLivePrice(ticker, data);
                    const indicators = calculateIndicators(liveBars);
                    return NextResponse.json({ data: indicators, companyName }, {
                        headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=60' }
                    });
                }
                console.log(`[OHLCV] Alpaca returned no data for ${ticker}, falling back to Yahoo`);
            } catch (alpacaError: any) {
                console.warn(`[OHLCV] Alpaca error for ${ticker}:`, alpacaError.message);
            }
        }

        // ===== FALLBACK TO YAHOO FINANCE =====
        console.log(`[OHLCV] Using Yahoo for ${ticker}`);

        const is4Hour = interval === '4h';
        const yahooInterval: any = is4Hour ? '1h' : interval;

        let range: any = '3mo';
        switch (yahooInterval) {
            case '1m': range = '5d'; break;
            case '5m':
            case '15m':
            case '30m': range = '1mo'; break;
            case '1h':
            case '60m':
            case '90m': range = '2y'; break;
            case '1d':
            case '1wk':
            case '1mo':
            default:
                range = is4Hour ? '2y' : '5y';
                break;
        }

        // Calculate period1
        const now = new Date();
        let period1 = new Date();
        switch (range) {
            case '5d': period1.setDate(now.getDate() - 5); break;
            case '1mo': period1.setMonth(now.getMonth() - 1); break;
            case '3mo': period1.setMonth(now.getMonth() - 3); break;
            case '6mo': period1.setMonth(now.getMonth() - 6); break;
            case '1y': period1.setFullYear(now.getFullYear() - 1); break;
            case '2y': period1.setFullYear(now.getFullYear() - 2); break;
            case '5y': period1.setFullYear(now.getFullYear() - 5); break;
            default: period1.setFullYear(1980); break;
        }

        const queryOptions: any = {
            period1: period1.toISOString().split('T')[0],
            interval: yahooInterval,
        };

        const result: any = await yahooFinance.chart(ticker, queryOptions);

        if (!result || !result.quotes || result.quotes.length === 0) {
            throw new Error('No data returned from Yahoo');
        }

        const data = result.quotes.map((q: any) => ({
            time: new Date(q.date).getTime(),
            open: q.open,
            high: q.high,
            low: q.low,
            close: q.close,
            volume: q.volume
        })).filter((d: any) => d.close !== null && d.open !== null);

        // Extract company name from Yahoo metadata
        const companyName = result.meta?.longName || result.meta?.shortName || ticker;

        // Calculate indicators (live price merged in first — see mergeLivePrice)
        ohlcvCache.set(cacheKey, { bars: data, companyName, timestamp: Date.now() });
        const liveBars = await mergeLivePrice(ticker, data);
        const indicators = calculateIndicators(liveBars);
        return NextResponse.json({ data: indicators, companyName }, {
            headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=60' }
        });

    } catch (error: any) {
        console.error('[OHLCV] Error:', error.message || error);
        return NextResponse.json({ error: 'Failed to fetch data', details: error.message || error.toString() }, { status: 500 });
    }
}

// Helper: Aggregate 1H data into 4H candles
function aggregate4H(data: any[]): any[] {
    const aggregated: any[] = [];
    let currentChunk: any[] = [];

    for (let i = 0; i < data.length; i++) {
        currentChunk.push(data[i]);

        if (currentChunk.length === 4 || i === data.length - 1) {
            const first = currentChunk[0];
            const last = currentChunk[currentChunk.length - 1];
            const high = Math.max(...currentChunk.map(d => d.high));
            const low = Math.min(...currentChunk.map(d => d.low));
            const volume = currentChunk.reduce((acc, d) => acc + d.volume, 0);

            aggregated.push({
                time: first.time,
                open: first.open,
                high,
                low,
                close: last.close,
                volume
            });

            currentChunk = [];
        }
    }
    return aggregated;
}
