import { env } from './env';
import { localDateString, localDateStringOffset } from './localdate';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
const API_KEY = env.FINNHUB_API_KEY;

export interface FinnhubNews {
    category: string;
    datetime: number;
    headline: string;
    id: number;
    image: string;
    related: string;
    source: string;
    summary: string;
    url: string;
}

export interface FinnhubSentiment {
    buzz: {
        articlesInLastWeek: number;
        buzz: number;
        weeklyAverage: number;
    };
    companyNewsScore: number;
    sectorAverageBuzz: number;
    sectorAverageNewsScore: number;
    sentiment: {
        bearishPercent: number;
        bullishPercent: number;
    };
    symbol: string;
}

export interface FinnhubSocialSentiment {
    reddit: Array<{ atTime: string; mention: number; positiveMention: number; negativeMention: number; score: number }>;
    twitter: Array<{ atTime: string; mention: number; positiveMention: number; negativeMention: number; score: number }>;
    symbol: string;
}

export interface FinnhubBasicFinancials {
    metric: {
        '10DayAverageTradingVolume': number;
        '52WeekHigh': number;
        '52WeekLow': number;
        '52WeekLowDate': string;
        '52WeekPriceReturnDaily': number;
        beta: number;
        marketCapitalization: number;
        roeTTM: number;
        epsGrowthTTMYoy: number;
        pegTTM?: number;
        pegRatio?: number;
        'totalDebt/totalEquityTTM'?: number;
        'totalDebt/totalEquityQuarterly'?: number;
        'totalDebt/totalEquityAnnual'?: number;
        debtToEquity?: number;
        freeCashFlowTTM?: number;
        freeCashFlowAnnual?: number;
        pfcfShareTTM?: number;
        enterpriseValue?: number;
        'currentEv/freeCashFlowTTM'?: number;
        peTTM?: number;
    };
    series: {
        annual: any;
        quarterly: any;
    };
    symbol: string;
}

class FinnhubClient {
    private financialsCache: Map<string, { data: FinnhubBasicFinancials | null; expiry: number }> = new Map();
    private sentimentCache: Map<string, { data: FinnhubSentiment | null; expiry: number }> = new Map();
    private readonly CACHE_TTL = 24 * 60 * 60 * 1000;           // 24 hours for fundamentals
    private readonly SENTIMENT_CACHE_TTL = 30 * 60 * 1000;      // 30 min for sentiment

    // ── Token-bucket queue: max 55 req/min = 1 every 1.09s ──────────────────
    // Instead of dropping calls when busy, we stagger them.
    private lastCallAt: number = 0;
    private readonly MIN_INTERVAL_MS = 1100; // 1.1s between calls (~54/min, safe under 60)
    private queuePromise: Promise<void> = Promise.resolve();

    private enqueue<T>(fn: () => Promise<T>): Promise<T> {
        // Chain onto the queue so concurrent callers are serialized
        const next = this.queuePromise.then(async () => {
            const now = Date.now();
            const wait = this.lastCallAt + this.MIN_INTERVAL_MS - now;
            if (wait > 0) await new Promise(r => setTimeout(r, wait));
            this.lastCallAt = Date.now();
            return fn();
        });
        // Update the shared queue tail (suppress unhandled rejection on tail)
        this.queuePromise = next.then(() => { }, () => { });
        return next;
    }

    private async rateLimitedFetch(endpoint: string, params: Record<string, string> = {}) {
        if (!API_KEY) {
            console.warn('[Finnhub] API Key is missing');
            return null;
        }

        return this.enqueue(async () => {
            const start = Date.now();
            const url = new URL(`${FINNHUB_BASE_URL}${endpoint}`);
            url.searchParams.append('token', API_KEY);
            Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));

            try {
                const response = await fetch(url.toString());
                if (response.status === 429) {
                    // On 429 pause the queue for 60s
                    this.lastCallAt = Date.now() + 60_000;
                    console.error('[Finnhub] 🛑 Rate limit hit (429). Pausing queue 60s.');
                    return null;
                }
                if (response.status === 403) {
                    // On 403 just return null, API Key lacks permissions for this endpoint.
                    // DO NOT pause the queue, otherwise basic metrics get blocked for 60s
                    console.error(`[Finnhub] 🛑 Forbidden (403) on ${endpoint}. API Key lacks permissions.`);
                    return null;
                }
                if (!response.ok) throw new Error(`Finnhub API error: ${response.statusText}`);
                const data = await response.json();
                console.log(`[Finnhub] ${endpoint} resolved in ${Date.now() - start}ms`);
                return data;
            } catch (error) {
                console.error(`[Finnhub] Error fetching ${endpoint} (${Date.now() - start}ms)`, error);
                return null;
            }
        });
    }


    async getNews(symbol: string): Promise<FinnhubNews[]> {
        const to = localDateString();
        const from = localDateStringOffset(3);
        return await this.rateLimitedFetch('/company-news', { symbol, from, to }) || [];
    }

    async getNewsSentiment(symbol: string): Promise<FinnhubSentiment | null> {
        // Feature disabled: Requires Premium API Key.
        // It triggers a 403 error which wastes 1.1s in the API rate limiter
        return null;
    }

    async getSocialSentiment(symbol: string): Promise<FinnhubSocialSentiment | null> {
        return await this.rateLimitedFetch('/stock/social-sentiment', { symbol });
    }

    async getBasicFinancials(symbol: string): Promise<FinnhubBasicFinancials | null> {
        // Check cache first
        const cached = this.financialsCache.get(symbol);
        if (cached && Date.now() < cached.expiry) {
            return cached.data;
        }

        const data = await this.rateLimitedFetch('/stock/metric', { symbol, metric: 'all' });
        this.financialsCache.set(symbol, {
            data,
            expiry: Date.now() + this.CACHE_TTL
        });
        return data;
    }

    async getQuote(symbol: string): Promise<{ c: number; d: number; dp: number } | null> {
        return await this.rateLimitedFetch('/quote', { symbol });
    }

    async getEconomicCalendar(from: string, to: string): Promise<any[]> {
        const data = await this.rateLimitedFetch('/calendar/economic', { from, to });
        return data?.economicCalendar || [];
    }

    /**
     * Get historical candles (OHLCV) for a symbol.
     * Valid resolutions: 1, 5, 15, 30, 60 (1 hour), D, W, M
     */
    async getCandles(symbol: string, resolution: '1' | '5' | '15' | '30' | '60' | 'D' | 'W' | 'M', from: number, to: number): Promise<any> {
        return await this.rateLimitedFetch('/stock/candle', {
            symbol,
            resolution,
            from: from.toString(),
            to: to.toString()
        });
    }
}

export const finnhubClient = new FinnhubClient();
