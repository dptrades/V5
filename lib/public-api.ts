import axios from 'axios';
import { env } from './env';
import { getMarketSession } from './refresh-utils';

const BASE_URL = 'https://api.public.com';

// Types for Public.com API responses
export interface PublicQuote {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    timestamp: number;
    session?: 'PRE' | 'REG' | 'POST' | 'OFF';
}

export interface PublicOptionChain {
    symbol: string;
    expirations: string[];
    strikes: number[];
    options: {
        [expiration: string]: {
            [strike: number]: {
                call: PublicOptionData | null;
                put: PublicOptionData | null;
            }
        }
    };
}

export interface PublicOptionData {
    symbol: string;
    strike: number;
    expiration: string;
    type: 'CALL' | 'PUT';
    bid: number;
    ask: number;
    last: number;
    volume: number;
    openInterest: number;
    greeks?: {
        delta: number;
        gamma: number;
        theta: number;
        vega: number;
        rho: number;
        impliedVolatility: number;
    };
}

export class PublicClient {
    private apiKey: string;
    private apiSecret: string;
    private token: string | null = null;
    private tokenExpiry: number = 0;
    private accountId: string | null = null;
    public lastError: string | null = null;
    private throttledUntil: number = 0;
    private quoteCache: Map<string, { data: PublicQuote; expiry: number }> = new Map();
    private chainCache: Map<string, { data: PublicOptionChain; expiry: number }> = new Map();
    private CACHE_TTL = 60 * 1000; // 60 seconds cache for quotes (matches 1-min polling interval)
    private CHAIN_TTL = 5 * 60 * 1000; // 5 minutes cache for option chains (increased for reliability)

    constructor() {
        this.apiKey = env.PUBLIC_API_KEY || '';
        this.apiSecret = env.PUBLIC_API_SECRET || '';
        if (!this.isConfigured() && typeof window === 'undefined') {
            console.log("⚠️ Public.com API Key missing. Live options data will be unavailable. Refresh to retry.");
        }
    }

    isConfigured(): boolean {
        return !!this.apiSecret;
    }

    private async getAuthToken(): Promise<string> {
        if (this.token && Date.now() < this.tokenExpiry) {
            return this.token;
        }

        if (!this.apiSecret) {
            return '';
        }

        try {
            console.log(`[PublicAPI] Requesting auth token...`);
            const response = await axios.post(`${BASE_URL}/userapiauthservice/personal/access-tokens`, {
                secret: this.apiSecret,
                validityInMinutes: 60
            });

            if (response.data && response.data.accessToken) {
                console.log(`[PublicAPI] Auth token obtained successfully. Expiry: ${new Date(Date.now() + (55 * 60 * 1000)).toLocaleTimeString()}`);
                this.token = response.data.accessToken;
                this.tokenExpiry = Date.now() + (55 * 60 * 1000);
                this.lastError = null;
                return this.token!;
            } else {
                this.lastError = response.data?.message || 'Invalid response';
                console.error(`[PublicAPI] Auth token missing in response:`, JSON.stringify(response.data));
            }
        } catch (error: any) {
            this.lastError = error.response?.data?.message || error.message;
            console.error(`[PublicAPI] Auth error:`, error.response?.status, JSON.stringify(error.response?.data) || error.message);
        }
        return '';
    }

    private async getAccountId(): Promise<string> {
        if (this.accountId) return this.accountId;

        const token = await this.getAuthToken();
        if (!token) return '';

        try {
            console.log(`[PublicAPI] Fetching account info...`);
            const response = await axios.get(`${BASE_URL}/userapigateway/trading/account`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Origin': 'https://public.com',
                    'Referer': 'https://public.com/'
                }
            });

            if (response.data && response.data.accounts && response.data.accounts.length > 0) {
                // Use the first brokerage account found
                const account = response.data.accounts.find((a: any) => a.accountType === 'BROKERAGE') || response.data.accounts[0];
                this.accountId = account.accountId;
                console.log(`[PublicAPI] Account ID obtained: ${this.accountId}`);
                return this.accountId!;
            } else {
                console.error(`[PublicAPI] No accounts found in response:`, response.data);
            }
        } catch (error: any) {
            console.error(`[PublicAPI] Account fetch error:`, error.response?.status, error.response?.data || error.message);
        }
        return '';
    }

    private async request(endpoint: string, method: 'GET' | 'POST' = 'GET', data?: any, params?: any) {
        if (!this.isConfigured()) return null;

        // Check for 429 cooldown
        if (Date.now() < this.throttledUntil) {
            console.warn(`[PublicAPI] Rate limit cool-down active. Skipping request to ${endpoint}.`);
            this.lastError = "429: Too many requests (Cool-down active)";
            return null;
        }

        const token = await this.getAuthToken();
        if (!token) return null;

        const accountId = await this.getAccountId();
        if (!accountId) return null;

        const isOptionDetails = endpoint.includes('options') || endpoint.includes('greeks');
        const baseUrlPath = isOptionDetails ? '/userapigateway/option-details' : '/userapigateway/marketdata';

        const fullEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const finalPath = `${baseUrlPath}/${accountId}${fullEndpoint}`;

        try {
            const config: any = {
                method,
                url: `${BASE_URL}${finalPath}`,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Origin': 'https://public.com',
                    'Referer': 'https://public.com/',
                    'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"macOS"',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-site'
                },
                data
            };

            if (params) {
                const queryParts: string[] = [];
                for (const key in params) {
                    const value = params[key];
                    if (Array.isArray(value)) {
                        queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value.join(','))}`);
                    } else {
                        queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
                    }
                }
                if (queryParts.length > 0) {
                    config.url += `?${queryParts.join('&')}`;
                }
            }

            console.log(`[PublicAPI] Request: ${method} ${config.url}`);
            const response = await axios(config);
            this.lastError = null; // Clear error on success
            return response.data;
        } catch (error: any) {
            const status = error.response?.status;
            const message = error.response?.data?.message || error.message;

            if (status === 429 || status === 403) {
                console.error(`[PublicAPI] 🛑 Rate Limit Hit (${status}). Activating cool-down for 30 seconds.`);
                this.throttledUntil = Date.now() + (30 * 1000);
            }

            this.lastError = status ? `${status}: ${message}` : message;
            console.error(`[PublicAPI] Request error for ${finalPath}:`, status, JSON.stringify(error.response?.data) || error.message);
            return null;
        }
    }

    /**
     * Get real-time stock quote
     */
    async getQuote(symbol: string, force: boolean = false): Promise<PublicQuote | null> {
        // Check cache first
        const cached = this.quoteCache.get(symbol);
        if (!force && cached && Date.now() < cached.expiry) {
            return cached.data;
        }

        if (!this.isConfigured()) {
            return {
                symbol,
                price: 150.00 + (Math.random() * 5),
                change: 1.25,
                changePercent: 0.85,
                volume: 1200000,
                timestamp: Date.now()
            };
        }

        const results = await this.getQuotes([symbol]);
        return results[0] || null;
    }

    /**
     * Get real-time quotes for multiple symbols in a single batch
     */
    async getQuotes(symbols: string[], force: boolean = false): Promise<PublicQuote[]> {
        if (symbols.length === 0) return [];

        // Identify which symbols need refreshing
        const now = Date.now();
        const results: PublicQuote[] = [];
        const toFetch: string[] = [];

        symbols.forEach(s => {
            const cached = this.quoteCache.get(s);
            if (!force && cached && now < cached.expiry) {
                results.push(cached.data);
            } else {
                toFetch.push(s);
            }
        });

        if (toFetch.length === 0) return results;

        if (!this.isConfigured()) {
            return [...results, ...toFetch.map(s => ({
                symbol: s,
                price: 150.00 + (Math.random() * 5),
                change: 1.25,
                changePercent: 0.85,
                volume: 1200000,
                timestamp: now
            }))];
        }

        try {
            console.log(`[PublicAPI] Batch fetching ${toFetch.length} quotes...`);
            const data = await this.request(`/quotes`, 'POST', {
                instruments: toFetch.map(s => ({ symbol: s, type: 'EQUITY' }))
            });

            if (data && data.quotes && Array.isArray(data.quotes)) {
                data.quotes.forEach((q: any) => {
                    if (!q.instrument) return;
                    const signum = q.instrument.symbol;
                    const quote: PublicQuote = {
                        symbol: signum,
                        price: parseFloat(q.last || '0'),
                        change: parseFloat(q.netChange || '0'),
                        changePercent: parseFloat(q.percentChange || '0'),
                        volume: parseInt(q.volume || '0'),
                        timestamp: q.lastTimestamp ? new Date(q.lastTimestamp).getTime() : now,
                        session: this.getMarketSession()
                    };

                    // Update cache
                    this.quoteCache.set(signum, { data: quote, expiry: now + this.CACHE_TTL });
                    results.push(quote);
                });
            }
        } catch (e) {
            console.error('[PublicAPI] getQuotes batch error:', e);
        }

        return results;
    }

    /**
     * Helper to determine market session based on current time (EST) and holidays
     */
    public getMarketSession(): 'PRE' | 'REG' | 'POST' | 'OFF' {
        return getMarketSession();
    }

    /**
     * Helper to get option expirations
     */
    async getOptionExpirations(symbol: string): Promise<string[]> {
        if (!this.isConfigured()) return [];
        try {
            const data = await this.request(`/option-expirations`, 'POST', {
                instrument: { symbol, type: 'EQUITY' }
            });
            return data?.expirations || [];
        } catch (e) {
            return [];
        }
    }

    /**
     * Get option chain for a symbol
     */
    async getOptionChain(symbol: string, targetExpiration?: string): Promise<PublicOptionChain | null> {
        if (!this.isConfigured()) return null;

        // Check Cache
        const cached = this.chainCache.get(symbol);
        if (cached && Date.now() < cached.expiry) {
            // Only return cache if it contains the target expiration data we need
            if (!targetExpiration || (cached.data.options && cached.data.options[targetExpiration])) {
                return cached.data;
            }
        }

        try {
            // 1. Get expirations first
            const expirations = await this.getOptionExpirations(symbol);
            if (!expirations || expirations.length === 0) throw new Error("No expirations found");

            const chain: PublicOptionChain = {
                symbol,
                expirations,
                strikes: [],
                options: {}
            };

            const strikesSet = new Set<number>();

            // 2. Decide which expirations to fetch
            let targetExps = expirations.slice(0, 3);
            if (targetExpiration && !targetExps.includes(targetExpiration)) {
                if (expirations.includes(targetExpiration)) {
                    targetExps.push(targetExpiration);
                }
            }

            // 3. Parallelize Fetching using Promise.all
            await Promise.all(targetExps.map(async (exp) => {
                const data = await this.request(`/option-chain`, 'POST', {
                    instrument: { symbol, type: 'EQUITY' },
                    expirationDate: exp
                });

                if (!data) return;

                if (!chain.options[exp]) chain.options[exp] = {};

                const processType = (list: any[], type: 'CALL' | 'PUT') => {
                    if (!list) return;
                    list.forEach((opt: any) => {
                        // Instrument symbol for options is usually structured: ROOT240315C00150000
                        // Extracted strike from the contract symbol if strikePrice is missing
                        // But let's check if there's a strike field
                        const strikeMatch = opt.instrument.symbol.match(/(\d{5})(\d{3})$/);
                        const strike = strikeMatch ? parseFloat(strikeMatch[1]) + (parseFloat(strikeMatch[2]) / 1000) : 0;

                        if (strike > 0) strikesSet.add(strike);

                        if (!chain.options[exp][strike]) {
                            chain.options[exp][strike] = { call: null, put: null };
                        }

                        chain.options[exp][strike][type === 'CALL' ? 'call' : 'put'] = {
                            symbol: opt.instrument.symbol,
                            strike: strike,
                            expiration: exp,
                            type: type,
                            bid: parseFloat(opt.bid || '0'),
                            ask: parseFloat(opt.ask || '0'),
                            last: parseFloat(opt.last || '0'),
                            volume: parseInt(opt.volume || '0'),
                            openInterest: parseInt(opt.openInterest || '0'),
                            // Greeks need a separate call, but we'll return null for now to avoid hundreds of calls
                            greeks: undefined
                        };
                    });
                };

                processType(data.calls, 'CALL');
                processType(data.puts, 'PUT');
            }));

            chain.strikes = Array.from(strikesSet).sort((a, b) => a - b);

            // Save to Cache
            this.chainCache.set(symbol, { data: chain, expiry: Date.now() + this.CHAIN_TTL });

            return chain;

        } catch (e) {
            console.error('[PublicAPI] getOptionChain error:', e);
            // GRACEFUL FALLBACK: Serve stale cache if available
            if (cached) {
                console.warn(`[PublicAPI] Serving stale cache for ${symbol} option chain.`);
                return cached.data;
            }
            return null;
        }
    }

    /**
     * Get Greeks for a specific option symbol
     */
    async getGreeks(optionSymbol: string): Promise<PublicOptionData['greeks'] | undefined> {
        if (!this.isConfigured()) return undefined;
        try {
            // Reverting to GET as per documentation, but using explicit params
            const data = await this.request(`/greeks`, 'GET', null, {
                osiSymbols: [optionSymbol]
            });

            if (data && data.greeks && Array.isArray(data.greeks) && data.greeks.length > 0) {
                const g = data.greeks[0].greeks;
                return {
                    delta: parseFloat(g.delta || 0),
                    gamma: parseFloat(g.gamma || 0),
                    theta: parseFloat(g.theta || 0),
                    vega: parseFloat(g.vega || 0),
                    rho: parseFloat(g.rho || 0),
                    impliedVolatility: parseFloat(g.impliedVolatility || 0)
                };
            }
        } catch (e) {
            console.error('[PublicAPI] getGreeks error:', e);
        }
        return undefined;
    }
}

export const publicClient = new PublicClient();
