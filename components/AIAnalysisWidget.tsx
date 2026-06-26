"use client";

import React from "react";
import { Activity, Target, Zap, Clock, Sparkles } from "lucide-react";
import { MultiTimeframeAnalysis } from "@/lib/market-data";
import { UnusualOption } from "@/lib/options-flow";

export interface Fundamentals {
    marketCap?: number;
    peRatio?: number;
    forwardPE?: number;
    beta?: number;
    dividendYield?: number;
    targetMeanPrice?: number;
    recommendationKey?: string;
    obs?: number; // numberOfAnalystOpinions
}

interface AIAnalysisWidgetProps {
    symbol: string;
    analysis: MultiTimeframeAnalysis;
    optionsFlow: UnusualOption[];
    fundamentals: Fundamentals;
}

export default function AIAnalysisWidget({ symbol, analysis, optionsFlow, fundamentals }: AIAnalysisWidgetProps) {
    const { 
        signal, 
        score, 
        executionAction, 
        entryPrice, 
        entryReason, 
        techDetails,
        regime,
        stopLoss,
        targetPrice,
        rrRatio,
        optionStrategy
    } = generateSignal(symbol, analysis, optionsFlow, fundamentals);

    const isBullish = score >= 6.5;
    const isBearish = score <= 4;
    const scoreColor = isBullish ? "text-[#00FF94]" : isBearish ? "text-[#FF2E2E]" : "text-[#FFB800]";
    const borderColor = isBullish ? "border-[#00FF94]/20" : isBearish ? "border-[#FF2E2E]/20" : "border-[#FFB800]/20";
    const bgGlow = isBullish ? "shadow-[0_0_40px_-15px_rgba(0,255,148,0.15)]" : isBearish ? "shadow-[0_0_40px_-15px_rgba(255,46,46,0.15)]" : "";

    return (
        <div className={`relative bg-[#0B0F17]/90 backdrop-blur-3xl rounded-3xl border ${borderColor} p-6 lg:p-8 ${bgGlow} transition-all duration-1000 overflow-hidden`}>
            {/* Carbon Fiber Background Texture */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
            
            <div className="relative z-10 flex flex-col lg:grid lg:grid-cols-12 gap-8">
                
                {/* LEFT COLUMN: PRIMARY SIGNAL & EXECUTION (4/12) */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                    {/* Header Row */}
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                                <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                            </div>
                            <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Live AI Assessment</h3>
                        </div>
                        <span className="text-[9px] font-black px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 uppercase tracking-widest">
                            {regime}
                        </span>
                    </div>

                    {/* AI SIGNAL CARD */}
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/5 flex flex-col items-center text-center shadow-2xl relative group overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>
                        <div className="text-[10px] font-black text-white/30 uppercase tracking-[0.25em] mb-4 relative z-10">AI Terminal Signal</div>
                        {/* SMALLER SIGNAL TEXT AS REQUESTED */}
                        <div className={`text-xl font-black ${scoreColor} tracking-widest mb-1 relative z-10 uppercase`}>
                            {signal}
                        </div>
                        <div className="text-6xl font-black text-white tracking-tighter relative z-10">
                            {score}<span className="text-xl text-white/20 font-bold ml-1">/10</span>
                        </div>
                    </div>

                    {/* EXECUTION STRATEGY */}
                    <div className={`p-6 rounded-2xl border flex flex-col gap-4 shadow-2xl ${
                        executionAction === 'BUY' ? 'bg-[#00FF94]/5 border-[#00FF94]/20' : 
                        executionAction === 'SELL' ? 'bg-[#FF2E2E]/5 border-[#FF2E2E]/20' : 
                        'bg-[#FFB800]/5 border-[#FFB800]/20'
                    }`}>
                        <div className="flex items-center gap-2">
                            <Clock className={`w-4 h-4 ${
                                executionAction === 'BUY' ? 'text-[#00FF94]' : 
                                executionAction === 'SELL' ? 'text-[#FF2E2E]' : 
                                'text-[#FFB800]'
                            }`} />
                            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Execution Strategy</span>
                        </div>
                        <div className={`text-xl font-black ${
                            executionAction === 'BUY' ? 'text-[#00FF94]' : 
                            executionAction === 'SELL' ? 'text-[#FF2E2E]' : 
                            'text-[#FFB800]'
                        }`}>
                            {executionAction === 'BUY' ? 'BUY / ENTER NOW' : 
                             executionAction === 'SELL' ? 'SELL / SHORT NOW' : 
                             'WAIT FOR SETUP'}
                        </div>
                        
                        {/* R:R Details & Options Strategy */}
                        <div className="text-[11px] font-bold text-white/80 leading-relaxed bg-black/40 p-3.5 rounded-xl border border-white/5 backdrop-blur-sm space-y-2">
                            {executionAction !== 'WAIT' ? (
                                <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 text-[10px]">
                                    <div>Entry Zone: <span className="text-white font-black">${entryPrice.toFixed(2)}</span></div>
                                    <div>R:R Ratio: <span className={`${executionAction === 'BUY' ? 'text-[#00FF94]' : 'text-[#FF2E2E]'} font-black`}>{rrRatio.toFixed(1)}:1</span></div>
                                    <div>Target Price: <span className="text-white font-black">${targetPrice.toFixed(2)}</span></div>
                                    <div>Stop Loss: <span className="text-white/60 font-black">${stopLoss.toFixed(2)}</span></div>
                                </div>
                            ) : (
                                <div className="text-[10px] text-white/60">
                                    No optimal risk-to-reward ratio entry zone identified. Await reversal signals.
                                </div>
                            )}
                            <div className="pt-2 border-t border-white/5 mt-2">
                                <div className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-0.5">Optimal Options Play</div>
                                <span className={`text-[10.5px] font-black uppercase ${
                                    executionAction === 'BUY' ? 'text-[#00FF94]' : 
                                    executionAction === 'SELL' ? 'text-[#FF2E2E]' : 
                                    'text-indigo-400'
                                }`}>
                                    {optionStrategy}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* TARGET PRICE */}
                    {fundamentals.targetMeanPrice && (
                        <div className="bg-[#161B22]/50 rounded-2xl p-5 border border-white/5 flex flex-col gap-2 shadow-2xl backdrop-blur-md">
                            <div className="flex items-center gap-2 text-[9px] font-black text-white/30 uppercase tracking-widest">
                                <Target className="w-4 h-4 text-blue-400" /> Analyst Target (Mean)
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-3xl font-black text-white">${fundamentals.targetMeanPrice.toFixed(0)}</span>
                                <div className={`flex flex-col items-end`}>
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${analysis.currentPrice < fundamentals.targetMeanPrice ? "bg-[#00FF94]/10 text-[#00FF94]" : "bg-[#FF2E2E]/10 text-[#FF2E2E]"}`}>
                                        {analysis.currentPrice < fundamentals.targetMeanPrice ? "+" : ""}{((fundamentals.targetMeanPrice - analysis.currentPrice) / analysis.currentPrice * 100).toFixed(1)}% Implied
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN: TECHNICAL CONFLUENCE & ENTRY LOGIC (8/12) */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                    {/* TECHNICAL DETAIL BREAKDOWN */}
                    <div className="bg-white/5 rounded-3xl p-6 lg:p-8 border border-white/5 flex-grow shadow-2xl relative overflow-hidden">
                        <div className="flex items-center gap-3 mb-8">
                            <Activity className="w-5 h-5 text-indigo-400" />
                            <h4 className="text-sm font-black text-white uppercase tracking-widest italic">Technical Confluence Analysis</h4>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                            {/* Left Column: Trend, Gaps, Bias */}
                            <div className="space-y-6">
                                {/* Trend & Moving Averages */}
                                <div className="space-y-4">
                                    <div className="text-[10px] font-black text-white/60 uppercase tracking-[0.25em] flex items-center gap-2">
                                        <div className="w-1 h-1 bg-indigo-500 rounded-full"></div>
                                        Trend & Moving Averages
                                    </div>
                                    <div className="space-y-3.5">
                                        {techDetails.emas.map((point, i) => (
                                            <div key={i} className="flex items-start gap-3 group/item">
                                                <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 shadow-[0_0_8px_rgba(0,0,0,0.5)] ${point.sentiment === 'positive' ? 'bg-[#00FF94]' : point.sentiment === 'negative' ? 'bg-[#FF2E2E]' : 'bg-white/20'}`}></div>
                                                <span className="text-xs text-white/70 font-bold leading-relaxed group-hover/item:text-white transition-colors">{point.text}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Market Gaps (FVG) */}
                                <div className="space-y-4 pt-4 border-t border-white/5">
                                    <div className="text-[10px] font-black text-white/60 uppercase tracking-[0.25em] flex items-center gap-2">
                                        <div className="w-1 h-1 bg-indigo-500 rounded-full"></div>
                                        Market Gaps (FVG)
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${techDetails.fvg.sentiment === 'positive' ? 'bg-[#00FF94]' : techDetails.fvg.sentiment === 'negative' ? 'bg-[#FF2E2E]' : 'bg-white/20'}`}></div>
                                        <span className="text-xs text-white/70 font-bold leading-relaxed">{techDetails.fvg.text}</span>
                                    </div>
                                </div>
                                
                                {/* Institutional Bias */}
                                <div className="space-y-4 pt-4 border-t border-white/5">
                                    <div className="text-[10px] font-black text-white/60 uppercase tracking-[0.25em] flex items-center gap-2">
                                        <div className="w-1 h-1 bg-indigo-500 rounded-full"></div>
                                        Institutional Bias
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${techDetails.options.sentiment === 'positive' ? 'bg-[#00FF94]' : techDetails.options.sentiment === 'negative' ? 'bg-[#FF2E2E]' : 'bg-white/20'}`}></div>
                                        <span className="text-xs text-white/70 font-bold leading-relaxed">{techDetails.options.text}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Momentum, Volatility */}
                            <div className="space-y-6">
                                {/* Momentum (RSI) */}
                                <div className="space-y-4">
                                    <div className="text-[10px] font-black text-white/60 uppercase tracking-[0.25em] flex items-center gap-2">
                                        <div className="w-1 h-1 bg-indigo-500 rounded-full"></div>
                                        Momentum (RSI Matrix)
                                    </div>
                                    <div className="space-y-3.5">
                                        {techDetails.rsi.map((point, i) => (
                                            <div key={i} className="flex items-start gap-3 group/item">
                                                <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 shadow-[0_0_8px_rgba(0,0,0,0.5)] ${point.sentiment === 'positive' ? 'bg-[#00FF94]' : point.sentiment === 'negative' ? 'bg-[#FF2E2E]' : 'bg-[#FFB800]'}`}></div>
                                                <span className="text-xs text-white/70 font-bold leading-relaxed group-hover/item:text-white transition-colors">{point.text}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Volatility (Bollinger) */}
                                <div className="space-y-4 pt-4 border-t border-white/5">
                                    <div className="text-[10px] font-black text-white/60 uppercase tracking-[0.25em] flex items-center gap-2">
                                        <div className="w-1 h-1 bg-indigo-500 rounded-full"></div>
                                        Volatility (Bollinger)
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${techDetails.bb.sentiment === 'positive' ? 'bg-[#00FF94]' : techDetails.bb.sentiment === 'negative' ? 'bg-[#FF2E2E]' : 'bg-white/20'}`}></div>
                                        <span className="text-xs text-white/70 font-bold leading-relaxed">{techDetails.bb.text}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ENTRY PRICE LOGIC EXPLANATION */}
                    <div className={`rounded-3xl p-6 border-l-4 shadow-2xl flex flex-col gap-3 relative overflow-hidden backdrop-blur-md ${isBullish ? 'bg-[#00FF94]/5 border-[#00FF94]/30' : isBearish ? 'bg-[#FF2E2E]/5 border-[#FF2E2E]/30' : 'bg-[#FFB800]/5 border-[#FFB800]/30'}`}>
                        <div className="flex items-center gap-3">
                            <div className={`p-1.5 rounded-lg ${isBullish ? 'bg-[#00FF94]/10' : isBearish ? 'bg-[#FF2E2E]/10' : 'bg-[#FFB800]/10'}`}>
                                <Zap className={`w-4 h-4 ${isBullish ? 'text-[#00FF94]' : isBearish ? 'text-[#FF2E2E]' : 'text-[#FFB800]'}`} />
                            </div>
                            <h4 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Entry Condition & Tactical Strategy</h4>
                        </div>
                        <p className={`text-xs font-bold leading-relaxed italic ${isBullish ? 'text-[#00FF94]/80' : isBearish ? 'text-[#FF2E2E]/80' : 'text-[#FFB800]/80'}`}>
                            "{entryReason}"
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function generateSignal(symbol: string, analysis: MultiTimeframeAnalysis, options: UnusualOption[], fundamentals: Fundamentals) {
    let score = 5.0; // Neutral Start
    
    // Detailed Technical Object
    const techDetails = {
        emas: [] as { text: string, sentiment: 'positive' | 'negative' | 'neutral' }[],
        rsi: [] as { text: string, sentiment: 'positive' | 'negative' | 'neutral' }[],
        bb: { text: '', sentiment: 'neutral' as 'positive' | 'negative' | 'neutral' },
        fvg: { text: 'No significant Fair Value Gaps detected in immediate price action.', sentiment: 'neutral' as 'positive' | 'negative' | 'neutral' },
        options: { text: 'Neutral participation detected in institutional flow.', sentiment: 'neutral' as 'positive' | 'negative' | 'neutral' }
    };

    const daily = analysis.timeframes.find(t => t.timeframe === '1d');
    const price = analysis.currentPrice;

    // 1. Regime Classification
    const adx = daily?.adx || 0;
    const isTrending = adx > 22;
    const regime = isTrending ? "TRENDING (Momentum)" : "MEAN-REVERSION (Range)";

    // 2. Trend Bias
    let bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (daily) {
        const priceAboveEma200 = price > (daily.ema200 || 0);
        const priceAboveEma50 = price > (daily.ema50 || 0);
        const emaCrossBullish = daily.ema9 && daily.ema21 ? daily.ema9 > daily.ema21 : false;

        if (priceAboveEma200 && priceAboveEma50 && emaCrossBullish) {
            bias = 'BULLISH';
        } else if (!priceAboveEma200 && !priceAboveEma50 && !emaCrossBullish) {
            bias = 'BEARISH';
        }
    }

    // 3. EMA ANALYSIS (Analyst Logic)
    if (daily) {
        if (price > daily.ema200!) {
            techDetails.emas.push({ text: "Maintaining long-term bullish structural integrity above the 200-day EMA.", sentiment: 'positive' });
            score += 0.5;
        } else {
            techDetails.emas.push({ text: "Secular bearish regime: Price is suppressed below the 200-day EMA.", sentiment: 'negative' });
            score -= 1.0;
        }

        if (daily.ema50 && price > daily.ema50) {
            techDetails.emas.push({ text: "Intermediate trend is positive with price sustaining levels above the 50-day EMA.", sentiment: 'positive' });
            score += 0.5;
        } else if (daily.ema50) {
            techDetails.emas.push({ text: "50-day EMA is acting as significant overhead resistance, suppressing recovery.", sentiment: 'negative' });
            score -= 0.5;
        }

        if (daily.ema9 && daily.ema21 && daily.ema9 > daily.ema21) {
            techDetails.emas.push({ text: "Short-term momentum acceleration: 9 EMA has crossed the 21 EMA (Bullish Cross).", sentiment: 'positive' });
            score += 0.5;
        } else {
            techDetails.emas.push({ text: "Negative short-term stack: 9 EMA trending below the 21 EMA.", sentiment: 'negative' });
            score -= 0.5;
        }
    }

    // 4. MULTI-TIMEFRAME RSI ANALYSIS (With Trend-Following Override)
    const rsiTimeframes = [
        { label: 'H1', data: analysis.timeframes.find(t => t.timeframe === '1h') },
        { label: 'D1', data: analysis.timeframes.find(t => t.timeframe === '1d') },
        { label: 'W1', data: analysis.timeframes.find(t => t.timeframe === '1w') }
    ];

    rsiTimeframes.forEach(tf => {
        if (tf.data && tf.data.rsi) {
            const rsi = tf.data.rsi;
            if (rsi > 70) {
                if (isTrending && bias === 'BULLISH') {
                    // Trend strength override (RSI staying overbought is a sign of momentum power)
                    techDetails.rsi.push({ text: `${tf.label} RSI Overbought at ${rsi.toFixed(1)} (Strong Momentum; no execution penalty).`, sentiment: 'positive' });
                } else {
                    techDetails.rsi.push({ text: `${tf.label} RSI Overextended at ${rsi.toFixed(1)}, suggesting high exhaustion risk.`, sentiment: 'negative' });
                    score -= tf.label === 'D1' ? 1.0 : 0.5;
                }
            } else if (rsi < 30) {
                if (isTrending && bias === 'BEARISH') {
                    // Trend weakness override (RSI staying oversold is a sign of downward momentum)
                    techDetails.rsi.push({ text: `${tf.label} RSI Oversold at ${rsi.toFixed(1)} (Severe Downtrend; do not buy).`, sentiment: 'negative' });
                } else {
                    techDetails.rsi.push({ text: `${tf.label} RSI Oversold at ${rsi.toFixed(1)}, indicating a potential bottoming process.`, sentiment: 'positive' });
                    score += tf.label === 'D1' ? 1.0 : 0.5;
                }
            } else {
                if (tf.label === 'D1' || techDetails.rsi.length === 0) {
                    techDetails.rsi.push({ text: `${tf.label} RSI Neutral at ${rsi.toFixed(0)}, leaving room for expansion.`, sentiment: 'neutral' });
                }
            }
        }
    });

    // Multi-Timeframe Divergence Bullet Points
    const divTimeframes = [
        { label: 'H1', data: analysis.timeframes.find(t => t.timeframe === '1h') },
        { label: 'D1', data: analysis.timeframes.find(t => t.timeframe === '1d') },
        { label: 'W1', data: analysis.timeframes.find(t => t.timeframe === '1w') }
    ];

    divTimeframes.forEach(tf => {
        if (tf.data?.divergence && tf.data.divergence.type !== 'NONE') {
            const isBull = tf.data.divergence.type === 'BULLISH';
            techDetails.rsi.push({ 
                text: `${tf.label} RSI Divergence: ${tf.data.divergence.type} signal detected. ${isBull ? 'Bullish momentum building.' : 'Bearish divergence suggests waning demand.'}`, 
                sentiment: isBull ? 'positive' : 'negative' 
            });
            score += isBull ? 0.75 : -0.75;
        }
    });

    if (divTimeframes.every(tf => !tf.data?.divergence || tf.data.divergence.type === 'NONE')) {
        techDetails.rsi.push({ text: "Searching H1, D1, & W1 for momentum divergence — None detected in current regime.", sentiment: 'neutral' });
    }

    // 5. BOLLINGER BANDS
    if (daily && daily.bollinger) {
        const { pb } = daily.bollinger;
        if (pb > 0.9) {
            techDetails.bb = { text: "Price riding the Upper Bollinger Band; signaling strength but high extension risk.", sentiment: 'positive' };
            score += 0.5;
        } else if (pb < 0.1) {
            techDetails.bb = { text: "Price tagging Lower Bollinger Band; historically an institutional dip-buy zone.", sentiment: 'negative' };
        } else {
            techDetails.bb = { text: "Volatility contracting within bands; suggesting upcoming directional expansion.", sentiment: 'neutral' };
        }
    }

    // 6. FVG Analysis
    if (daily?.fvg?.type === 'BULLISH') {
        techDetails.fvg = { text: `Bullish FVG support identified ($${daily.fvg.gapLow.toFixed(2)}-${daily.fvg.gapHigh.toFixed(2)}). Acts as a liquidity magnet.`, sentiment: 'positive' };
        score += 1.0;
    } else if (daily?.fvg?.type === 'BEARISH') {
        techDetails.fvg = { text: `Bearish FVG 'Hard Ceiling' active ($${daily.fvg.gapLow.toFixed(2)}-${daily.fvg.gapHigh.toFixed(2)}). Expect supply pressure.`, sentiment: 'negative' };
        score -= 1.0;
    }

    // 7. Options Flow
    const callVol = options.filter(o => o.type === 'CALL').reduce((a, b) => a + (b.volume || 0), 0);
    const putVol = options.filter(o => o.type === 'PUT').reduce((a, b) => a + (b.volume || 0), 0);
    if (callVol > putVol * 1.5) {
        techDetails.options = { text: "Heavy call flow detected; institutional participants positioned for upside momentum.", sentiment: 'positive' };
        score += 1.0;
    } else if (putVol > callVol * 1.5) {
        techDetails.options = { text: "Aggressive put buying dominance suggests cautious or bearish institutional bias.", sentiment: 'negative' };
        score -= 1.0;
    }

    // Clamp Score
    score = Math.min(10, Math.max(0, score));
    score = Number(score.toFixed(1));

    // 8. R:R Calculations
    let stopLoss = 0;
    let targetPrice = 0;
    let rrRatio = 0;

    if (bias === 'BULLISH') {
        stopLoss = daily?.fvg?.type === 'BULLISH' ? daily.fvg.gapLow * 0.995 : (daily?.ema21 ? daily.ema21 * 0.985 : price * 0.97);
        targetPrice = daily?.bollinger?.upper || price * 1.08;
        rrRatio = (targetPrice - price) / (price - stopLoss);
    } else if (bias === 'BEARISH') {
        stopLoss = daily?.fvg?.type === 'BEARISH' ? daily.fvg.gapHigh * 1.005 : (daily?.ema21 ? daily.ema21 * 1.015 : price * 1.03);
        targetPrice = daily?.bollinger?.lower || price * 0.92;
        rrRatio = (price - targetPrice) / (stopLoss - price);
    }

    if (rrRatio < 0) rrRatio = 0;

    // Enforce 1.8 min R:R ratio for momentum buy, otherwise wait
    const isRrValid = rrRatio >= 1.8;

    // Determine Signal & Strategy
    let signal = "NEUTRAL";
    if (score >= 8 && isRrValid) signal = "STRONG BUY";
    else if (score >= 6.5 && isRrValid) signal = "BUY";
    else if (score <= 2) signal = "STRONG SELL";
    else if (score <= 4) signal = "SELL";

    // Set execution action
    let executionAction: 'BUY' | 'SELL' | 'WAIT' = 'WAIT';
    if (bias === 'BULLISH' && score >= 6.5) {
        executionAction = isRrValid ? 'BUY' : 'WAIT';
    } else if (bias === 'BEARISH' && score <= 4.0) {
        executionAction = isRrValid ? 'SELL' : 'WAIT';
    }

    // 9. Volatility and Options Strategy Selection
    const detailsStr = (analysis.metrics.gammaSqueeze?.details || []).join(' ').toLowerCase();
    const isHighIV = detailsStr.includes('high implied volatility') || detailsStr.includes('explosive iv') || (analysis.metrics.volatility || 0) > 0.45;

    let optionStrategy = "Awaiting Setup";
    if (executionAction === 'BUY') {
        optionStrategy = isHighIV ? "Bull Put Credit Spread (Sell OTM Put)" : "Bull Call Debit Spread / Long Call";
    } else if (executionAction === 'SELL') {
        optionStrategy = isHighIV ? "Bear Call Credit Spread (Sell OTM Call)" : "Bear Put Debit Spread / Long Put";
    } else {
        optionStrategy = isHighIV ? "Iron Condor / Short Strangle (Range Income)" : "Calendar / Diagonal Spread";
    }

    // Entry Point Explanation
    let entryReason = "";
    const entryPrice = price;
    if (executionAction === 'BUY') {
        if (daily?.fvg?.type === 'BULLISH') {
            entryReason = `Regime: ${regime}. Long entry verified near $${daily.fvg.gapHigh.toFixed(2)} (FVG support). Confluence and R:R ratio ($${rrRatio.toFixed(1)}:1) indicate high entry quality.`;
        } else {
            entryReason = `Regime: ${regime}. Bullish momentum confirmed. Scaling in near the 9 EMA ($${daily?.ema9?.toFixed(2)}) optimizes risk-to-reward. Target: $${targetPrice.toFixed(2)}.`;
        }
    } else if (executionAction === 'SELL') {
        if (daily?.fvg?.type === 'BEARISH') {
            entryReason = `Regime: ${regime}. Short entry verified near $${daily.fvg.gapLow.toFixed(2)} (FVG ceiling). Confluence and R:R ratio ($${rrRatio.toFixed(1)}:1) indicate high short-sale entry quality.`;
        } else {
            entryReason = `Regime: ${regime}. Bearish momentum confirmed. Short entry optimized near the 9 EMA ($${daily?.ema9?.toFixed(2)}). Target: $${targetPrice.toFixed(2)}.`;
        }
    } else {
        if (!isRrValid && (bias === 'BULLISH' || bias === 'BEARISH')) {
            entryReason = `Bias is ${bias} but Risk-to-Reward is unfavorable (${rrRatio.toFixed(2)}:1). Entry is currently extended. Wait for a pullback to $${(bias === 'BULLISH' ? (daily?.ema21 || price * 0.98) : (daily?.ema21 || price * 1.02)).toFixed(2)} to improve R:R.`;
        } else if (daily?.fvg?.type === 'BEARISH') {
            entryReason = `Wait for a daily close above the $${daily.fvg.gapHigh.toFixed(2)} resistance ceiling before seeking long entry. Current overhead supply is suppressing price.`;
        } else {
            entryReason = `Market currently in a low-confluence ${regime} phase. Await a clear EMA cross, FVG formation, or RSI divergence before deployment.`;
        }
    }

    return { 
        signal, 
        score, 
        executionAction, 
        entryPrice, 
        entryReason, 
        techDetails,
        regime,
        stopLoss,
        targetPrice,
        rrRatio,
        optionStrategy
    };
}
