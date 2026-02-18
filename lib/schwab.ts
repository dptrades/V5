import axios from 'axios';
import { env } from './env';
import { OHLCVData } from '../types/financial';
import { PublicOptionChain, PublicOptionData } from './public-api';

const BASE_URL = 'https://api.schwabapi.com/marketdata/v1';
const AUTH_URL = 'https://api.schwabapi.com/v1/oauth/token';

export class SchwabClient {
    private clientId: string;
    private clientSecret: string;
    private refreshToken: string | null = null;
    private accessToken: string | null = null;
    private tokenExpiry: number = 0;
    private throttledUntil: number = 0;

    // 10-minute option chain cache
    private chainCache: Map<string, { data: PublicOptionChain; timestamp: number }> = new Map();
    private readonly CHAIN_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

    constructor() {
        this.clientId = env.SCHWAB_CLIENT_ID || '';
        this.clientSecret = env.SCHWAB_CLIENT_SECRET || '';
        this.refreshToken = env.SCHWAB_REFRESH_TOKEN || '';
    }

    isConfigured(): boolean {
        return !!(this.clientId && this.clientSecret && this.refreshToken);
    }

    private async refreshAccessToken(): Promise<string> {
        if (Date.now() < this.throttledUntil) return '';
        if (this.accessToken && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }

        if (!this.isConfigured()) return '';

        try {
            const start = Date.now();
            const authHeader = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
            const response = await axios.post(AUTH_URL,
                new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: this.refreshToken!
                }),
                {
                    headers: {
                        'Authorization': `Basic ${authHeader}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            if (response.data.access_token) {
                this.accessToken = response.data.access_token;
                // Tokens typically last 30 mins
                this.tokenExpiry = Date.now() + (response.data.expires_in - 60) * 1000;
                console.log(`[SchwabAPI] Token refreshed in ${Date.now() - start}ms`);
                return this.accessToken!;
            }
        } catch (error: any) {
            if (error.response?.status === 429) {
                this.throttledUntil = Date.now() + (30 * 1000);
            }
            console.error('[SchwabAPI] Failed to refresh token:', error.response?.data || error.message);
        }
        return '';
    }

    async getPriceHistory(symbol: string, periodType: string, period: number, frequencyType: string, frequency: number): Promise<OHLCVData[]> {
        if (Date.now() < this.throttledUntil) return [];
        const token = await this.refreshAccessToken();
        if (!token) return [];

        try {
            const start = Date.now();
            const response = await axios.get(`${BASE_URL}/pricehistory`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: {
                    symbol,
                    periodType,
                    period,
                    frequencyType,
                    frequency,
                    needExtendedHoursData: true
                }
            });

            if (response.data && response.data.candles) {
                console.log(`[SchwabAPI] Price history for ${symbol} in ${Date.now() - start}ms (${response.data.candles.length} bars)`);
                return response.data.candles.map((c: any) => ({
                    time: c.datetime,
                    open: c.open,
                    high: c.high,
                    low: c.low,
                    close: c.close,
                    volume: c.volume
                }));
            }
        } catch (error: any) {
            if (error.response?.status === 429) {
                this.throttledUntil = Date.now() + (30 * 1000);
            }
            console.error(`[SchwabAPI] Failed to fetch price history for ${symbol}:`, error.message);
        }
        return [];
    }

    /**
     * Fetch option chain from Schwab and normalize to PublicOptionChain format.
     * Cached for 10 minutes.
     */
    async getOptionChainNormalized(symbol: string, targetExpiry?: string): Promise<PublicOptionChain | null> {
        // Check cache
        const cacheKey = `${symbol}:${targetExpiry || 'ALL'}`;
        const cached = this.chainCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this.CHAIN_CACHE_TTL) {
            console.log(`[SchwabAPI] ⚡ Serving cached chain for ${symbol} (age: ${Math.round((Date.now() - cached.timestamp) / 1000)}s)`);
            return cached.data;
        }

        if (Date.now() < this.throttledUntil) return null;
        const token = await this.refreshAccessToken();
        if (!token) return null;

        try {
            const start = Date.now();
            const params: any = { symbol, contractType: 'ALL' };
            if (targetExpiry) {
                params.fromDate = targetExpiry;
                params.toDate = targetExpiry;
            }

            const response = await axios.get(`${BASE_URL}/chains`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params
            });

            const raw = response.data;
            if (!raw || raw.status === 'FAILED') {
                console.warn(`[SchwabAPI] Option chain failed for ${symbol}`);
                return null;
            }

            // Normalize Schwab format → PublicOptionChain format
            const normalized = this.normalizeSchwabChain(raw, symbol);
            console.log(`[SchwabAPI] Option chain for ${symbol} in ${Date.now() - start}ms (${normalized.expirations.length} expirations, ${normalized.strikes.length} strikes)`);

            // Cache the result
            this.chainCache.set(cacheKey, { data: normalized, timestamp: Date.now() });

            return normalized;
        } catch (error: any) {
            if (error.response?.status === 429) {
                this.throttledUntil = Date.now() + (30 * 1000);
                console.error('[SchwabAPI] 🛑 Rate limit hit (429). Cooldown 30s.');
            }
            console.error(`[SchwabAPI] Failed to fetch option chain for ${symbol}:`, error.message);
            return null;
        }
    }

    /**
     * Convert Schwab's callExpDateMap/putExpDateMap format to the PublicOptionChain format
     * used throughout the app.
     */
    private normalizeSchwabChain(raw: any, symbol: string): PublicOptionChain {
        const options: PublicOptionChain['options'] = {};
        const expirationsSet = new Set<string>();
        const strikesSet = new Set<number>();

        // Process calls
        if (raw.callExpDateMap) {
            for (const expKey in raw.callExpDateMap) {
                // Schwab key format: "2026-03-20:31" (date:daysToExpiration)
                const expDate = expKey.split(':')[0];
                expirationsSet.add(expDate);

                if (!options[expDate]) options[expDate] = {};

                const strikeMap = raw.callExpDateMap[expKey];
                for (const strikeStr in strikeMap) {
                    const strike = parseFloat(strikeStr);
                    strikesSet.add(strike);

                    if (!options[expDate][strike]) {
                        options[expDate][strike] = { call: null, put: null };
                    }

                    const schwabOpt = Array.isArray(strikeMap[strikeStr])
                        ? strikeMap[strikeStr][0]
                        : strikeMap[strikeStr];

                    if (schwabOpt) {
                        options[expDate][strike].call = this.normalizeSchwabOption(schwabOpt, strike, expDate, 'CALL');
                    }
                }
            }
        }

        // Process puts
        if (raw.putExpDateMap) {
            for (const expKey in raw.putExpDateMap) {
                const expDate = expKey.split(':')[0];
                expirationsSet.add(expDate);

                if (!options[expDate]) options[expDate] = {};

                const strikeMap = raw.putExpDateMap[expKey];
                for (const strikeStr in strikeMap) {
                    const strike = parseFloat(strikeStr);
                    strikesSet.add(strike);

                    if (!options[expDate][strike]) {
                        options[expDate][strike] = { call: null, put: null };
                    }

                    const schwabOpt = Array.isArray(strikeMap[strikeStr])
                        ? strikeMap[strikeStr][0]
                        : strikeMap[strikeStr];

                    if (schwabOpt) {
                        options[expDate][strike].put = this.normalizeSchwabOption(schwabOpt, strike, expDate, 'PUT');
                    }
                }
            }
        }

        return {
            symbol,
            expirations: Array.from(expirationsSet).sort(),
            strikes: Array.from(strikesSet).sort((a, b) => a - b),
            options
        };
    }

    /**
     * Normalize a single Schwab option contract to PublicOptionData format
     */
    private normalizeSchwabOption(opt: any, strike: number, expDate: string, type: 'CALL' | 'PUT'): PublicOptionData {
        return {
            symbol: opt.symbol || '',
            strike,
            expiration: expDate,
            type,
            bid: opt.bid || 0,
            ask: opt.ask || 0,
            last: opt.last || opt.lastPrice || 0,
            volume: opt.totalVolume || opt.volume || 0,
            openInterest: opt.openInterest || 0,
            greeks: {
                delta: opt.delta || 0,
                gamma: opt.gamma || 0,
                theta: opt.theta || 0,
                vega: opt.vega || 0,
                rho: opt.rho || 0,
                impliedVolatility: opt.volatility || opt.impliedVolatility || 0
            }
        };
    }

    /**
     * Get Greeks for a specific option symbol.
     * Schwab's /quotes endpoint returns Greeks inline.
     */
    async getGreeks(symbol: string): Promise<any> {
        if (Date.now() < this.throttledUntil) return null;
        const token = await this.refreshAccessToken();
        if (!token) return null;

        try {
            const start = Date.now();
            const response = await axios.get(`${BASE_URL}/${symbol}/quotes`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.data && response.data[symbol]) {
                const quote = response.data[symbol];
                const q = quote.quote;
                console.log(`[SchwabAPI] Greeks for ${symbol} in ${Date.now() - start}ms`);
                return {
                    delta: q?.delta || 0,
                    gamma: q?.gamma || 0,
                    theta: q?.theta || 0,
                    vega: q?.vega || 0,
                    rho: q?.rho || 0,
                    impliedVolatility: q?.volatility || 0,
                    lastPrice: quote.lastPrice || q?.lastPrice || 0
                };
            }
        } catch (error: any) {
            if (error.response?.status === 429) {
                this.throttledUntil = Date.now() + (30 * 1000);
            }
            console.error(`[SchwabAPI] Failed to fetch Greeks for ${symbol}:`, error.message);
        }
        return null;
    }

    // Legacy method kept for backward compat (used in market-data.ts waterfall)
    async getOptionChain(symbol: string): Promise<any> {
        return this.getOptionChainNormalized(symbol);
    }
}

export const schwabClient = new SchwabClient();
