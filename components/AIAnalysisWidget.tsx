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
        techDetails 
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
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                            <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                        </div>
                        <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Live AI Assessment</h3>
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
                    <div className={`p-6 rounded-2xl border flex flex-col gap-4 shadow-2xl ${executionAction === 'BUY' ? 'bg-[#00FF94]/5 border-[#00FF94]/20' : 'bg-[#FFB800]/5 border-[#FFB800]/20'}`}>
                        <div className="flex items-center gap-2">
                            <Clock className={`w-4 h-4 ${executionAction === 'BUY' ? 'text-[#00FF94]' : 'text-[#FFB800]'}`} />
                            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Execution Strategy</span>
                        </div>
                        <div className={`text-xl font-black ${executionAction === 'BUY' ? 'text-[#00FF94]' : 'text-[#FFB800]'}`}>
                            {executionAction === 'BUY' ? 'BUY / ENTER NOW' : 'WAIT FOR SETUP'}
                        </div>
                        <div className="text-[11px] font-bold text-white/80 leading-relaxed bg-black/40 p-3 rounded-xl border border-white/5 backdrop-blur-sm">
                            {executionAction === 'BUY' 
                                ? `Primary Entry: $${entryPrice.toFixed(2)}`
                                : "No immediate entry identified. Await confluence reversal."}
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
                            {/* Trend Group */}
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.25em] flex items-center gap-2">
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

                                <div className="space-y-4">
                                    <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.25em] flex items-center gap-2">
                                        <div className="w-1 h-1 bg-indigo-500 rounded-full"></div>
                                        Momentum (RSI)
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${techDetails.rsi.sentiment === 'positive' ? 'bg-[#00FF94]' : techDetails.rsi.sentiment === 'negative' ? 'bg-[#FF2E2E]' : 'bg-[#FFB800]'}`}></div>
                                        <span className="text-xs text-white/70 font-bold leading-relaxed">{techDetails.rsi.text}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Volatility & Flow Group */}
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.25em] flex items-center gap-2">
                                        <div className="w-1 h-1 bg-indigo-500 rounded-full"></div>
                                        Volatility (Bollinger)
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${techDetails.bb.sentiment === 'positive' ? 'bg-[#00FF94]' : techDetails.bb.sentiment === 'negative' ? 'bg-[#FF2E2E]' : 'bg-white/20'}`}></div>
                                        <span className="text-xs text-white/70 font-bold leading-relaxed">{techDetails.bb.text}</span>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.25em] flex items-center gap-2">
                                        <div className="w-1 h-1 bg-indigo-500 rounded-full"></div>
                                        Market Gaps (FVG)
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${techDetails.fvg.sentiment === 'positive' ? 'bg-[#00FF94]' : techDetails.fvg.sentiment === 'negative' ? 'bg-[#FF2E2E]' : 'bg-white/20'}`}></div>
                                        <span className="text-xs text-white/70 font-bold leading-relaxed">{techDetails.fvg.text}</span>
                                    </div>
                                </div>
                                
                                <div className="space-y-4">
                                    <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.25em] flex items-center gap-2">
                                        <div className="w-1 h-1 bg-indigo-500 rounded-full"></div>
                                        Institutional Bias
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${techDetails.options.sentiment === 'positive' ? 'bg-[#00FF94]' : techDetails.options.sentiment === 'negative' ? 'bg-[#FF2E2E]' : 'bg-white/20'}`}></div>
                                        <span className="text-xs text-white/70 font-bold leading-relaxed">{techDetails.options.text}</span>
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

function generateSignal(symbol: string, analysis: MultiTimeframeAnalysis, options: UnusualOption[], fundamentals: Fundamentals) {
    let score = 5.0; // Neutral Start
    
    // Detailed Technical Object
    const techDetails = {
        emas: [] as { text: string, sentiment: 'positive' | 'negative' | 'neutral' }[],
        rsi: { text: '', sentiment: 'neutral' as 'positive' | 'negative' | 'neutral' },
        bb: { text: '', sentiment: 'neutral' as 'positive' | 'negative' | 'neutral' },
        fvg: { text: 'No significant Fair Value Gaps detected in immediate price action.', sentiment: 'neutral' as 'positive' | 'negative' | 'neutral' },
        options: { text: 'Neutral participation detected in institutional flow.', sentiment: 'neutral' as 'positive' | 'negative' | 'neutral' }
    };

    const daily = analysis.timeframes.find(t => t.timeframe === '1d');
    const price = analysis.currentPrice;

    // 1. EMA ANALYSIS (Analyst Logic)
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

    // 2. RSI ANALYSIS
    if (daily && daily.rsi) {
        if (daily.rsi > 70) {
            techDetails.rsi = { text: `RSI Overextended at ${daily.rsi.toFixed(1)}, suggesting high probability of terminal exhaustion.`, sentiment: 'negative' };
            score -= 1.0;
        } else if (daily.rsi < 30) {
            techDetails.rsi = { text: `RSI Oversold at ${daily.rsi.toFixed(1)}, indicating a potential bottoming process or mean reversion bounce.`, sentiment: 'positive' };
            score += 1.0;
        } else {
            techDetails.rsi = { text: `RSI Neutral at ${daily.rsi.toFixed(0)}, leaving room for expansion before immediate rejection.`, sentiment: 'neutral' };
        }
    }

    // 3. BOLLINGER BANDS
    if (daily && daily.bollinger) {
        const { pb } = daily.bollinger;
        if (pb > 0.9) {
            techDetails.bb = { text: "Price riding the Upper Bollinger Band; signaling strength but high extension risk.", sentiment: 'positive' };
            score += 0.5;
        } else if (pb < 0.1) {
            techDetails.bb = { text: "Price tagging Lower Bollinger Band; historically an institutional dip-buy zone.", sentiment: 'negative' }; // negative position, but potential positive
        } else {
            techDetails.bb = { text: "Volatility contracting within bands; suggesting upcoming directional expansion.", sentiment: 'neutral' };
        }
    }

    // 4. FVG Analysis
    if (daily?.fvg?.type === 'BULLISH') {
        techDetails.fvg = { text: `Bullish FVG support identified ($${daily.fvg.gapLow.toFixed(2)}-${daily.fvg.gapHigh.toFixed(2)}). Acts as a liquidity magnet.`, sentiment: 'positive' };
        score += 1.0;
    } else if (daily?.fvg?.type === 'BEARISH') {
        techDetails.fvg = { text: `Bearish FVG 'Hard Ceiling' active ($${daily.fvg.gapLow.toFixed(2)}-${daily.fvg.gapHigh.toFixed(2)}). Expect supply pressure.`, sentiment: 'negative' };
        score -= 1.0;
    }

    // 5. Options Flow
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

    // Determine Signal & Strategy
    let signal = "NEUTRAL";
    if (score >= 8) signal = "STRONG BUY";
    else if (score >= 6.5) signal = "BUY";
    else if (score <= 2) signal = "STRONG SELL";
    else if (score <= 4) signal = "SELL";

    const executionAction = score >= 6.5 ? 'BUY' : 'WAIT';
    
    // Entry Point Explanation
    let entryReason = "";
    const entryPrice = price;
    if (executionAction === 'BUY') {
        if (daily?.fvg?.type === 'BULLISH') {
            entryReason = `Long entry recommended near $${daily.fvg.gapHigh.toFixed(2)} (FVG Top) or on a retest of the daily 21 EMA. Overall confluence suggests high conviction for upside expansion with minimal drawdown expected.`;
        } else {
            entryReason = `Current market price is attractive for momentum. Scaling in near the 9 EMA ($${daily?.ema9?.toFixed(2)}) is advised to maintain a tight risk-to-reward while trend remains intact.`;
        }
    } else {
        if (daily?.fvg?.type === 'BEARISH') {
            entryReason = `Wait for a daily close above the $${daily.fvg.gapHigh.toFixed(2)} 'Hard Ceiling' before seeking long entry. Current overhead supply of $${daily.fvg.gapLow.toFixed(2)} is suppressing price discovery.`;
        } else {
            entryReason = `Market currently in 'Price Discovery' with no clear confluence. Patience required. Monitor for a breach of the daily 50 EMA or an RSI divergence before deployment.`;
        }
    }

    return { signal, score, executionAction, entryPrice, entryReason, techDetails };
}
