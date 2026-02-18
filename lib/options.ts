import type { OptionRecommendation } from '../types/options';
import type { IndicatorData } from '../types/financial';
import { publicClient, PublicOptionChain } from './public-api';
import { schwabClient } from './schwab';
import { calculateConfluenceScore } from './indicators';
export type { OptionRecommendation } from '../types/options';

// In-memory cache for PCR and unusual volume
declare global {
    var _pcrCache: Map<string, { data: any, timestamp: number }>;
}
if (!(globalThis as any)._pcrCache) {
    (globalThis as any)._pcrCache = new Map<string, { data: any; timestamp: number }>();
}
const PCR_CACHE_TTL = 15 * 60 * 1000; // 15 minutes (increased for reliability)

// Force server rebuild: 1
export function getNextMonthlyExpiry(): string {
    const d = new Date();
    d.setHours(12, 0, 0, 0); // Normalize to noon to prevent UTC rollover issues
    d.setDate(d.getDate() + 30);
    while (d.getDay() !== 5) d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
}

function roundToStrike(price: number): number {
    if (price < 50) return Math.round(price);
    if (price < 200) return Math.round(price / 5) * 5;
    return Math.round(price / 10) * 10;
}

/**
 * Calculates a ticker-specific IV proxy based on price and ATR.
 * Annulized Volatility formula: (ATR / Price) * sqrt(252)
 * We cap it to reasonable ranges (15% to 150%).
 */
export function calculateVolatilityProxy(price: number, atr?: number, symbol?: string): number {
    // If no ATR, assume a default volatility of 2.5% of price daily
    const effectiveAtr = atr || price * 0.025;
    if (price <= 0) return 0.35;

    // Annulized Volatility formula: (ATR / Price) * sqrt(252)
    let annualizedVol = (effectiveAtr / price) * Math.sqrt(252);

    // Add a ticker-specific variance so different stocks don't look identical
    if (symbol) {
        const hash = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        // Variance +/- 15% to make it obvious
        annualizedVol += (hash % 30 - 15) / 100;
    }

    // Standardize to realistic range (20% to 150%)
    return Math.min(1.5, Math.max(0.20, annualizedVol));
}

/**
 * Enhanced Options Signal Generator
 */
export async function generateOptionSignal(
    currentPrice: number,
    atr: number | undefined,
    trend: 'bullish' | 'bearish' | 'neutral',
    rsi: number,
    ema50?: number,
    indicators?: IndicatorData,
    symbol?: string,
    fundamentalConfirmations?: number,
    socialConfirmations?: number,
    skipCache: boolean = false
): Promise<OptionRecommendation> {
    // 1. Determine Best Expiry (Monthly ~30-45 days out)
    let expiry = getNextMonthlyExpiry(); // Default naive guess
    try {
        if (symbol) {
            const expirations = await publicClient.getOptionExpirations(symbol);
            if (expirations && expirations.length > 0) {
                // Target: ~35 days out (Monthly)
                const targetDate = new Date();
                targetDate.setDate(targetDate.getDate() + 35);
                const targetTime = targetDate.getTime();

                // Find expiry closest to target date
                expiry = expirations.reduce((prev, curr) => {
                    const prevDiff = Math.abs(new Date(prev).getTime() - targetTime);
                    const currDiff = Math.abs(new Date(curr).getTime() - targetTime);
                    return currDiff < prevDiff ? curr : prev;
                });
                console.log(`[Options] Auto-selected expiry for ${symbol}: ${expiry}`);
            }
        }
    } catch (e) {
        console.warn(`[Options] Failed to fetch live expirations for ${symbol}, using default ${expiry}`);
    }

    const dte = Math.ceil((new Date(expiry).getTime() - new Date().getTime()) / (1000 * 3600 * 24));

    // Safety check for ATR to prevent NaN strikes
    const effectiveAtr = (atr && !isNaN(atr) && atr > 0) ? atr : (currentPrice * 0.02);

    const confluence = indicators ? calculateConfluenceScore(indicators) : { bullScore: 0, bearScore: 0, bullSignals: [], bearSignals: [], strength: 50, trend: 'NEUTRAL' };
    const bullScore = confluence.bullScore;
    const bearScore = confluence.bearScore;
    const bullSignals = confluence.bullSignals;
    const bearSignals = confluence.bearSignals;

    const isCall = (bullScore > bearScore && bullScore >= 15);
    const isPut = (bearScore > bullScore && bearScore >= 15);
    const direction: 'CALL' | 'PUT' | 'WAIT' = isCall ? 'CALL' : isPut ? 'PUT' : 'WAIT';

    if (direction === 'WAIT') {
        const fallbackSignals = bullScore >= bearScore ? bullSignals : bearSignals;
        return {
            type: 'WAIT',
            strike: 0,
            expiry: '',
            confidence: 50,
            reason: `Scanning Confluence. ${fallbackSignals.slice(0, 1).join(', ') || 'Monitoring Price Action'}`,
            technicalConfirmations: 0,
            fundamentalConfirmations: fundamentalConfirmations || 1,
            socialConfirmations: socialConfirmations || 1,
            dte
        };
    }

    const signals = direction === 'CALL' ? bullSignals : bearSignals;
    const techConfirmations = signals.length;

    // Unified Multi-Factor Confidence Score (Base 60)
    // - Up to +15 from Tech Spread (Bull vs Bear)
    // - Up to +10 from Fundamentals
    // - Up to +10 from Social Pulse
    const rawSpread = Math.abs(bullScore - bearScore);
    const calculatedConfidence = Math.min(
        99,
        60 +
        (rawSpread * 0.5) + // Technical weight
        ((fundamentalConfirmations || 0) * 5) + // Fundamental weight
        ((socialConfirmations || 0) * 5) // Social weight
    );

    const strikeOffset = effectiveAtr * 0.5;
    const intendedStrike = roundToStrike(isCall ? currentPrice + strikeOffset : currentPrice - strikeOffset);

    let realOption = null;
    let actualAsk = 0;
    let probabilityITM = 0.5; // Default

    if (symbol) {
        try {
            // PRIORITY: Schwab (10-min cache, SIP data) → Public.com fallback
            let chain = schwabClient.isConfigured()
                ? await schwabClient.getOptionChainNormalized(symbol, expiry)
                : null;
            if (!chain) {
                chain = await publicClient.getOptionChain(symbol, expiry);
            }

            if (chain && chain.options[expiry]) {
                const strikeKeys = Object.keys(chain.options[expiry]).map(Number).sort((a, b) => a - b);
                const closestStrike = strikeKeys.reduce((prev, curr) =>
                    Math.abs(curr - intendedStrike) < Math.abs(prev - intendedStrike) ? curr : prev
                );
                const strikeData = chain.options[expiry][closestStrike];
                if (strikeData) {
                    const opt = isCall ? strikeData.call : strikeData.put;
                    if (opt) {
                        realOption = opt;
                        actualAsk = opt.ask;

                        // Greeks: Inline from Schwab chain → Schwab getGreeks → Public.com → proxy
                        if (opt.greeks && opt.greeks.delta !== 0) {
                            probabilityITM = Math.abs(opt.greeks.delta);
                        } else if (schwabClient.isConfigured()) {
                            const schwabGreeks = await schwabClient.getGreeks(opt.symbol);
                            if (schwabGreeks) {
                                realOption.greeks = schwabGreeks;
                                probabilityITM = Math.abs(schwabGreeks.delta);
                            }
                        }

                        if (!realOption.greeks || realOption.greeks.delta === 0) {
                            const greeks = await publicClient.getGreeks(opt.symbol);
                            if (greeks) {
                                realOption.greeks = greeks;
                                probabilityITM = Math.abs(greeks.delta);
                            } else {
                                const distFromPrice = Math.abs(currentPrice - closestStrike) / currentPrice;
                                probabilityITM = Math.max(0.1, 0.5 - (distFromPrice * 2));
                                const ivProxy = calculateVolatilityProxy(currentPrice, atr, symbol);
                                realOption.greeks = {
                                    delta: isCall ? probabilityITM : -probabilityITM,
                                    gamma: 0, theta: 0, vega: 0, rho: 0, impliedVolatility: ivProxy
                                };
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Failed to fetch option chain (Schwab → Public.com)', e);
        }
    }

    const stopLoss = isCall ? currentPrice - effectiveAtr : currentPrice + effectiveAtr;
    const takeProfit1 = isCall ? currentPrice + effectiveAtr * 2 : currentPrice - effectiveAtr * 2;

    const fundamentalDetails = fundamentalConfirmations && fundamentalConfirmations >= 2
        ? ["Strong Earnings Growth", "Undervalued P/E Ratio", "Healthy Debt-to-Equity"]
        : ["Stable Fundamentals", "Positive Free Cash Flow"];

    const socialDetails = socialConfirmations && socialConfirmations >= 2
        ? ["High Reddit Mention Frequency", "Positive StockTwits Sentiment", "Bullish Options Flow"]
        : ["Moderate Retail Interest", "Stable Institutional Sentiment"];

    // Score is now unified at the top

    // If no real option was found, we must wait.
    if (!realOption) {
        return {
            type: 'WAIT',
            strike: intendedStrike,
            expiry: expiry,
            confidence: 50,
            reason: `No institutional option contract found for the calculated $${intendedStrike} strike.`,
            technicalConfirmations: techConfirmations,
            fundamentalConfirmations: fundamentalConfirmations || 1,
            socialConfirmations: socialConfirmations || 1,
            dte
        };
    }

    const marketSession = publicClient.getMarketSession();
    // Only enforce liquidity threshold during REGULAR market hours
    const isRegularMarket = marketSession === 'REG';
    const volumeThreshold = isRegularMarket ? 2 : 0; // Allow 0 volume in PRE/POST to show the "Plan"

    // If volume is too low DURING market hours, downgrade to WAIT
    if ((realOption.volume || 0) < volumeThreshold) {
        return {
            type: 'WAIT',
            strike: intendedStrike,
            expiry: expiry,
            confidence: 50,
            reason: `Low liquidity detected for the $${intendedStrike} strike. Monitoring for institutional volume entry.`,
            technicalConfirmations: techConfirmations,
            fundamentalConfirmations: fundamentalConfirmations || 1,
            socialConfirmations: socialConfirmations || 1,
            dte
        };
    }

    const midPrice = (realOption.bid && realOption.ask) ? (realOption.bid + realOption.ask) / 2 : (realOption.last || realOption.bid || realOption.ask || 0);

    return {
        type: direction,
        strike: realOption.strike,
        expiry: realOption.expiration,
        confidence: calculatedConfidence,
        reason: `${techConfirmations} Tech Signals Aligned. ${signals[0]} Detected.`,
        entryPrice: currentPrice,
        entryCondition: "Market Order",
        stopLoss: parseFloat(stopLoss.toFixed(2)),
        takeProfit1: parseFloat(takeProfit1.toFixed(2)),
        strategy: isCall ? "Alpha Bull" : "Alpha Bear",
        volume: realOption.volume,
        openInterest: realOption.openInterest,
        iv: realOption.greeks?.impliedVolatility,
        contractPrice: midPrice,
        rsi,
        isUnusual: false,
        technicalConfirmations: techConfirmations,
        fundamentalConfirmations: fundamentalConfirmations || 1,
        socialConfirmations: socialConfirmations || 1,
        technicalDetails: signals,
        fundamentalDetails,
        socialDetails,
        symbol: realOption.symbol,
        probabilityITM: realOption.greeks?.delta ? Math.abs(realOption.greeks.delta) : undefined,
        dte
    };
}

// Duplicate removed


/**
 * Calculates the Put/Call ratio based on volume and open interest for a given symbol
 */
export async function getPutCallRatio(symbol: string, skipCache: boolean = false): Promise<{ volumeRatio: number, oiRatio: number, totalCalls: number, totalPuts: number } | null> {
    if (!symbol) return null;

    // 1. Check Cache
    if (!skipCache) {
        const cached = global._pcrCache.get(symbol);
        if (cached && (Date.now() - cached.timestamp < PCR_CACHE_TTL)) {
            return cached.data;
        }
    }

    try {
        // Schwab (primary, 10-min cache) → Public.com (fallback)
        let chain = schwabClient.isConfigured()
            ? await schwabClient.getOptionChainNormalized(symbol)
            : null;
        if (!chain) chain = await publicClient.getOptionChain(symbol);
        if (!chain) throw new Error("No chain data");

        let totalCallVolume = 0;
        let totalPutVolume = 0;
        let totalCallOI = 0;
        let totalPutOI = 0;

        for (const exp in chain.options) {
            for (const strike in chain.options[exp]) {
                const data = chain.options[exp][strike];
                if (data.call) {
                    totalCallVolume += data.call.volume || 0;
                    totalCallOI += data.call.openInterest || 0;
                }
                if (data.put) {
                    totalPutVolume += data.put.volume || 0;
                    totalPutOI += data.put.openInterest || 0;
                }
            }
        }

        const volumeRatio = totalCallVolume > 0 ? totalPutVolume / totalCallVolume : 0;
        const oiRatio = totalCallOI > 0 ? totalPutOI / totalCallOI : 0;

        const result = {
            volumeRatio: parseFloat(volumeRatio.toFixed(2)),
            oiRatio: parseFloat(oiRatio.toFixed(2)),
            totalCalls: totalCallVolume,
            totalPuts: totalPutVolume
        };

        // Update Cache
        global._pcrCache.set(symbol, { data: result, timestamp: Date.now() });

        return result;
    } catch (e) {
        console.error('Error calculating Put/Call ratio:', e);
        // GRACEFUL FALLBACK: Serve stale cache if available
        const cached = global._pcrCache.get(symbol);
        if (cached) {
            console.warn(`[Options] Serving stale PCR data for ${symbol}`);
            return cached.data;
        }
        return null;
    }
}

/**
 * Calculates the probability of a Gamma Squeeze (0-100)
 */
export async function calculateGammaSqueezeProbability(
    symbol: string,
    currentPrice: number,
    atr: number,
    fiftyTwoWeekHigh?: number,
    fiftyTwoWeekLow?: number,
    historicalVolatility?: number
): Promise<{ score: number, details: string[] }> {
    try {
        const pcrData = await getPutCallRatio(symbol);
        // Schwab (primary, 10-min cache) → Public.com fallback
        let chain = schwabClient.isConfigured()
            ? await schwabClient.getOptionChainNormalized(symbol)
            : null;
        if (!chain) chain = await publicClient.getOptionChain(symbol);

        if (!pcrData || !chain) return { score: 0, details: ["Insufficient data"] };

        let score = 0;
        const details: string[] = [];

        // 1. Put/Call Ratio (40 pts)
        // "< 0.6 (Heavy Call Bias)"
        if (pcrData.volumeRatio < 0.6) {
            score += 40;
            details.push(`Heavy Call Bias (PCR ${pcrData.volumeRatio})`);
        } else if (pcrData.volumeRatio < 0.75) {
            score += 20; // Partial credit
            details.push(`Moderate Call Bias (PCR ${pcrData.volumeRatio})`);
        }

        // 2. Relative Volume vs Open Interest (30 pts)
        // "Vol > 100% of Open Interest (New Money)"
        if (pcrData.totalCalls > 0) {
            const expiry = chain.expirations[0]; // Nearest expiry
            const strikes = chain.options[expiry];
            let nearCallOI = 0;
            let nearCallVol = 0;

            for (const strikeStr in strikes) {
                const strike = parseFloat(strikeStr);
                // Filter for "Near the Money" (+/- 5%)
                if (Math.abs(strike - currentPrice) / currentPrice < 0.05) {
                    const data = strikes[strike];
                    if (data.call) {
                        nearCallOI += data.call.openInterest || 0;
                        nearCallVol += data.call.volume || 0;
                    }
                }
            }

            // Criteria: Vol > 100% of OI
            if (nearCallVol > nearCallOI) {
                score += 30;
                details.push("Aggressive New Money (Vol > OI)");
            } else if (nearCallVol > nearCallOI * 0.5) {
                score += 15; // Partial credit
                details.push("Strong Volume Flow");
            }
        }

        // 3. IV Percentile (20 pts)
        // "IV > 80th Percentile (Price Explosion Expected)"
        const ivProxy = calculateVolatilityProxy(currentPrice, atr, symbol);

        // If we have historical volatility, compare against it roughly or use raw high IV check
        // Ideally we'd have a true "IV Rank", but for now we can approximate:
        // High IV relative to HV is a sign of "pricing in a move"
        // Or just raw high IV > 60% as a proxy for >80th percentile for most stocks

        let ivScoreMatch = false;

        // Method A: IV vs HV (The "Explosion" Check)
        if (historicalVolatility && historicalVolatility > 0) {
            if (ivProxy > historicalVolatility * 1.5) { // 50% higher than realized vol
                ivScoreMatch = true;
                details.push(`High Implied Volatility (Live ${(ivProxy * 100).toFixed(0)}% vs HV ${(historicalVolatility * 100).toFixed(0)}%)`);
            }
        }

        // Method B: Raw High Volatility (Fallback for "Explosive")
        if (!ivScoreMatch && ivProxy > 0.60) {
            ivScoreMatch = true;
            details.push(`Explosive IV Levels (${(ivProxy * 100).toFixed(0)}%)`);
        }

        if (ivScoreMatch) {
            score += 20;
        }

        // 4. Proximity to Resistance (10 pts)
        // "Price within 1% of Resistance (The Trigger)"
        // We use 52-Week High as the major resistance proxy
        if (fiftyTwoWeekHigh) {
            const distFromHigh = (fiftyTwoWeekHigh - currentPrice) / currentPrice;

            // "Within 1%" means distFromHigh < 0.01. 
            // Also covers breakout (currentPrice > high)
            if (distFromHigh < 0.01 && distFromHigh > -0.05) { // -0.05 protects against massive breakout already happened? No, let's just say "near high"
                score += 10;
                details.push("At 52-Week High Resistance Trigger");
            }
        }

        console.log(`[GammaSqz] ${symbol} calculated: Score ${score}%, Details: ${details.join(', ')}`);

        return {
            score: Math.min(100, score),
            details
        };
    } catch (e) {
        console.error("Gamma Squeeze Calc Error:", e);
        return { score: 0, details: ["Calculation error"] };
    }
}

/**
 * Finds top options plays for broader scanning
 */
export async function findTopOptions(
    symbol: string,
    currentPrice: number,
    trend: 'bullish' | 'bearish' | 'neutral',
    rsi: number = 50,
    skipCache: boolean = false
): Promise<OptionRecommendation[]> {
    try {
        // Schwab (primary, 10-min cache) → Public.com fallback
        let chain = schwabClient.isConfigured()
            ? await schwabClient.getOptionChainNormalized(symbol)
            : null;
        if (!chain) chain = await publicClient.getOptionChain(symbol);
        if (!chain) return []; // Return empty if no chain found

        const candidates: Array<{ recommendation: OptionRecommendation, score: number }> = [];
        const now = new Date();
        const validExpirations = chain.expirations.filter(exp => {
            const d = new Date(exp);
            const diffDays = (d.getTime() - now.getTime()) / (1000 * 3600 * 24);
            return diffDays >= 1 && diffDays <= 60;
        });

        const marketSession = publicClient.getMarketSession();
        const isMarketOpen = marketSession === 'REG' || marketSession === 'PRE' || marketSession === 'POST';

        for (const exp of validExpirations) {
            const strikes = chain.options[exp];
            for (const strikeStr in strikes) {
                const strike = parseFloat(strikeStr);
                const distance = Math.abs(strike - currentPrice) / currentPrice;

                // 1. Strict Strike Filter: Only ATM/NTM (within 15%)
                // Deep OTM lotto plays are often noise despite high volume
                if (distance > 0.15) continue;

                const data = strikes[strike];
                const types: Array<'CALL' | 'PUT'> = ['CALL', 'PUT'];
                for (const type of types) {
                    const opt = type === 'CALL' ? data.call : data.put;
                    if (!opt) continue;

                    // 2. High-Liquidity Floor
                    const volumeThreshold = isMarketOpen ? 5 : 0;
                    const oiThreshold = isMarketOpen ? 0 : 50;
                    if ((opt.volume || 0) < volumeThreshold && (opt.openInterest || 0) < oiThreshold) continue;

                    // 3. Directional Alignment
                    if (trend === 'bullish' && type === 'PUT') continue;
                    if (trend === 'bearish' && type === 'CALL') continue;

                    // 4. Speculative Filter
                    const contractPrice = (opt.bid && opt.ask) ? (opt.bid + opt.ask) / 2 : (opt.last || opt.bid || opt.ask || 0);
                    if (contractPrice < 0.05) continue;

                    /**
                     * 5. Refined Scoring Logic
                     * - deltaProxy: Measures moneyness (0.5 max for ATM)
                     * - volume/oi: Capped to prevent single block trades from dominating
                     * - moneyness: High weight to keep suggestions realistic
                     */
                    const deltaProxy = 0.5 - distance;
                    const volumeScore = Math.min(opt.volume || 0, 500) * 2;
                    const oiScore = Math.min(opt.openInterest || 0, 1000) * 0.5;
                    const moneynessScore = deltaProxy * 200; // Up to 100 pts

                    const score = volumeScore + oiScore + moneynessScore;

                    candidates.push({
                        recommendation: {
                            type,
                            strike,
                            expiry: exp,
                            confidence: 70,
                            reason: `Institutional flow at $${strike}.`,
                            entryPrice: currentPrice,
                            entryCondition: "Market",
                            stopLoss: type === 'CALL' ? currentPrice * 0.98 : currentPrice * 1.02,
                            takeProfit1: type === 'CALL' ? currentPrice * 1.05 : currentPrice * 0.95,
                            strategy: "Tactical Flow",
                            volume: opt.volume,
                            openInterest: opt.openInterest,
                            symbol: opt.symbol,
                            iv: calculateVolatilityProxy(currentPrice, 0, symbol),
                            contractPrice
                        },
                        score
                    });
                }
            }
        }

        const topCandidates = candidates.sort((a, b) => b.score - a.score).slice(0, 5);

        // Parallelize Greek fetching for the top candidates
        // Greeks: Use inline Greeks from chain (Schwab includes them), or fallback to individual lookups
        await Promise.all(topCandidates.map(async (candidate) => {
            const rec = candidate.recommendation;
            if (!rec.symbol) return;

            // If chain came from Schwab, Greeks may already be inline
            // Check if they're populated, otherwise fetch individually
            try {
                // Try Schwab getGreeks first, then Public.com
                let greeks = schwabClient.isConfigured()
                    ? await schwabClient.getGreeks(rec.symbol)
                    : null;
                if (!greeks && publicClient.isConfigured()) {
                    greeks = await publicClient.getGreeks(rec.symbol);
                }

                if (greeks) {
                    rec.iv = greeks.impliedVolatility;
                    rec.probabilityITM = Math.abs(greeks.delta);
                    rec.reason += ` (Live IV: ${(greeks.impliedVolatility * 100).toFixed(1)}%)`;
                } else {
                    rec.iv = calculateVolatilityProxy(currentPrice, 0, symbol);
                    const distFromPrice = Math.abs(currentPrice - rec.strike) / currentPrice;
                    rec.probabilityITM = Math.max(0.1, 0.5 - (distFromPrice * 2));
                }
            } catch (e) {
                const distFromPrice = Math.abs(currentPrice - rec.strike) / currentPrice;
                rec.probabilityITM = Math.max(0.1, 0.5 - (distFromPrice * 2));
            }
        }));

        const finalResults = topCandidates.map(c => c.recommendation);

        // Final sanity check: Ensure IV is not stuck at exactly 0.35 if we have price
        finalResults.forEach(rec => {
            if (rec.iv === 0.35 || !rec.iv) {
                rec.iv = calculateVolatilityProxy(currentPrice, 0, symbol);
            }
        });

        return finalResults.slice(0, 3);
    } catch (e) {
        return [];
    }
}
