import { OHLCVData, IndicatorData, ConfluenceResult, MultiTimeframeConfluenceResult } from '../types/financial';
import { EMA, RSI, MACD, BollingerBands, ADX } from 'technicalindicators';

// @ts-ignore
import { bullish } from 'technicalindicators/lib/candlestick/Bullish';
// @ts-ignore
import { bearish } from 'technicalindicators/lib/candlestick/Bearish';
// @ts-ignore
import { doji } from 'technicalindicators/lib/candlestick/Doji';
// @ts-ignore
import { hammerpattern } from 'technicalindicators/lib/candlestick/HammerPattern';
// @ts-ignore
import { shootingstar } from 'technicalindicators/lib/candlestick/ShootingStar';
// @ts-ignore
import { bullishengulfingpattern } from 'technicalindicators/lib/candlestick/BullishEngulfingPattern';
// @ts-ignore
import { bearishengulfingpattern } from 'technicalindicators/lib/candlestick/BearishEngulfingPattern';
// @ts-ignore
import { morningstar } from 'technicalindicators/lib/candlestick/MorningStar';
// @ts-ignore
import { eveningstar } from 'technicalindicators/lib/candlestick/EveningStar';
// @ts-ignore
import { piercingline } from 'technicalindicators/lib/candlestick/PiercingLine';
// @ts-ignore
import { darkcloudcover } from 'technicalindicators/lib/candlestick/DarkCloudCover';

import { calculateAnchoredVWAP, VWAPAnchor } from './vwap'; export const calculateIndicators = (data: OHLCVData[], vwapAnchor: VWAPAnchor = 'none'): IndicatorData[] => {
    // Extract arrays for technicalindicators
    const closes = data.map(d => d.close);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const volumes = data.map(d => d.volume);

    // -------------------------------------------------------------------------
    // 1. STANDARD INDICATORS
    // -------------------------------------------------------------------------
    const ema9 = EMA.calculate({ period: 9, values: closes });
    const ema20 = EMA.calculate({ period: 20, values: closes });
    const ema21 = EMA.calculate({ period: 21, values: closes });
    const ema50 = EMA.calculate({ period: 50, values: closes });
    const ema100 = EMA.calculate({ period: 100, values: closes });
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
            ema100: getVal(ema100, i, 99),
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
        // ADX(14) in technicalindicators needs 14 (DM) + 14 (smoothing) = 28 bars for the first valid result at index 27
        const adxVal = i >= 27 ? adx[i - 27] : undefined;
        d.adx14 = adxVal?.adx;

        // ── Keltner Channels & Volatility Squeeze ──
        const ema20Index = i - 19;
        const ema20Val = (ema20Index >= 0 && ema20Index < ema20.length) ? ema20[ema20Index] : undefined;
        const atr = atrs[i];
        if (ema20Val !== undefined && atr !== undefined && atr > 0) {
            const keltnerUpper = ema20Val + 2 * atr;
            const keltnerLower = ema20Val - 2 * atr;
            
            d.keltner = {
                middle: ema20Val,
                upper: keltnerUpper,
                lower: keltnerLower
            };

            if (d.bollinger && d.bollinger.upper !== undefined && d.bollinger.lower !== undefined) {
                d.squeeze = d.bollinger.upper < keltnerUpper && d.bollinger.lower > keltnerLower;
            }
        }

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
        // -------------------------------------------------------------------------
        // 5. CANDLESTICK PATTERN DETECTION
        // -------------------------------------------------------------------------
        // We need previous candles for most patterns
        // Some require 1, 2, 3 or more candles. We'll pass slices of the arrays

        let patternName: NonNullable<IndicatorData['pattern']>['name'] = 'None';
        let patternSignal: NonNullable<IndicatorData['pattern']>['signal'] = 'neutral';

        if (i >= 4) { // Need at least 5 candles for some patterns to be reliable
            const sliceStart = i - 4;
            const sliceEnd = i + 1; // slice is exclusive of end

            const pInput = {
                open: data.slice(sliceStart, sliceEnd).map(c => c.open),
                high: data.slice(sliceStart, sliceEnd).map(c => c.high),
                low: data.slice(sliceStart, sliceEnd).map(c => c.low),
                close: data.slice(sliceStart, sliceEnd).map(c => c.close),
            };

            // Evaluate patterns in reverse order of significance/complexity (most complex first)

            // 3-Candle Patterns
            if (morningstar(pInput)) {
                patternName = 'Morning Star';
                patternSignal = 'bullish';
            } else if (eveningstar(pInput)) {
                patternName = 'Evening Star';
                patternSignal = 'bearish';
            }
            // 2-Candle Patterns
            else if (bullishengulfingpattern(pInput)) {
                patternName = 'Bullish Engulfing';
                patternSignal = 'bullish';
            } else if (bearishengulfingpattern(pInput)) {
                patternName = 'Bearish Engulfing';
                patternSignal = 'bearish';
            } else if (piercingline(pInput)) {
                patternName = 'Piercing Line';
                patternSignal = 'bullish';
            } else if (darkcloudcover(pInput)) {
                patternName = 'Dark Cloud Cover';
                patternSignal = 'bearish';
            }
            // 1-Candle Patterns
            else if (hammerpattern(pInput)) {
                patternName = 'Hammer';
                patternSignal = 'bullish';
            } else if (shootingstar(pInput)) {
                patternName = 'Shooting Star';
                patternSignal = 'bearish';
            } else if (doji(pInput)) {
                patternName = 'Doji';
                patternSignal = 'neutral';
            }
        }

        d.pattern = { name: patternName, signal: patternSignal };
        
        // -------------------------------------------------------------------------
        // 6. RSI DIVERGENCE DETECTION
        // -------------------------------------------------------------------------
        d.divergence = { type: 'NONE' };
        if (i >= 20) {
            const window = results.slice(i - 20, i + 1);
            const rsiWindow = window.map(w => w.rsi14).filter((r): r is number => r !== undefined);
            const priceWindow = window.map(w => w.close);

            if (rsiWindow.length >= 15) {
                // Audit fix #6: divergence is the highest-weighted confluence signal
                // (was +20, now +12 below — see calculateConfluenceScore) but used to
                // fire off any 3-bar local extrema with no minimum-significance check,
                // so it could trigger on noise-level wiggles in choppy tape. Require a
                // real lower-low/higher-high (≥1.5% price move) AND a real RSI gap
                // (≥3 points) between the two compared extrema before counting it.
                const MIN_PRICE_MOVE_PCT = 0.015;
                const MIN_RSI_MOVE = 3;

                // Bullish Divergence: Lower Low in Price, Higher Low in RSI
                // Find local lows in price
                const getLows = (arr: number[]) => {
                    const lows: number[] = [];
                    for (let j = 1; j < arr.length - 1; j++) {
                        if (arr[j] < arr[j-1] && arr[j] < arr[j+1]) lows.push(j);
                    }
                    return lows;
                };
                
                // Find local highs in price
                const getHighs = (arr: number[]) => {
                    const highs: number[] = [];
                    for (let j = 1; j < arr.length - 1; j++) {
                        if (arr[j] > arr[j-1] && arr[j] > arr[j+1]) highs.push(j);
                    }
                    return highs;
                };

                const priceLows = getLows(priceWindow);
                if (priceLows.length >= 2) {
                    const lastLowIdx = priceLows[priceLows.length - 1];
                    const prevLowIdx = priceLows[priceLows.length - 2];
                    
                    const lastPrice = priceWindow[lastLowIdx];
                    const prevPrice = priceWindow[prevLowIdx];
                    const lastRsi = window[lastLowIdx].rsi14;
                    const prevRsi = window[prevLowIdx].rsi14;

                    if (lastRsi !== undefined && prevRsi !== undefined) {
                        const priceMovePct = prevPrice > 0 ? (prevPrice - lastPrice) / prevPrice : 0;
                        if (lastPrice < prevPrice && lastRsi > prevRsi && lastRsi < 40
                            && priceMovePct >= MIN_PRICE_MOVE_PCT && (lastRsi - prevRsi) >= MIN_RSI_MOVE) {
                            d.divergence = { type: 'BULLISH', price: lastPrice, rsi: lastRsi };
                        }
                    }
                }

                const priceHighs = getHighs(priceWindow);
                if (priceHighs.length >= 2) {
                    const lastHighIdx = priceHighs[priceHighs.length - 1];
                    const prevHighIdx = priceHighs[priceHighs.length - 2];
                    
                    const lastPrice = priceWindow[lastHighIdx];
                    const prevPrice = priceWindow[prevHighIdx];
                    const lastRsi = window[lastHighIdx].rsi14;
                    const prevRsi = window[prevHighIdx].rsi14;

                    if (lastRsi !== undefined && prevRsi !== undefined) {
                        const priceMovePct = prevPrice > 0 ? (lastPrice - prevPrice) / prevPrice : 0;
                        if (lastPrice > prevPrice && lastRsi < prevRsi && lastRsi > 60
                            && priceMovePct >= MIN_PRICE_MOVE_PCT && (prevRsi - lastRsi) >= MIN_RSI_MOVE) {
                            d.divergence = { type: 'BEARISH', price: lastPrice, rsi: lastRsi };
                        }
                    }
                }
            }
        }
    });

    return results;
};

/**
 * Unified Technical Confluence Scorer
 * Synchronizes logic between Scanners and Deep Dive
 */

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
    // Audit fix #6: RSI<30/RSI>80 used to cast a directional vote here (oversold=
    // bearish, overbought=bullish — a "momentum keeps running" stance) while
    // conviction.ts separately applies a -10 penalty when rsi>80 (an "overbought
    // is a risk to chase" stance) — two parts of the pipeline encoding opposite
    // theses on the same condition that partially canceled rather than reflecting
    // one coherent view. calculateMultiTimeframeConfluence() below already treats
    // RSI extremes the same way conviction.ts does — as an entry-timing risk
    // (`rsiOverextended`), not a trend signal — so extreme RSI no longer votes
    // bull/bear here; conviction.ts's overbought penalty remains the single,
    // intentional place that flags it.
    if (rsi > 60 && rsi <= 70) {
        bullScore += 5;
        bullSignals.push('Strong Bullish Momentum');
    } else if (rsi >= 30 && rsi < 40) {
        bearScore += 5;
        bearSignals.push('Developing Bearish Momentum');
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

    // 4. RSI DIVERGENCE (High Conviction)
    // Audit fix #6: was +20 (more than double any other single factor) on top of a
    // detector with no minimum-significance filter, so a noise-driven false
    // positive could swing the score more than any other signal. The detector
    // itself is now filtered (see the 1.5%-price / 3-point-RSI gates in the
    // divergence-detection block above); the weight is down to +12 so a genuine
    // divergence still meaningfully outranks MACD/Bollinger/pattern (10 each)
    // without dominating the whole confluence score on its own.
    if (latest.divergence && latest.divergence.type !== 'NONE') {
        if (latest.divergence.type === 'BULLISH') {
            bullScore += 12;
            bullSignals.push('RSI Bullish Divergence 🎯');
        } else if (latest.divergence.type === 'BEARISH') {
            bearScore += 12;
            bearSignals.push('RSI Bearish Divergence 🎯');
        }
    }

    // 5. VOLATILITY BANDS (Bollinger)
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

    // 5. CANDLESTICK PATTERN CONFIRMATION
    if (latest.pattern && latest.pattern.name !== 'None') {
        if (latest.pattern.signal === 'bullish') {
            bullScore += 10;
            bullSignals.push(`Pattern: ${latest.pattern.name} (Bullish)`);
        } else if (latest.pattern.signal === 'bearish') {
            bearScore += 10;
            bearSignals.push(`Pattern: ${latest.pattern.name} (Bearish)`);
        } else {
            // Doji
            if (latest.pattern.name === 'Doji') {
                if (rsi > 65) {
                    // Doji at top
                    bearScore += 5;
                    bearSignals.push('Doji at highs (Potential Reversal Bearish)');
                } else if (rsi < 35) {
                    // Doji at bottom
                    bullScore += 5;
                    bullSignals.push('Doji at lows (Potential Reversal Bullish)');
                } else {
                    bullSignals.push('Pattern: Doji (Indecision)');
                }
            }
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

/**
 * Calculates a unified score across 1h, 1d, and 1w timeframes.
 * Weights: 1d (50%), 1w (30%), 1h (20%)
 */
export function calculateMultiTimeframeConfluence(timeframes: IndicatorData[]): MultiTimeframeConfluenceResult {
    const results: { [key: string]: ConfluenceResult } = {};
    const tfMap: { [key: string]: IndicatorData } = {};

    timeframes.forEach(tf => {
        if (tf.timeframe) {
            tfMap[tf.timeframe] = tf;
            results[tf.timeframe] = calculateConfluenceScore(tf);
        }
    });

    const h1 = results['1h'] || { strength: 50, trend: 'NEUTRAL', bullSignals: [], bearSignals: [] };
    const d1 = results['1d'] || { strength: 50, trend: 'NEUTRAL', bullSignals: [], bearSignals: [] };
    const w1 = results['1w'] || { strength: 50, trend: 'NEUTRAL', bullSignals: [], bearSignals: [] };

    // Weighted Score (normalized to 0-100 where 50 is neutral)
    const totalScore = (d1.strength * 0.5) + (w1.strength * 0.3) + (h1.strength * 0.2);

    const reasons: string[] = [];
    
    const addReason = (tf: string, res: ConfluenceResult) => {
        const trendLabel = res.trend === 'BULLISH' ? 'Bullish' : res.trend === 'BEARISH' ? 'Bearish' : 'Neutral';
        const weight = tf === '1d' ? '50%' : tf === '1w' ? '30%' : '20%';
        reasons.push(`${tf.toUpperCase()} Timeframe is ${trendLabel} (${weight} weight)`);
    };

    addReason('1w', w1 as ConfluenceResult);
    addReason('1d', d1 as ConfluenceResult);
    addReason('1h', h1 as ConfluenceResult);

    // Summary logic
    let finalTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (totalScore > 65) finalTrend = 'BULLISH';
    else if (totalScore < 35) finalTrend = 'BEARISH';

    // Execution Action logic
    let executionAction: 'BUY' | 'WAIT' = 'WAIT';
    const executionReasons: string[] = [];

    const isStrongBull = totalScore > 70;
    const isStrongBear = totalScore < 30;
    const isAgree1d = (finalTrend === 'BULLISH' && d1.trend === 'BULLISH') || (finalTrend === 'BEARISH' && d1.trend === 'BEARISH');
    const isAgree1w = (finalTrend === 'BULLISH' && w1.trend !== 'BEARISH') || (finalTrend === 'BEARISH' && w1.trend !== 'BULLISH');
    
    // Check RSI extremes from 1d data if available
    const rsi1d = tfMap['1d']?.rsi14 || 50;
    const rsiOverextended = (finalTrend === 'BULLISH' && rsi1d > 75) || (finalTrend === 'BEARISH' && rsi1d < 25);

    if (finalTrend !== 'NEUTRAL' && (isStrongBull || isStrongBear) && isAgree1d && isAgree1w && !rsiOverextended) {
        executionAction = 'BUY';
        executionReasons.push(`High conviction ${finalTrend.toLowerCase()} alignment across Daily and Weekly.`);
        executionReasons.push(`Volume and Momentum are in synchronization.`);
        executionReasons.push(`Market structure supports immediate entry.`);
    } else {
        executionAction = 'WAIT';
        if (finalTrend === 'NEUTRAL') {
            executionReasons.push("Market is currently in an indecision phase; wait for a clear directional breakout.");
        } else {
            if (rsiOverextended) executionReasons.push("Price is currently overextended; wait for a mean reversion or pullback.");
            if (!isAgree1d) executionReasons.push("Daily trend is not yet fully aligned; wait for price to clear key EMA levels.");
            if (!isAgree1w) executionReasons.push("Weekly macro trend is opposing; wait for higher-timeframe trend shift.");
            if (!isStrongBull && !isStrongBear) executionReasons.push("Confluence score is below high-conviction entry threshold (70%).");
        }
    }

    return {
        score: Math.round(totalScore),
        trend: finalTrend,
        reasons,
        executionAction,
        executionReasons,
        timeframeDetails: {
            '1h': { score: h1.strength, trend: h1.trend, signals: h1.trend === 'BULLISH' ? h1.bullSignals : h1.bearSignals },
            '1d': { score: d1.strength, trend: d1.trend, signals: d1.trend === 'BULLISH' ? d1.bullSignals : d1.bearSignals },
            '1w': { score: w1.strength, trend: w1.trend, signals: w1.trend === 'BULLISH' ? w1.bullSignals : w1.bearSignals },
        }
    };
}
