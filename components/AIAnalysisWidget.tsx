
import { Activity, TrendingUp, TrendingDown, AlertTriangle, BookOpen, Target } from "lucide-react";
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
    const { signal, score, reasons, summary } = generateSignal(symbol, analysis, optionsFlow, fundamentals);

    const scoreColor = score >= 7 ? "text-green-400" : score <= 3 ? "text-red-400" : "text-yellow-400";
    const bgGradient = score >= 7 ? "from-green-500/10 to-transparent" : score <= 3 ? "from-red-500/10 to-transparent" : "from-yellow-500/10 to-transparent";
    const borderColor = score >= 7 ? "border-green-500/30" : score <= 3 ? "border-red-500/30" : "border-yellow-500/30";

    return (
        <div className={`p-4 rounded-xl border ${borderColor} bg-gradient-to-r ${bgGradient} relative overflow-hidden`}>
            <div className="flex flex-row gap-4 items-center">

                {/* LEFT: SIGNAL & SCORE (compact) */}
                <div className="flex-shrink-0 flex flex-col items-center gap-2">
                    <div className="text-center">
                        <div className="text-[10px] font-medium text-gray-200 uppercase tracking-widest mb-1">AI Signal</div>
                        <div className={`text-xl font-bold ${scoreColor} leading-tight mb-0.5`}>{signal}</div>
                        <div className="text-3xl font-black text-white leading-none">
                            {score}<span className="text-sm text-gray-200">/10</span>
                        </div>
                    </div>
                    {fundamentals.targetMeanPrice && (
                        <div className="text-xs text-gray-100 bg-gray-800/80 px-3 py-1.5 rounded-lg border border-gray-700/50 flex flex-col items-center gap-0.5 mt-1 shadow-md">
                            <div className="flex items-center gap-1 font-bold uppercase text-[9px] text-gray-200 tracking-wider">
                                <Target className="w-2.5 h-2.5 text-blue-400" /> Target Price
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-white text-base font-bold">${fundamentals.targetMeanPrice.toFixed(0)}</span>
                                <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${analysis.currentPrice < fundamentals.targetMeanPrice ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                                    {((fundamentals.targetMeanPrice - analysis.currentPrice) / analysis.currentPrice * 100).toFixed(1)}%
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* DIVIDER */}
                <div className="w-px h-16 bg-gray-700/50 flex-shrink-0 hidden md:block" />

                {/* RIGHT: SUMMARY + DRIVERS (compact) */}
                <div className="flex-grow min-w-0">
                    <p className="text-gray-100 text-sm md:text-base leading-relaxed mb-3 font-medium">
                        {summary}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {reasons.slice(0, 4).map((reason, i) => (
                            <span key={i} className="flex items-center gap-1.5 text-[11px] text-gray-100 bg-gray-800/60 px-2.5 py-1.5 rounded-lg border border-gray-700/50 shadow-sm">
                                {reason.sentiment === 'positive' ? (
                                    <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                                ) : reason.sentiment === 'negative' ? (
                                    <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                                ) : (
                                    <Activity className="w-3.5 h-3.5 text-yellow-400" />
                                )}
                                <span className="font-semibold">{reason.text}</span>
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function generateSignal(symbol: string, analysis: MultiTimeframeAnalysis, options: UnusualOption[], fundamentals: Fundamentals) {
    let score = 5.0; // Neutral Start
    const reasons: { text: string, sentiment: 'positive' | 'negative' | 'neutral' }[] = [];

    // 1. TECHNICALS (FVG + Trends)
    const daily = analysis.timeframes.find(t => t.timeframe === '1d');
    const hourly = analysis.timeframes.find(t => t.timeframe === '1h');

    if (daily) {
        if (daily.trend === 'BULLISH') {
            score += 1.5;
            reasons.push({ text: "Daily Trend is Bullish (Price > 50 EMA)", sentiment: 'positive' });
        } else if (daily.trend === 'BEARISH') {
            score -= 1.5;
            reasons.push({ text: "Daily Trend is Bearish", sentiment: 'negative' });
        }

        // FVG Check
        if (daily.fvg?.type === 'BULLISH') {
            score += 0.8;
            reasons.push({ text: "Active Bullish Fair Value Gap (Institutional Support)", sentiment: 'positive' });
        } else if (daily.fvg?.type === 'BEARISH') {
            score -= 0.8;
            reasons.push({ text: "Active Bearish Fair Value Gap (Price Imbalance)", sentiment: 'negative' });
        }

        // EMA 200 (Long Term)
        if (daily.ema200 && daily.close > daily.ema200) {
            score += 0.7;
            reasons.push({ text: "Stable above 200-Day Moving Average", sentiment: 'positive' });
        }
    }

    // 2. GAMMA SQUEEZE & OPTIONS DYNAMICS
    const gamma = analysis.metrics.gammaSqueeze;
    if (gamma && gamma.score > 60) {
        const boost = (gamma.score / 100) * 1.5;
        score += boost;
        reasons.push({ text: `High Gamma Squeeze Probability (${gamma.score}%)`, sentiment: 'positive' });
    }

    // P/C Ratio Calculation
    const callFlow = options.filter(o => o.type === 'CALL').length;
    const putFlow = options.filter(o => o.type === 'PUT').length;
    const totalFlow = callFlow + putFlow;

    if (totalFlow > 0) {
        const pcRatio = putFlow / callFlow;
        if (pcRatio < 0.6) {
            score += 0.7;
            reasons.push({ text: `Bullish P/C Balance (${pcRatio.toFixed(2)})`, sentiment: 'positive' });
        } else if (pcRatio > 1.4) {
            score -= 0.7;
            reasons.push({ text: `Bearish P/C Balance (${pcRatio.toFixed(2)})`, sentiment: 'negative' });
        }
    }

    // 3. FUNDAMENTALS & RISK (BETA)
    const beta = fundamentals.beta || analysis.metrics.beta;
    if (beta) {
        if (beta > 1.3 && score > 6) {
            score += 0.5; // High beta momentum tailwind
            reasons.push({ text: `High Beta (${beta.toFixed(2)}) amplification on trend`, sentiment: 'positive' });
        } else if (beta < 0.8) {
            reasons.push({ text: `Low Beta (${beta.toFixed(2)}) - Defensive profile`, sentiment: 'neutral' });
        }
    }

    if (fundamentals.recommendationKey === 'strong_buy' || fundamentals.recommendationKey === 'buy') {
        score += 0.8;
        reasons.push({ text: "Institutional Consensus: BUY", sentiment: 'positive' });
    }

    // 4. PRICE TARGET & VOLUME
    if (fundamentals.targetMeanPrice) {
        const upside = ((fundamentals.targetMeanPrice - analysis.currentPrice) / analysis.currentPrice) * 100;
        if (upside > 15) {
            score += 0.5;
            reasons.push({ text: `Analyst Target: ${upside.toFixed(0)}% Upside`, sentiment: 'positive' });
        }
    }

    if (analysis.metrics.volumeDiff > 30) {
        score += 0.5;
        reasons.push({ text: "Institutional Accumulation (High Vol)", sentiment: 'positive' });
    }

    // Clamp Score
    score = Math.min(10, Math.max(0, score));
    score = Number(score.toFixed(1));

    // Determine Signal
    let signal = "NEUTRAL";
    if (score >= 8) signal = "STRONG BUY";
    else if (score >= 6.5) signal = "BUY";
    else if (score <= 2) signal = "STRONG SELL";
    else if (score <= 4) signal = "SELL";

    // Natural Language Summary
    let summary = `Our AI analysis of ${symbol} across technical imbalances and options flow indicates a ${signal} signal with a ${score}/10 conviction score. `;

    if (daily?.fvg?.type === 'BULLISH' || (gamma && gamma.score > 70)) {
        summary += "Strong institutional imbalances suggest a supply-demand mismatch favoring bulls. ";
    }

    if (score > 7) {
        summary += `The combination of ${daily?.trend === 'BULLISH' ? 'trend alignment' : 'strong metrics'} and ${gamma && gamma.score > 50 ? 'Gamma Squeeze risk' : 'Options flow'} creates a high-probability setup. `;
    } else if (score < 4) {
        summary += "Technical structure remains weak with significant overhead supply or bearish options sentiment. ";
    } else {
        summary += "Market forces are currently balanced; wait for FVG filling or trend breakout for clear entry. ";
    }

    return { signal, score, reasons, summary };
}
