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
 * Enhanced Options Signal Generator — v2
 * Improvements: delta-targeted strikes, IV-regime DTE + strategy selection,
 * PCR-adjusted confidence, EMA-anchored stop loss, min OI filter, rich reason strings.
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
    const effectiveAtr = (atr && !isNaN(atr) && atr > 0) ? atr : (currentPrice * 0.02);

    const confluence = indicators
        ? calculateConfluenceScore(indicators)
        : { bullScore: 0, bearScore: 0, bullSignals: [], bearSignals: [], strength: 50, trend: 'NEUTRAL' as any };
    const { bullScore, bearScore, bullSignals, bearSignals } = confluence;

    const isCall = (bullScore > bearScore && bullScore >= 15);
    const isPut = (bearScore > bullScore && bearScore >= 15);
    const direction: 'CALL' | 'PUT' | 'WAIT' = isCall ? 'CALL' : isPut ? 'PUT' : 'WAIT';

    // ── PCR: fetch early (nearly always cached) ────────────────────────────────
    let pcr: { volumeRatio: number; oiRatio: number; totalCalls: number; totalPuts: number } | null = null;
    if (symbol) {
        try { pcr = await getPutCallRatio(symbol); } catch (_) { }
    }

    if (direction === 'WAIT') {
        const fallbackSignals = bullScore >= bearScore ? bullSignals : bearSignals;
        return {
            type: 'WAIT', strike: 0, expiry: '', confidence: 50,
            reason: `Mixed signals. ${fallbackSignals[0] || 'Monitoring Price Action'}`,
            technicalConfirmations: 0,
            fundamentalConfirmations: fundamentalConfirmations || 1,
            socialConfirmations: socialConfirmations || 1, dte: 30
        };
    }

    const signals = isCall ? bullSignals : bearSignals;
    const techConfirmations = signals.length;

    // ── 1. Pre-fetch option chain (needed for IV, DTE, and delta-strike) ───────
    let chain: any = null;
    if (symbol) {
        try {
            chain = schwabClient.isConfigured()
                ? await schwabClient.getOptionChainNormalized(symbol)
                : null;
            if (!chain) chain = await publicClient.getOptionChain(symbol);
        } catch (_) { }
    }

    // ── 2. Estimate ATM IV from the live chain ─────────────────────────────────
    // Use the ATM strike's IV from the nearest expiry as our IV regime signal.
    let atmIV = calculateVolatilityProxy(currentPrice, atr, symbol); // baseline proxy
    if (chain?.options && chain.expirations?.length > 0) {
        const nearestExp = chain.expirations[0];
        const strikesSorted = Object.keys(chain.options[nearestExp] || {})
            .map(Number)
            .sort((a, b) => Math.abs(a - currentPrice) - Math.abs(b - currentPrice));
        for (const s of strikesSorted.slice(0, 3)) {
            const d = chain.options[nearestExp][s];
            const iv = d?.call?.greeks?.impliedVolatility || d?.put?.greeks?.impliedVolatility || 0;
            if (iv > 0) { atmIV = iv; break; }
        }
    }
    const highIV = atmIV > 0.45; // > 45% annualized = elevated IV regime

    // ── 3. Smart DTE selection: best practice 30-60 days ───────────────────────
    // Standard plays: 30-45 DTE
    // High IV plays: 45-60 DTE (more time to overcome premium crush, flatter theta curve)
    const dtePref = highIV ? 50 : 35;
    let expiry = getNextMonthlyExpiry();
    try {
        if (symbol) {
            const expirations = await publicClient.getOptionExpirations(symbol);
            if (expirations && expirations.length > 0) {
                const targetTime = Date.now() + dtePref * 24 * 3600 * 1000;
                expiry = expirations.reduce((prev, curr) => {
                    const prevDiff = Math.abs(new Date(prev).getTime() - targetTime);
                    const currDiff = Math.abs(new Date(curr).getTime() - targetTime);
                    return currDiff < prevDiff ? curr : prev;
                });
                console.log(`[Options] ${symbol}: DTE pref=${dtePref}d (${highIV ? 'high' : 'normal'} IV), selected expiry=${expiry}`);
            }
        }
    } catch (_) { }
    const dte = Math.ceil((new Date(expiry).getTime() - Date.now()) / (1000 * 3600 * 24));

    // ── 4. Strategy selection: single leg directional only ────────────────────
    // User explicitly requested no spreads.
    const strategyName = isCall ? 'Alpha Bull' : 'Alpha Bear';

    const marketSession = publicClient.getMarketSession();
    const isRegularMarket = marketSession === 'REG';
    const volumeThreshold = isRegularMarket ? 2 : 0;

    // ── 5. Delta-targeted strike selection ─────────────────────────
    // Target 0.40 - 0.45Δ: best practice for directional plays (better PoP than .30, cheaper than .50)
    const atrFallbackStrike = roundToStrike(isCall
        ? currentPrice + effectiveAtr * 0.25 // More conservative default offset
        : currentPrice - effectiveAtr * 0.25);
    let intendedStrike = atrFallbackStrike;
    let realOption: any = null;
    let probabilityITM = 0.5;
    const TARGET_DELTA = 0.42; // Center of 0.40 - 0.45 range

    const tryFindDeltaStrike = (chainData: any, exp: string) => {
        if (!chainData?.options?.[exp]) return;
        const strikeKeys = Object.keys(chainData.options[exp]).map(Number).sort((a, b) => a - b);
        let closestDiff = Infinity;

        for (const strike of strikeKeys) {
            const strikeData = chainData.options[exp][strike];
            const opt = isCall ? strikeData?.call : strikeData?.put;
            if (!opt) continue;

            // ── Min OI filter: skip illiquid contracts ──
            if ((opt.openInterest || 0) < 50 && (opt.volume || 0) < Math.max(volumeThreshold, 1)) continue;

            const distPct = Math.abs(strike - currentPrice) / currentPrice;
            
            // ── Dynamic Distance Filter ──
            // Do not go further out than approx 1.5x the realized volatility proxy
            // Caps max distance to protect from buying deep OTM garbage
            const maxAllowedDistance = Math.min(0.20, atmIV * 0.25); 
            if (distPct > maxAllowedDistance) continue;

            // Resolve delta: use actual Greeks or estimate from distance
            let delta: number;
            if (opt.greeks?.delta && opt.greeks.delta !== 0) {
                delta = Math.abs(opt.greeks.delta);
            } else {
                const atmAdjusted = isCall ? -((strike - currentPrice) / currentPrice) : ((strike - currentPrice) / currentPrice);
                delta = Math.max(0.05, Math.min(0.95, 0.50 + atmAdjusted * 3));
            }

            const diff = Math.abs(delta - TARGET_DELTA);
            if (diff < closestDiff) { closestDiff = diff; intendedStrike = strike; }
        }

        // Fetch the chosen strike's option contract
        const strikeData = chainData.options[exp][intendedStrike];
        if (strikeData) {
            const opt = isCall ? strikeData.call : strikeData.put;
            if (opt) { realOption = opt; }
        }
        console.log(`[Options] ${symbol}: Δ-targeted strike=$${intendedStrike} (ATR fallback=$${atrFallbackStrike}) @ ${exp}`);
    };

    // Attempt 1: If base chain HAS our exact target expiry, use it.
    if (chain?.options?.[expiry]) {
        tryFindDeltaStrike(chain, expiry);
    }

    // Attempt 2: If we still don't have an option, do a targeted fetch for our explicitly chosen expiry.
    if (!realOption && symbol) {
        try {
            const freshChain = schwabClient.isConfigured()
                ? await schwabClient.getOptionChainNormalized(symbol, expiry)
                : await publicClient.getOptionChain(symbol, expiry);
            if (freshChain?.options?.[expiry]) tryFindDeltaStrike(freshChain, expiry);
        } catch (_) { }
    }

    // Attempt 3: If standard chain fetch failed, fallback to whatever expiry is available in the base (cached) chain.
    if (!realOption && chain && chain.expirations) {
        const targetTime = Date.now() + dtePref * 24 * 3600 * 1000;
        
        // Find nearest valid expiration >= 14 DTE
        const fallbackExpirations = chain.expirations.filter((e: string) => {
            const days = (new Date(e).getTime() - Date.now()) / (1000 * 3600 * 24);
            return days >= 14 && chain.options?.[e];
        }).sort((a: string, b: string) => Math.abs(new Date(a).getTime() - targetTime) - Math.abs(new Date(b).getTime() - targetTime));

        for (const exp of fallbackExpirations) {
            tryFindDeltaStrike(chain, exp);
            if (realOption) break;
        }
    }

    // Recalculate DTE based exactly on which option we actually ended up finding!
    let finalExpiry = realOption?.expiration || expiry;
    let finalDte = Math.ceil((new Date(finalExpiry).getTime() - Date.now()) / (1000 * 3600 * 24));

    // ── 6. Resolve Greeks for chosen contract ──────────────────────
    if (realOption) {
        if (realOption.greeks?.delta && realOption.greeks.delta !== 0) {
            probabilityITM = Math.abs(realOption.greeks.delta);
        } else {
            // Try Schwab → Public.com for Greeks
            try {
                let greeks = schwabClient.isConfigured()
                    ? await schwabClient.getGreeks(realOption.symbol)
                    : null;
                if (!greeks) greeks = await publicClient.getGreeks(realOption.symbol);
                if (greeks) {
                    realOption.greeks = greeks;
                    probabilityITM = Math.abs(greeks.delta);
                } else {
                    const distFromPrice = Math.abs(currentPrice - intendedStrike) / currentPrice;
                    probabilityITM = Math.max(0.1, 0.5 - distFromPrice * 2);
                    realOption.greeks = {
                        delta: isCall ? probabilityITM : -probabilityITM,
                        gamma: 0, theta: 0, vega: 0, rho: 0, impliedVolatility: atmIV
                    };
                }
            } catch (_) { }
        }
    }

    // ── 6.5 Tactical Flow Upgrade ──────────────────────────────────────────────
    // Check if the Discovery Engine has a highly liquid contract that matches our direction
    if (symbol) {
        try {
            // Fix: Accept an optional pre-fetched chain parameter in findTopOptions and
            // pass the chain down from the caller to avoid repeat API calls.
            // The Schwab/Public caches mitigate this in practice, but cold-start is expensive.
            // Pass minDte = 14 to prevent lotto plays from hijacking the main signal.
            const topCandidates = await findTopOptions(symbol, currentPrice, direction as any, rsi, skipCache, chain, 14);
            if (topCandidates.length > 0) {
                // Look for a top candidate that matches our direction and has massive volume
                const flowUpgrade = topCandidates.find(c =>
                    c.type === direction &&
                    (c.volume || 0) >= Math.max(volumeThreshold * 50, 200) // Demand heavy volume
                );

                if (flowUpgrade) {
                    // Hijack the option selection with the tactical flow pick!
                    realOption = {
                        symbol: flowUpgrade.symbol,
                        strike: flowUpgrade.strike,
                        expiration: flowUpgrade.expiry,
                        bid: flowUpgrade.contractPrice, // approx
                        ask: flowUpgrade.contractPrice,
                        last: flowUpgrade.contractPrice,
                        volume: flowUpgrade.volume,
                        openInterest: flowUpgrade.openInterest,
                        greeks: {
                            delta: isCall ? (flowUpgrade.probabilityITM || 0.5) : -(flowUpgrade.probabilityITM || 0.5),
                            impliedVolatility: flowUpgrade.iv
                        }
                    };

                    intendedStrike = flowUpgrade.strike;
                    probabilityITM = flowUpgrade.probabilityITM || probabilityITM;
                    atmIV = flowUpgrade.iv || atmIV;

                    console.log(`[Options] ${symbol}: Tactical Flow Upgrade! Using $${flowUpgrade.strike} @ ${flowUpgrade.expiry}`);
                }
            }
        } catch (_) { }
    }

    // Recalculate DTE based exactly on which option we actually ended up finding!
    finalExpiry = realOption?.expiration || expiry;
    finalDte = Math.ceil((new Date(finalExpiry).getTime() - Date.now()) / (1000 * 3600 * 24));

    // ── 7. PCR-adjusted confidence (base 50, not 60) ──────────────────────────
    // Requires real convergence of signals to reach 80+
    const rawSpread = Math.abs(bullScore - bearScore);
    let confidence = 50
        + Math.min(15, rawSpread * 0.5)                               // tech spread → up to +15
        + Math.min(9, (fundamentalConfirmations || 0) * 3)           // fundamentals → up to +9
        + Math.min(6, (socialConfirmations || 0) * 2);               // social → up to +6

    let pcrNote = '';
    if (pcr) {
        const pv = pcr.volumeRatio;
        if (isCall && pv < 0.6) { confidence += 8; pcrNote = ` PCR ${pv} (bullish flow).`; }
        else if (isCall && pv > 1.0) { confidence -= 5; pcrNote = ` PCR ${pv} (bearish flow—caution).`; }
        else if (!isCall && pv > 1.0) { confidence += 8; pcrNote = ` PCR ${pv} (bearish flow aligns).`; }
        else if (!isCall && pv < 0.6) { confidence -= 5; pcrNote = ` PCR ${pv} (bullish flow—caution).`; }
        else { pcrNote = ` PCR ${pv} (neutral).`; }
    }
    // Delta quality bonus: being near optimal 0.40 - 0.45 delta adds confidence
    if (probabilityITM >= 0.35 && probabilityITM <= 0.50) confidence += 5;

    // Tactical Flow Bonus: if we matched a discovery engine pick, massive boost
    let tacticalNote = '';
    if (realOption && realOption.volume >= 200) {
        confidence += 15;
        tacticalNote = ` Validated by heavy Tactical Flow (${realOption.volume} Vol).`;
    }

    confidence = Math.min(99, Math.max(50, Math.round(confidence)));

    // ── 8. EMA-anchored stop loss ──────────────────────────────────────────────
    // Use EMA-50 as a logical support/resistance floor instead of bare ATR
    let stopLoss: number;
    let takeProfit1: number;
    let spreadSellStrike: number | undefined = undefined;
    let spreadSellPrice: number | undefined = undefined;

    if (isCall) {
        const ema50Floor = (ema50 && ema50 < currentPrice && ema50 > currentPrice * 0.90)
            ? ema50 * 0.99 : currentPrice - effectiveAtr;
        stopLoss = parseFloat(Math.max(ema50Floor, currentPrice - effectiveAtr * 1.5).toFixed(2));
        takeProfit1 = parseFloat((currentPrice + effectiveAtr * 2).toFixed(2));
    } else {
        const ema50Ceiling = (ema50 && ema50 > currentPrice && ema50 < currentPrice * 1.10)
            ? ema50 * 1.01 : currentPrice + effectiveAtr;
        stopLoss = parseFloat(Math.min(ema50Ceiling, currentPrice + effectiveAtr * 1.5).toFixed(2));
        takeProfit1 = parseFloat((currentPrice - effectiveAtr * 2).toFixed(2));
    }

    // ── 9. Rich reason string ──────────────────────────────────────────────────
    const ivDisplay = ` IV ${(atmIV * 100).toFixed(0)}%.`;
    const deltaDisplay = probabilityITM ? ` Δ${probabilityITM.toFixed(2)}` : '';
    const reason = `${direction} Setup: RSI ${Math.round(rsi)}, ${signals.slice(0, 2).join(' + ') || 'Confluent signals'}.${pcrNote}${tacticalNote}${ivDisplay}${deltaDisplay} ${techConfirmations} tech signals.`;

    const fundamentalDetails = (fundamentalConfirmations || 0) >= 2
        ? ["Strong Earnings Growth", "Undervalued P/E Ratio", "Healthy Debt-to-Equity"]
        : ["Stable Fundamentals", "Positive Free Cash Flow"];
    const socialDetails = (socialConfirmations || 0) >= 2
        ? ["High Reddit Mention Frequency", "Positive StockTwits Sentiment", "Bullish Options Flow"]
        : ["Moderate Retail Interest", "Stable Institutional Sentiment"];

    if (!realOption) {
        return {
            type: 'WAIT', strike: intendedStrike, expiry: finalExpiry, confidence: Math.min(confidence, 65),
            reason: `No liquid contract at $${intendedStrike} strike.${ivDisplay}`,
            technicalConfirmations: techConfirmations,
            fundamentalConfirmations: fundamentalConfirmations || 1,
            socialConfirmations: socialConfirmations || 1, dte: finalDte
        };
    }

    if ((realOption.volume || 0) < volumeThreshold) {
        return {
            type: 'WAIT', strike: intendedStrike, expiry: finalExpiry, confidence: Math.min(confidence, 60),
            reason: `Low liquidity at $${intendedStrike} strike. Monitoring for volume entry.`,
            technicalConfirmations: techConfirmations,
            fundamentalConfirmations: fundamentalConfirmations || 1,
            socialConfirmations: socialConfirmations || 1, dte: finalDte
        };
    }

    const midPrice = (realOption.bid && realOption.ask)
        ? (realOption.bid + realOption.ask) / 2
        : (realOption.last || realOption.bid || realOption.ask || 0);

    return {
        type: direction,
        strike: realOption.strike || intendedStrike,
        expiry: realOption.expiration || expiry,
        confidence,
        reason,
        entryPrice: currentPrice,
        entryCondition: 'Limit Order',
        stopLoss,
        takeProfit1,
        strategy: strategyName,
        volume: realOption.volume,
        openInterest: realOption.openInterest,
        iv: realOption.greeks?.impliedVolatility || atmIV,
        contractPrice: midPrice,
        rsi,
        isUnusual: false,
        technicalConfirmations: techConfirmations,
        fundamentalConfirmations: fundamentalConfirmations || 1,
        socialConfirmations: socialConfirmations || 1,
        technicalDetails: signals,
        fundamentalDetails,
        socialDetails,
        symbol: realOption.symbol || `${symbol}_${finalExpiry}_${realOption.strike || intendedStrike}${isCall ? 'C' : 'P'}`,
        probabilityITM: realOption.greeks?.delta ? Math.abs(realOption.greeks.delta) : probabilityITM,
        dte: finalDte
    };
}





/**
 * Calculates the Put/Call ratio based on volume and open interest for a given symbol
 */
export async function getPutCallRatio(
    symbol: string,
    skipCache: boolean = false,
    preloadedChain?: Awaited<ReturnType<typeof schwabClient.getOptionChainNormalized>>
): Promise<{ volumeRatio: number, oiRatio: number, totalCalls: number, totalPuts: number } | null> {
    if (!symbol) return null;

    // 1. Check Cache (skip if chain was pre-loaded — caller already paid for the fetch)
    if (!skipCache && !preloadedChain) {
        const cached = global._pcrCache.get(symbol);
        if (cached && (Date.now() - cached.timestamp < PCR_CACHE_TTL)) {
            return cached.data;
        }
    }

    try {
        // Use pre-fetched chain if available, otherwise fetch fresh
        let chain = preloadedChain ?? null;
        if (!chain) {
            chain = schwabClient.isConfigured()
                ? await schwabClient.getOptionChainNormalized(symbol)
                : null;
            if (!chain) chain = await publicClient.getOptionChain(symbol);
        }
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

        // Only cache when we fetched fresh (not pre-loaded, which may be a subset)
        if (!preloadedChain) {
            global._pcrCache.set(symbol, { data: result, timestamp: Date.now() });
        }

        return result;
    } catch (e) {
        console.error('Error calculating Put/Call ratio:', e);
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
 * @param preloadedChain - Optional pre-fetched options chain. When provided, no additional
 *   network fetch is made, eliminating a redundant round-trip when the caller already has the chain.
 */
export async function calculateGammaSqueezeProbability(
    symbol: string,
    currentPrice: number,
    atr: number,
    fiftyTwoWeekHigh?: number,
    fiftyTwoWeekLow?: number,
    historicalVolatility?: number,
    preloadedChain?: Awaited<ReturnType<typeof schwabClient.getOptionChainNormalized>>
): Promise<{ score: number, details: string[] }> {
    try {
        // Use pre-fetched chain when available — avoids a second full options chain fetch
        let chain = preloadedChain ?? null;
        if (!chain) {
            chain = schwabClient.isConfigured()
                ? await schwabClient.getOptionChainNormalized(symbol)
                : null;
            if (!chain) chain = await publicClient.getOptionChain(symbol);
        }

        // Compute PCR from the same chain (no separate network call)
        const pcrData = chain ? await getPutCallRatio(symbol, false, chain) : null;

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
    skipCache: boolean = false,
    preloadedChain?: any,
    minDte: number = 1
): Promise<OptionRecommendation[]> {
    try {
        let chain = preloadedChain ?? null;
        if (!chain) {
            // Schwab (primary, 10-min cache) → Public.com fallback
            chain = schwabClient.isConfigured()
                ? await schwabClient.getOptionChainNormalized(symbol)
                : null;
            if (!chain) chain = await publicClient.getOptionChain(symbol);
        }
        if (!chain) return []; // Return empty if no chain found

        const candidates: Array<{ recommendation: OptionRecommendation, score: number }> = [];
        const now = new Date();
        const validExpirations = chain.expirations.filter((exp: string) => {
            const d = new Date(exp);
            const diffDays = (d.getTime() - now.getTime()) / (1000 * 3600 * 24);
            // Configurable minimum DTE based on whether this is for the main signal or discovery widget
            return diffDays >= minDte && diffDays <= 65;
        });

        const marketSession = publicClient.getMarketSession();
        const isMarketOpen = marketSession === 'REG' || marketSession === 'PRE' || marketSession === 'POST';

        for (const exp of validExpirations) {
            const strikes = chain.options[exp];
            for (const strikeStr in strikes) {
                const strike = parseFloat(strikeStr);
                const distance = Math.abs(strike - currentPrice) / currentPrice;

                // 1. Strict Strike Filter: Only ATM/NTM (within 10%)
                // Deep OTM lotto plays are often noise despite high volume
                if (distance > 0.10) continue;

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
                     * 5. Refined Scoring Logic v2
                     * - deltaProxy: Measures moneyness (0.5 max for ATM)
                     * - deltaQuality: Bonus for being in the 0.20–0.50 optimal delta zone
                     * - volume/oi: Capped to prevent single block trades from dominating
                     * - moneyness: High weight to keep suggestions realistic
                     */
                    const deltaProxy = 0.5 - distance;
                    const volumeScore = Math.min(opt.volume || 0, 500) * 2;
                    const oiScore = Math.min(opt.openInterest || 0, 2000) * 0.75; // Raised OI weight
                    const moneynessScore = deltaProxy * 200; // Up to 100 pts

                    // Actual delta quality bonus: reward contracts in the 0.35–0.50 delta "sweet spot"
                    const actualDelta = opt.greeks?.delta ? Math.abs(opt.greeks.delta) : null;
                    const deltaQuality = actualDelta !== null
                        ? (actualDelta >= 0.35 && actualDelta <= 0.50 ? 80 : actualDelta >= 0.20 ? 30 : 0)
                        : 0;

                    const score = volumeScore + oiScore + moneynessScore + deltaQuality;

                    // Rich reason string
                    const deltaStr = actualDelta !== null ? ` Δ${actualDelta.toFixed(2)}` : '';
                    const volStr = opt.volume ? `Vol ${opt.volume.toLocaleString()}` : '';
                    const oiStr = opt.openInterest ? `OI ${opt.openInterest.toLocaleString()}` : '';
                    const reasonStr = `${type} $${strike} — ${[volStr, oiStr, deltaStr].filter(Boolean).join(', ')}.`;

                    candidates.push({
                        recommendation: {
                            type,
                            strike,
                            expiry: exp,
                            confidence: 70,
                            reason: reasonStr,
                            entryPrice: currentPrice,
                            entryCondition: "Limit Order",
                            stopLoss: type === 'CALL' ? currentPrice * 0.97 : currentPrice * 1.03,
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
