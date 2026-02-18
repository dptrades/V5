import { OHLCVData, IndicatorData } from '../types/financial';
import { EMA, RSI, MACD, BollingerBands, ADX } from 'technicalindicators';
import { calculateAnchoredVWAP, VWAPAnchor } from './vwap';

export const calculateIndicators = (data: OHLCVData[], vwapAnchor: VWAPAnchor = 'none'): IndicatorData[] => {
    // Extract arrays for technicalindicators
    const closes = data.map(d => d.close);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const volumes = data.map(d => d.volume);

    // -------------------------------------------------------------------------
    // 1. STANDARD INDICATORS
    // -------------------------------------------------------------------------
    const ema9 = EMA.calculate({ period: 9, values: closes });
    const ema21 = EMA.calculate({ period: 21, values: closes });
    const ema50 = EMA.calculate({ period: 50, values: closes });
    const ema200 = EMA.calculate({ period: 200, values: closes });

    // RSI (Filter)
    const rsi14 = RSI.calculate({ period: 14, values: closes });

    // VWAP - Using Anchored Version
    const vwap = calculateAnchoredVWAP(data, vwapAnchor);

    // MACD (12, 26, 9)
    const macdInput = {
        values: closes,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false
    };
    const macd = MACD.calculate(macdInput);

    // Bollinger Bands (20, 2)
    const bbInput = {
        period: 20,
        values: closes,
        stdDev: 2
    };
    const bb = BollingerBands.calculate(bbInput);

    // Initial Mapping
    const results: IndicatorData[] = data.map((d, i) => {
        const getVal = (arr: any[], idx: number, offset: number) => {
            const arrIndex = idx - offset;
            if (arrIndex < 0 || arrIndex >= arr.length) return undefined;
            return arr[arrIndex];
        };

        return {
            ...d,
            ema9: getVal(ema9, i, 8),
            ema21: getVal(ema21, i, 20),
            ema50: getVal(ema50, i, 49),
            ema200: getVal(ema200, i, 199),
            rsi14: getVal(rsi14, i, 14),
            vwap: getVal(vwap, i, 0),
            macd: getVal(macd, i, 25),
            bollinger: (() => {
                const b = getVal(bb, i, 19);
                if (!b) return undefined;
                return {
                    ...b,
                    pb: b.upper !== b.lower ? (d.close - b.lower) / (b.upper - b.lower) : 0.5
                };
            })()
        };
    });

    // -------------------------------------------------------------------------
    // 2. ATR CALCULATION (Current Timeframe)
    // -------------------------------------------------------------------------
    // Calculate True Range
    const trs = results.map((d, i) => {
        if (i === 0) return d.high - d.low;
        const prevClose = results[i - 1].close;
        return Math.max(d.high - d.low, Math.abs(d.high - prevClose), Math.abs(d.low - prevClose));
    });

    // Calculate ATR 14
    const atrs: number[] = [];
    for (let i = 0; i < trs.length; i++) {
        if (i < 13) {
            atrs.push(0);
            continue;
        }
        const sum = trs.slice(i - 13, i + 1).reduce((a, b) => a + b, 0);
        atrs.push(sum / 14);
    }

    // -------------------------------------------------------------------------
    // 3. ADX CALCULATION
    // -------------------------------------------------------------------------
    const adxInput = {
        high: highs,
        low: lows,
        close: closes,
        period: 14
    };
    const adx = ADX.calculate(adxInput);

    let activeFvg: { type: 'BULLISH' | 'BEARISH' | 'NONE'; gapLow: number; gapHigh: number } = { type: 'NONE', gapLow: 0, gapHigh: 0 };

    results.forEach((d, i) => {
        d.atr14 = atrs[i];
        // ADX result is an object { adx: number, pdi: number, mdi: number }
        // We need to handle the offset (usually period * 2 or similar depending on library)
        // For technicalindicators, result array length is usually len - period + 1
        // Let's safe map it
        const adxVal = i >= (14) ? adx[i - 14] : undefined;
        d.adx14 = adxVal?.adx;

        // -------------------------------------------------------------------------
        // 4. FAIR VALUE GAP (FVG) DETECTION & TRACKING
        // -------------------------------------------------------------------------
        if (i >= 2) {
            const c1 = results[i - 2];
            const c3 = results[i];

            // A. Detect NEW FVG
            if (c3.low > c1.high) {
                activeFvg = { type: 'BULLISH', gapLow: c1.high, gapHigh: c3.low };
            } else if (c3.high < c1.low) {
                activeFvg = { type: 'BEARISH', gapLow: c3.high, gapHigh: c1.low };
            }

            // B. Check if price "FILLED" the active FVG
            if (activeFvg.type === 'BULLISH' && d.low <= activeFvg.gapLow) {
                activeFvg = { type: 'NONE', gapLow: 0, gapHigh: 0 };
            } else if (activeFvg.type === 'BEARISH' && d.high >= activeFvg.gapHigh) {
                activeFvg = { type: 'NONE', gapLow: 0, gapHigh: 0 };
            }

            d.fvg = { ...activeFvg };
        } else {
            d.fvg = { type: 'NONE', gapLow: 0, gapHigh: 0 };
        }
    });

    return results;
};

/**
 * Unified Technical Confluence Scorer
 * Synchronizes logic between Scanners and Deep Dive
 */
export interface ConfluenceResult {
    bullScore: number;
    bearScore: number;
    bullSignals: string[];
    bearSignals: string[];
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    strength: number; // 0-100 normalized tech score
}

export function calculateConfluenceScore(latest: IndicatorData): ConfluenceResult {
    let bullScore = 0;
    let bearScore = 0;
    const bullSignals: string[] = [];
    const bearSignals: string[] = [];

    const price = latest.close;
    const rsi = latest.rsi14 || 50;
    const ema9 = latest.ema9;
    const ema21 = latest.ema21;
    const ema50 = latest.ema50;
    const ema200 = latest.ema200;

    // 1. EMA STACK CORE (The Foundation)
    if (ema50) {
        if (price > ema50) {
            bullScore += 15;
            bullSignals.push('Price > EMA50');
        } else {
            bearScore += 15;
            bearSignals.push('Price < EMA50');
        }
    }

    if (ema200) {
        if (price > ema200) {
            bullScore += 5;
            bullSignals.push('Price > EMA200');
        } else {
            bearScore += 5;
            bearSignals.push('Price < EMA200');
        }
    }

    if (ema9 && ema21 && ema50) {
        if (ema9 > ema21 && ema21 > ema50) {
            bullScore += 10;
            bullSignals.push('EMA Stack Bullish (Short > Mid > Long)');
        } else if (ema9 < ema21 && ema21 < ema50) {
            bearScore += 10;
            bearSignals.push('EMA Stack Bearish (Short < Mid < Long)');
        }
    }

    // 2. MOMENTUM (RSI)
    if (rsi > 60 && rsi <= 70) {
        bullScore += 5;
        bullSignals.push('Strong Bullish Momentum');
    } else if (rsi >= 30 && rsi < 40) {
        bearScore += 5;
        bearSignals.push('Developing Bearish Momentum');
    } else if (rsi < 30) {
        bullScore += 10;
        bullSignals.push('RSI Oversold ⚠️');
    } else if (rsi > 80) {
        bearScore += 10;
        bearSignals.push('RSI Overbought ⚠️');
    }

    // 3. TREND CONFIRMATION (MACD)
    if (latest.macd && latest.macd.MACD !== undefined && latest.macd.signal !== undefined) {
        if (latest.macd.MACD > latest.macd.signal) {
            bullScore += 10;
            bullSignals.push('MACD Bullish Cross');
        } else {
            bearScore += 10;
            bearSignals.push('MACD Bearish Cross');
        }
    }

    // 4. VOLATILITY BANDS (Bollinger)
    if (latest.bollinger && latest.bollinger.pb !== undefined) {
        const pb = latest.bollinger.pb;
        if (pb < 0) {
            bullScore += 10;
            bullSignals.push('Bollinger Breakout (Overextended Down)');
        } else if (pb > 1) {
            bearScore += 10;
            bearSignals.push('Bollinger Breakout (Overextended Up)');
        } else if (pb < 0.2) {
            bullScore += 5;
            bullSignals.push('Price at Lower BB (Support)');
        } else if (pb > 0.8) {
            bearScore += 5;
            bearSignals.push('Price at Upper BB (Resistance)');
        } else if (latest.bollinger.middle && price > latest.bollinger.middle && pb < 0.8) {
            bullScore += 5;
            bullSignals.push('Bollinger Uptrend');
        } else if (latest.bollinger.middle && price < latest.bollinger.middle && pb > 0.2) {
            bearScore += 5;
            bearSignals.push('Bollinger Downtrend');
        }
    }

    // FINAL CALCULATIONS
    const isBull = bullScore > bearScore && bullScore >= 15;
    const isBear = bearScore > bullScore && bearScore >= 15;

    // Normalized Tech Strength (0-100)
    // Starting at 50, adding spread weight
    const rawSpread = Math.abs(bullScore - bearScore);
    let strength = 50;
    if (bullScore > bearScore) {
        strength = Math.min(100, 50 + (rawSpread * 0.8));
    } else if (bearScore > bullScore) {
        strength = Math.max(0, 50 - (rawSpread * 0.8));
    }

    return {
        bullScore,
        bearScore,
        bullSignals,
        bearSignals,
        trend: isBull ? 'BULLISH' : (isBear ? 'BEARISH' : 'NEUTRAL'),
        strength
    };
}
