import { fetchAlpacaBars } from './alpaca';
import { calculateIndicators } from './indicators';
import { getNewsData } from './news-service';
import { calculateSentimentScore } from './news';
import { publicClient } from './public-api';
import { schwabClient } from './schwab';
import { calculateVolatilityProxy, getNextMonthlyExpiry } from './options';
import { ConvictionStock } from '../types/stock';
import { OptionRecommendation } from '../types/options';

export interface DayDreamPick {
    symbol: string;
    direction: 'CALL' | 'PUT';
    confidence: number;
    reason: string;
    options: OptionRecommendation[];
    technicalScore: number;
    sentimentScore: number;
    socialScore: number;
}

const INDICES = ['SPY', 'QQQ', 'IWM'];

export async function getDayDreamPicks(): Promise<DayDreamPick[]> {
    const results: DayDreamPick[] = [];

    for (const symbol of INDICES) {
        try {
            console.log(`[DayDream] 🔍 Processing ${symbol}...`);

            // 1. Fetch Technicals
            const bars = await fetchAlpacaBars(symbol, '1Day', 200);
            console.log(`[DayDream] 📊 ${symbol} fetched ${bars?.length || 0} bars`);
            if (!bars || bars.length < 50) {
                console.warn(`[DayDream] ⚠️ Not enough bars for ${symbol}`);
                continue;
            }

            const cleanData = bars.map(b => ({
                time: new Date(b.t).getTime(),
                open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v
            }));
            const currentPrice = cleanData[cleanData.length - 1].close;
            const indicators = calculateIndicators(cleanData);
            const latest = indicators[indicators.length - 1];
            console.log(`[DayDream] 📈 ${symbol} latest price: ${currentPrice}, RSI: ${latest?.rsi14}`);

            // Technical Score
            let techScore = 50;
            const rsi = latest.rsi14 || 50;
            const isAboveEma50 = latest.close > (latest.ema50 || 0);
            const isAboveEma200 = latest.close > (latest.ema200 || 0);

            if (isAboveEma50) techScore += 15;
            if (isAboveEma200) techScore += 10;
            if (rsi > 40 && rsi < 60) techScore += 10;

            // 2. Fetch News/Social
            const [news, social] = await Promise.all([
                getNewsData(symbol, 'news'),
                getNewsData(symbol, 'social')
            ]);
            const newsSentiment = calculateSentimentScore(news);
            const socialSentiment = calculateSentimentScore(social);

            // 3. Direction
            const totalScore = (techScore * 0.4) + (newsSentiment.score * 0.3) + (socialSentiment.score * 0.3);
            const direction = totalScore > 50 ? 'CALL' : 'PUT';

            // 4. Expiry Selection — Schwab chain includes expirations, use that first
            let expirations: string[] = [];
            let chain: any = null;

            if (schwabClient.isConfigured()) {
                chain = await schwabClient.getOptionChainNormalized(symbol);
                if (chain) expirations = chain.expirations;
            }
            if (expirations.length === 0) {
                expirations = await publicClient.getOptionExpirations(symbol) || [];
            }
            if (expirations.length === 0) {
                console.warn(`[DayDream] ❌ No expirations found for ${symbol}`);
                continue;
            }

            const target = Date.now() + (30 * 24 * 60 * 60 * 1000);
            const expiry = [...expirations].sort((a, b) =>
                Math.abs(new Date(a).getTime() - target) - Math.abs(new Date(b).getTime() - target)
            )[0];

            console.log(`[DayDream] 📅 ${symbol} Target Expiry: ${expiry}`);

            // 5. Fetch Full Chain for THIS Expiry — reuse Schwab chain if already fetched, else fallback
            if (!chain) {
                chain = await publicClient.getOptionChain(symbol, expiry);
            }
            const candidates: OptionRecommendation[] = [];
            const strikes = chain?.options?.[expiry];

            if (strikes) {
                // Focus on strikes near current price
                const strikeKeys = Object.keys(strikes)
                    .map(s => parseFloat(s))
                    .sort((a, b) => Math.abs(a - currentPrice) - Math.abs(b - currentPrice))
                    .slice(0, 15); // Top 15 strikes near ATM

                console.log(`[DayDream] ⛓️ ${symbol} processing ${strikeKeys.length} nearby strikes`);

                const optionSymbolsToFetch: string[] = [];
                const tempCandidates: any[] = [];

                for (const strikePrice of strikeKeys) {
                    const data = strikes[strikePrice];
                    const opt = direction === 'CALL' ? data.call : data.put;

                    if (!opt) continue;
                    if (opt.volume < 1 && opt.openInterest < 10) continue;

                    optionSymbolsToFetch.push(opt.symbol);
                    tempCandidates.push({
                        type: direction,
                        strike: strikePrice,
                        expiry,
                        contractPrice: (opt.bid + opt.ask) / 2 || opt.last,
                        volume: opt.volume,
                        openInterest: opt.openInterest,
                        symbol: opt.symbol,
                        strategy: "Golden Strike"
                    });
                }

                // Batch Fetch Greeks
                if (optionSymbolsToFetch.length > 0) {
                    console.log(`[DayDream] 🇬🇷 Fetching greeks for ${optionSymbolsToFetch.length} symbols...`);
                    for (const cand of tempCandidates) {
                        try {
                            const greeks = await publicClient.getGreeks(cand.symbol);
                            if (greeks) {
                                const delta = Math.abs(greeks.delta);
                                if (delta >= 0.20 && delta <= 0.80) {
                                    candidates.push({
                                        ...cand,
                                        confidence: Math.round(totalScore),
                                        reason: `Delta ${delta.toFixed(2)} | Vol/OI: ${(cand.openInterest > 0 ? cand.volume / cand.openInterest : 0).toFixed(1)}x`,
                                        probabilityITM: delta,
                                        iv: greeks.impliedVolatility
                                    } as any);
                                }
                            }
                            // Small delay to prevent 403
                            await new Promise(r => setTimeout(r, 200));
                        } catch (e) {
                            console.error(`[DayDream] Greek error for ${cand.symbol}:`, e);
                        }
                    }
                }

                console.log(`[DayDream] 🎯 ${symbol} found ${candidates.length} candidate options`);

                const topOptions = candidates
                    .sort((a, b) => ((b.volume || 0) + (b.openInterest || 0)) - ((a.volume || 0) + (a.openInterest || 0)))
                    .slice(0, 3);

                results.push({
                    symbol,
                    direction,
                    confidence: Math.round(totalScore),
                    reason: `${direction} Bias: Tech (${techScore}) + News/Social (${Math.round((newsSentiment.score + socialSentiment.score) / 2)})`,
                    options: topOptions,
                    technicalScore: techScore,
                    sentimentScore: newsSentiment.score,
                    socialScore: socialSentiment.score
                });
            }

        } catch (e) {
            console.error(`[DayDream] Error for ${symbol}:`, e);
        }
    }

    return results;
}
