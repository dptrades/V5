import { env } from './env';

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
    private financialsCache: Map<string, { data: FinnhubBasicFinancials; expiry: number }> = new Map();
    private sentimentCache: Map<string, { data: FinnhubSentiment; expiry: number }> = new Map();
    private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 Hours
    private readonly SENTIMENT_CACHE_TTL = 30 * 60 * 1000; // 30 minutes for sentiment

    // Rate-limit protection: 60 req/min on free tier
    private requestQueue: number[] = [];
    private readonly MAX_REQUESTS_PER_MINUTE = 55; // Leave headroom
    private throttledUntil: number = 0;

    private async rateLimitedFetch(endpoint: string, params: Record<string, string> = {}) {
        if (!API_KEY) {
            console.warn('Finnhub API Key is missing');
            return null;
        }

        // Check hard throttle (429 cooldown)
        if (Date.now() < this.throttledUntil) {
            console.warn(`[Finnhub] Rate limit cool-down active. Skipping ${endpoint}.`);
            return null;
        }

        // Sliding window rate limiter
        const now = Date.now();
        this.requestQueue = this.requestQueue.filter(t => now - t < 60000);
        if (this.requestQueue.length >= this.MAX_REQUESTS_PER_MINUTE) {
            console.warn(`[Finnhub] Approaching rate limit (${this.requestQueue.length} req/min). Skipping ${endpoint}.`);
            return null;
        }
        this.requestQueue.push(now);

        const start = Date.now();
        const url = new URL(`${FINNHUB_BASE_URL}${endpoint}`);
        url.searchParams.append('token', API_KEY);
        Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));

        try {
            const response = await fetch(url.toString());
            if (response.status === 429) {
                this.throttledUntil = Date.now() + (60 * 1000); // 60s cooldown
                console.error(`[Finnhub] 🛑 Rate limit hit (429). Cooldown 60s.`);
                return null;
            }
            if (!response.ok) throw new Error(`Finnhub API error: ${response.statusText}`);
            const data = await response.json();
            console.log(`[Finnhub] ${endpoint} resolved in ${Date.now() - start}ms`);
            return data;
        } catch (error) {
            console.error(`Error fetching from Finnhub: ${endpoint} (${Date.now() - start}ms)`, error);
            return null;
        }
    }

    async getNews(symbol: string): Promise<FinnhubNews[]> {
        const to = new Date().toISOString().split('T')[0];
        const from = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        return await this.rateLimitedFetch('/company-news', { symbol, from, to }) || [];
    }

    async getNewsSentiment(symbol: string): Promise<FinnhubSentiment | null> {
        // Check sentiment cache
        const cached = this.sentimentCache.get(symbol);
        if (cached && Date.now() < cached.expiry) {
            return cached.data;
        }

        const data = await this.rateLimitedFetch('/news-sentiment', { symbol });
        if (data) {
            this.sentimentCache.set(symbol, {
                data,
                expiry: Date.now() + this.SENTIMENT_CACHE_TTL
            });
        }
        return data;
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
        if (data) {
            this.financialsCache.set(symbol, {
                data,
                expiry: Date.now() + this.CACHE_TTL
            });
        }
        return data;
    }
}

export const finnhubClient = new FinnhubClient();
