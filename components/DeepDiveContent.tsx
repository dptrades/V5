import { useEffect, useState, ReactNode } from "react";
import { Loader2, TrendingUp, TrendingDown, Activity, BarChart2, AlertCircle, Info, RefreshCw, Database } from "lucide-react";
import { MultiTimeframeAnalysis } from "@/lib/market-data";
import { UnusualOption } from "@/lib/options-flow";
import AIAnalysisWidget, { Fundamentals } from "./AIAnalysisWidget";

interface DeepDiveContentProps {
    symbol: string | null;
    showOptionsFlow?: boolean;
    onRefresh?: () => void;
    refreshKey?: number;
}

interface DetailData {
    symbol: string;
    displayPrice: number;
    headerPrice: number;
    analysis: MultiTimeframeAnalysis;
    optionsFlow: UnusualOption[];
    fundamentals: Fundamentals;
    putCallRatio: { volumeRatio: number, oiRatio: number, totalCalls: number, totalPuts: number } | null;
}

export default function DeepDiveContent({ symbol, showOptionsFlow = true, onRefresh, refreshKey }: DeepDiveContentProps) {
    const [data, setData] = useState<DetailData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (symbol) {
            setData(null);
            setError("");
            fetchDetails(symbol);
        } else {
            setData(null);
        }
    }, [symbol, refreshKey]);

    const fetchDetails = async (sym: string, isManual: boolean = false) => {
        setLoading(true);
        setError("");

        // Helper to trigger parent refresh if needed, though we handle internal data fetches here
        if (isManual && onRefresh) {
            onRefresh();
        }

        try {
            const url = `/api/conviction/${sym.toLowerCase()}${isManual ? '?refresh=true' : ''}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("Failed to fetch detailed analysis");
            const json = await res.json();
            setData(json);
        } catch (e) {
            console.error(e);
            setError("Failed to load deep dive analysis");
        } finally {
            setLoading(false);
        }
    };

    if (!symbol) return null;

    if (loading && !data) {
        return (
            <div className="h-64 flex flex-col items-center justify-center text-gray-100 bg-gray-900/50 rounded-xl border border-gray-800">
                <Loader2 className="w-8 h-8 animate-spin mb-2 text-blue-500" />
                <p>Scanning Multi-Timeframe Data & Options Chain...</p>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg">
                {error}
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="space-y-1">
            <p className="text-[11px] text-[#ddff00] font-bold italic pl-1">
                * If P/C ratio or options data is missing, please refresh the page after a few seconds.
            </p>
            <div className="space-y-6 bg-gray-900/50 p-6 rounded-xl border border-gray-800 relative">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            {symbol} <span className="text-blue-400">Deep Dive</span>
                        </h2>
                        <p className="text-gray-100 text-sm">
                            Multi-timeframe Technicals & Institutional Flow
                        </p>
                    </div>

                    <div className="text-right flex flex-col items-end">
                        <div className="flex items-center gap-2">
                            {/* Session Presence Indicators */}
                            {data.analysis.marketSession === 'REG' && (
                                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 text-[10px] font-black uppercase italic animate-pulse border border-green-500/20">
                                    <Activity className="w-2.5 h-2.5" />
                                    Live
                                </span>
                            )}
                            {data.analysis.marketSession === 'PRE' && (
                                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 text-[10px] font-black uppercase italic animate-pulse border border-orange-500/20 shadow-[0_0_8px_rgba(249,115,22,0.15)]">
                                    <Activity className="w-2.5 h-2.5" />
                                    Pre-Market
                                </span>
                            )}
                            {data.analysis.marketSession === 'POST' && (
                                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 text-[10px] font-black uppercase italic animate-pulse border border-purple-500/20 shadow-[0_0_8px_rgba(168,85,247,0.15)]">
                                    <Activity className="w-2.5 h-2.5" />
                                    After Hours
                                </span>
                            )}
                            {data.analysis.marketSession === 'OFF' && (
                                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-800/80 text-gray-400 text-[10px] font-black uppercase italic border border-gray-700/50">
                                    <Activity className="w-2.5 h-2.5" />
                                    After Market Close
                                </span>
                            )}
                            <div className="text-2xl font-bold text-white">
                                ${data.analysis.currentPrice.toFixed(2)}
                            </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 mt-1">
                            {/* Meta Info Line */}
                            {data.analysis.marketSession === 'OFF' && (
                                <div className="text-[10px] text-gray-400 font-mono">
                                    Regular Close: <span className="text-gray-200">${data.analysis.headerPrice.toFixed(2)}</span>
                                </div>
                            )}
                            {data.analysis.marketSession !== 'REG' && data.analysis.marketSession !== 'OFF' && (
                                <div className="text-[10px] text-gray-400 font-mono">
                                    Session Close: <span className="text-gray-200">${data.analysis.headerPrice.toFixed(2)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 1. UNIFIED METRICS ROW - High Density */}
                <div className="flex flex-wrap md:flex-nowrap gap-2 items-stretch justify-center">
                    {/* Range - Customized with Colors */}
                    <CompactMetric
                        label="Range"
                        value={<span className="text-green-400">High ${data.analysis.metrics.dayHigh.toFixed(2)}</span>}
                        subValue={<span className="text-red-400">Low ${data.analysis.metrics.dayLow.toFixed(2)}</span>}
                        sentiment="neutral"
                        icon={<TrendingUp className="w-3 h-3" />}
                        isStacked={true}
                        centered={true}
                    />

                    {/* Volume */}
                    <CompactMetric
                        label="Volume"
                        value={`${(data.analysis.metrics.volumeDiff > 0 ? '+' : '')}${data.analysis.metrics.volumeDiff.toFixed(0)}%`}
                        subValue={`${(data.analysis.metrics.avgVolume1y / 1_000_000).toFixed(1)}M Yearly Avg`}
                        sentiment={data.analysis.metrics.volumeDiff > 25 ? 'positive' : data.analysis.metrics.volumeDiff < -25 ? 'negative' : 'neutral'}
                        icon={<BarChart2 className="w-3 h-3" />}
                        centered={true}
                    />

                    {/* Daily ATR */}
                    <CompactMetric
                        label="ATR"
                        value={`$${data.analysis.metrics.atr.toFixed(2)}`}
                        subValue={`${data.analysis.metrics.volatility.toFixed(1)}% Volatility`}
                        sentiment="neutral"
                        icon={<Activity className="w-3 h-3" />}
                        centered={true}
                    />

                    {/* P/C Ratio */}
                    <CompactMetric
                        label="P/C Ratio"
                        value={data.putCallRatio ? data.putCallRatio.volumeRatio : 'N/A'}
                        subValue={
                            data.putCallRatio
                                ? (data.putCallRatio.volumeRatio < 0.7 ? 'Bullish' : data.putCallRatio.volumeRatio > 1.0 ? 'Bearish' : 'Neutral')
                                : 'Wait...'
                        }
                        sentiment={data.putCallRatio ? (data.putCallRatio.volumeRatio < 0.7 ? 'positive' : data.putCallRatio.volumeRatio > 1.0 ? 'negative' : 'neutral') : 'neutral'}
                        icon={<Activity className="w-3 h-3" />}
                        centered={true}
                    />

                    {/* Gamma Squeeze */}
                    <CompactMetric
                        label="Gamma Sqz"
                        value={`${data.analysis.metrics.gammaSqueeze?.score || 0}%`}
                        subValue={
                            (data.analysis.metrics.gammaSqueeze?.score || 0) > 60 ? 'High Probability' :
                                (data.analysis.metrics.gammaSqueeze?.score || 0) > 30 ? 'Moderate' : 'Low'
                        }
                        sentiment={data.analysis.metrics.gammaSqueeze?.score && data.analysis.metrics.gammaSqueeze.score > 60 ? 'warning' : 'neutral'}
                        icon={<Activity className="w-3 h-3" />}
                        isAlert={data.analysis.metrics.gammaSqueeze?.score && data.analysis.metrics.gammaSqueeze.score > 60 ? true : false}
                        centered={true}
                    />

                    {/* Beta */}
                    <CompactMetric
                        label="Beta"
                        value={data.analysis.metrics.beta?.toFixed(2) || 'N/A'}
                        subValue={
                            (data.analysis.metrics.beta || 1) > 1.2 ? 'High Volatility' :
                                (data.analysis.metrics.beta || 1) < 0.8 ? 'Low Volatility' : 'Moderate'
                        }
                        sentiment={data.analysis.metrics.beta && data.analysis.metrics.beta > 1.5 ? 'warning' : 'neutral'}
                        icon={<Activity className="w-3 h-3" />}
                        centered={true}
                    />
                </div>

                {/* 2. MULTI-TIMEFRAME EMA MATRIX */}
                <div className={`rounded-xl border ${data.analysis.timeframes.find(t => t.timeframe === '1d')?.trend === 'BULLISH' ? 'border-green-500/30 bg-green-900/5' :
                    data.analysis.timeframes.find(t => t.timeframe === '1d')?.trend === 'BEARISH' ? 'border-red-500/30 bg-red-900/5' :
                        'border-gray-800'
                    } p-4 transition-colors duration-500`}>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-400" />
                        Technical Confluence Matrix
                    </h3>
                    <div className="overflow-x-auto rounded-lg border border-gray-800/50">
                        <table className="w-full text-sm text-left whitespace-nowrap">
                            <thead className="bg-gray-800/50 text-gray-100">
                                <tr>
                                    <th className="p-3 w-12 text-center">TF</th>
                                    <th className="p-3">Trend</th>
                                    <th className="p-3">EMA 9</th>
                                    <th className="p-3">EMA 21</th>
                                    <th className="p-3">EMA 50</th>
                                    <th className="p-3">EMA 200</th>
                                    <th className="p-3 border-l border-gray-700/50">RSI</th>
                                    <th className="p-3">VWAP</th>
                                    <th className="p-3 border-l border-gray-700/50">FVG</th>
                                    <th className="p-3">MACD</th>
                                    <th className="p-3">Bollinger</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {data.analysis.timeframes.map((tf) => (
                                    <tr key={tf.timeframe} className="hover:bg-gray-800/30">
                                        <td className="p-3 w-12 text-center font-medium uppercase text-gray-200">{tf.timeframe}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${tf.trend === 'BULLISH' ? 'bg-green-500/20 text-green-400' :
                                                tf.trend === 'BEARISH' ? 'bg-red-500/20 text-red-400' :
                                                    'bg-gray-500/20 text-gray-100'
                                                }`}>
                                                {tf.trend}
                                            </span>
                                        </td>

                                        {/* EMA Columns First */}
                                        <EmaCell price={tf.close} ema={tf.ema9} label="9" />
                                        <EmaCell price={tf.close} ema={tf.ema21} label="21" />
                                        <EmaCell price={tf.close} ema={tf.ema50} label="50" />
                                        <EmaCell price={tf.close} ema={tf.ema200} label="200" />

                                        {/* Technicals Second (with border separator) */}
                                        <td className={`p-3 font-mono font-bold border-l border-gray-700/50 ${(tf.rsi || 50) > 70 ? 'bg-red-500/20 text-red-200' :
                                            (tf.rsi || 50) < 30 ? 'bg-green-500/20 text-green-200' : ''
                                            }`}>
                                            <span>{tf.rsi?.toFixed(0) || '-'}</span>
                                        </td>

                                        {/* VWAP Cell */}
                                        <td className={`p-3 border-l border-gray-700/50 ${tf.vwap ? (tf.close > tf.vwap ? 'bg-green-500/10' : 'bg-red-500/10') : ''}`}>
                                            {tf.vwap ? (
                                                <div className="flex flex-col">
                                                    <span className={`text-xs font-bold ${tf.close > tf.vwap ? 'text-green-400' : 'text-red-400'}`}>
                                                        {tf.close > tf.vwap ? '> VWAP' : '< VWAP'}
                                                    </span>
                                                    <span className="text-[10px] text-gray-200 font-mono">
                                                        ${tf.vwap.toFixed(2)}
                                                    </span>
                                                </div>
                                            ) : <span className="text-gray-100">-</span>}
                                        </td>

                                        {/* FVG Column */}
                                        <td className={`p-3 border-l border-gray-700/50 ${tf.fvg?.type === 'BULLISH' ? 'bg-green-500/10' : tf.fvg?.type === 'BEARISH' ? 'bg-red-500/10' : ''}`}>
                                            {tf.fvg?.type !== 'NONE' ? (
                                                <div className="flex flex-col">
                                                    <span className={`text-[10px] font-bold ${tf.fvg?.type === 'BULLISH' ? 'text-green-400' : 'text-red-400'}`}>
                                                        {tf.fvg?.type} GAP
                                                    </span>
                                                    <span className="text-[9px] text-gray-200 font-bold font-mono">
                                                        ${tf.fvg?.gapLow.toFixed(2)}-${tf.fvg?.gapHigh.toFixed(2)}
                                                    </span>
                                                </div>
                                            ) : <span className="text-gray-300">-</span>}
                                        </td>

                                        {/* MACD Cell */}
                                        <td className={`p-3 border-l border-gray-700/50 ${tf.macd ? (tf.macd.histogram > 0 ? 'bg-green-500/10' : 'bg-red-500/10') : ''}`}>
                                            {tf.macd ? (
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs font-bold ${tf.macd.histogram > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                        {tf.macd.histogram > 0 ? 'BULL' : 'BEAR'}
                                                    </span>
                                                    <span className="text-[10px] text-gray-200 opacity-60 font-mono">
                                                        {tf.macd.histogram.toFixed(2)}
                                                    </span>
                                                </div>
                                            ) : <span className="text-gray-100">-</span>}
                                        </td>

                                        {/* Bollinger Cell */}
                                        <td className={`p-3 border-l border-gray-700/50 ${tf.bollinger ? (tf.close > tf.bollinger.upper ? 'bg-red-500/10' : tf.close < tf.bollinger.lower ? 'bg-green-500/10' : '') : ''}`}>
                                            {tf.bollinger ? (
                                                <div className="flex flex-col">
                                                    {tf.close > tf.bollinger.upper ? (
                                                        <span className="text-red-400 text-xs font-bold">ABOVE UPPER</span>
                                                    ) : tf.close < tf.bollinger.lower ? (
                                                        <span className="text-green-400 text-xs font-bold">BELOW LOWER</span>
                                                    ) : (
                                                        <span className="text-gray-200 text-xs font-medium italic">INSIDE</span>
                                                    )}
                                                    <span className="text-[10px] text-gray-200 font-mono">%B: {tf.bollinger.pb.toFixed(2)}</span>
                                                </div>
                                            ) : <span className="text-gray-100">-</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-gray-200 mt-2">
                        * Highlights indicate price is within 0.5% of the EMA (Support/Resistance Watch)
                    </p>
                </div>

                {/* 2.5 AI ANALYSIS WIDGET */}
                <AIAnalysisWidget
                    symbol={symbol}
                    analysis={data.analysis}
                    optionsFlow={data.optionsFlow}
                    fundamentals={data.fundamentals}
                />

                {/* 3. UNUSUAL OPTIONS FLOW */}
                {
                    showOptionsFlow && (
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5 text-yellow-400" />
                                    Unusual Options Flow (Next 90 Days)
                                </h3>
                                {data.analysis.dataSource !== 'Public.com' && (
                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full text-[10px] text-yellow-500 font-bold uppercase tracking-wider animate-pulse">
                                        <AlertCircle className="w-3 h-3" />
                                        Fallback Data (Yahoo/Estimated)
                                    </div>
                                )}
                            </div>
                            {data.optionsFlow.length === 0 ? (
                                <div className="p-6 text-center border border-gray-800 rounded-lg text-gray-200">
                                    No unusual activity detected (Vol {'>'} OI) for upcoming expiries.
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-lg border border-gray-800 bg-gray-900/50 scrollbar-hide">
                                    <table className="w-full text-sm text-left whitespace-nowrap">
                                        <thead className="bg-gray-800/50 text-gray-100">
                                            <tr>
                                                <th className="p-3">Expiry</th>
                                                <th className="p-3">Strike</th>
                                                <th className="p-3">Type</th>
                                                <th className="p-3 text-right">Vol</th>
                                                <th className="p-3 text-right">OI</th>
                                                <th className="p-3 text-right">Vol/OI</th>
                                                <th className="p-3 text-right">IV</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-800">
                                            {data.optionsFlow.slice(0, 10).map((opt, i) => (
                                                <tr key={i} className="hover:bg-gray-800/30">
                                                    <td className="p-3 font-mono text-gray-200">{opt.expiry}</td>
                                                    <td className="p-3 font-bold">${opt.strike}</td>
                                                    <td className="p-3">
                                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${opt.type === 'CALL' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                            {opt.type}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-right font-mono text-gray-200">{opt.volume}</td>
                                                    <td className="p-3 text-right font-mono text-gray-100">{opt.openInterest}</td>
                                                    <td className="p-3 text-right">
                                                        <span className={`font-bold ${opt.volToOiRatio > 3 ? 'text-yellow-400' : 'text-gray-200'}`}>
                                                            {opt.volToOiRatio.toFixed(1)}x
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-right font-mono text-gray-100">{opt.impliedVolatility}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )
                }

                <div className="mt-6 pt-2 border-t border-gray-800/50 flex justify-end items-center gap-1.5 opacity-60">
                    <Database className="w-2.5 h-2.5 text-blue-500" />
                    <span className="text-[10px] font-bold uppercase tracking-tight text-gray-300">
                        via Schwab (Options/Greeks), Alpaca (Price), Finnhub (Beta)
                    </span>
                </div>
            </div >
        </div >
    );
}

function MetricCard({ label, value, subValue, icon, className }: { label: string, value: string | number, subValue: string, icon: any, className?: string }) {
    return (
        <div className={`p-3 rounded-lg border ${className || 'bg-gray-800/40 border-gray-700/50'}`}>
            <div className="flex items-center gap-2 mb-1 text-gray-100 text-xs uppercase tracking-wider">
                {icon} {label}
            </div>
            <div className="text-xl font-bold text-white">{value}</div>
            <div className="text-xs text-gray-200">{subValue}</div>
        </div>
    );
}

function EmaCell({ price, ema, label }: { price: number, ema: number | null, label: string }) {
    if (!ema) return <td className="p-3 text-gray-100">-</td>;

    const diff = Math.abs((price - ema) / ema) * 100;
    const isNear = diff < 0.5; // Highlight if within 0.5%
    const isAbove = price > ema;

    const bgColor = isNear
        ? 'bg-yellow-500/20'
        : isAbove
            ? 'bg-green-500/10'
            : 'bg-red-500/10';

    const textColor = isNear
        ? 'text-yellow-200 font-bold'
        : isAbove
            ? 'text-green-400'
            : 'text-red-400';

    return (
        <td className={`p-3 font-mono text-xs ${bgColor} ${textColor} border-l border-gray-800/30`}>
            <div className="flex flex-col">
                <span>{ema.toFixed(2)}</span>
                {isNear && <span className="text-[10px] opacity-70">NEAR</span>}
            </div>
        </td>
    );
}


function CompactMetric({
    label,
    value,
    subValue,
    icon,
    sentiment = 'neutral',
    isAlert = false,
    centered = false,
    isStacked = false
}: {
    label: string,
    value: ReactNode,
    subValue?: ReactNode,
    icon: any,
    sentiment?: 'positive' | 'negative' | 'neutral' | 'warning',
    isAlert?: boolean,
    centered?: boolean,
    isStacked?: boolean
}) {
    const bgColors = {
        positive: 'bg-green-500/10 border-green-500/30',
        negative: 'bg-red-500/10 border-red-500/30',
        neutral: 'bg-gray-800/40 border-gray-700/50',
        warning: 'bg-orange-500/10 border-orange-500/30',
    };

    const textColors = {
        positive: 'text-green-400',
        negative: 'text-red-400',
        neutral: 'text-gray-200',
        warning: 'text-orange-400',
    };

    return (
        <div className={`flex-1 min-w-[120px] p-2 rounded-lg border flex flex-col justify-center ${bgColors[sentiment]} ${isAlert ? 'animate-pulse ring-1 ring-orange-500/50' : ''} ${centered ? 'items-center text-center' : ''}`}>
            <div className="flex items-center gap-1.5 mb-0.5 text-[10px] uppercase tracking-wider text-gray-200 font-medium">
                {icon} {label}
            </div>
            <div className={`${isStacked ? 'text-[10px]' : 'text-xs'} font-bold truncate ${textColors[sentiment]}`}>
                {value}
            </div>
            {subValue && (
                <div className={`${isStacked ? `text-[10px] font-bold ${textColors[sentiment]}` : 'text-[9px] text-gray-300'} truncate mt-0.5`}>
                    {subValue}
                </div>
            )}
        </div>
    );
}
