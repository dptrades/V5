import { useState, useEffect } from 'react';
import { OptionRecommendation } from '../lib/options';
import { MousePointerClick, TrendingUp, TrendingDown, AlertCircle, Target, Shield, Crosshair, Zap, X, RefreshCw, Pin, Check, Activity, BarChart2, Info } from 'lucide-react';
import DataSourceIndicator from './ui/DataSourceIndicator';

interface OptionsSignalProps {
    data: OptionRecommendation | null;
    loading: boolean;
    onRefresh?: () => void;
    companyName?: string;
    underlyingPrice?: number;
}

export default function OptionsSignal({ data, loading, onRefresh, companyName, underlyingPrice }: OptionsSignalProps) {
    const [priceFlash, setPriceFlash] = useState<'up' | 'down' | null>(null);
    const [prevPrice, setPrevPrice] = useState<number | undefined>(undefined);
    const [isTracked, setIsTracked] = useState(false);
    const [isTrackLoading, setIsTrackLoading] = useState(false);

    useEffect(() => {
        if (data?.contractPrice !== undefined && prevPrice !== undefined) {
            if (data.contractPrice > prevPrice) {
                setPriceFlash('up');
                setTimeout(() => setPriceFlash(null), 1000);
            } else if (data.contractPrice < prevPrice) {
                setPriceFlash('down');
                setTimeout(() => setPriceFlash(null), 1000);
            }
        }
        setPrevPrice(data?.contractPrice);
    }, [data?.contractPrice]);

    useEffect(() => {
        const checkTrackedStatus = async () => {
            if (!data?.symbol) return;

            // Extract ticker - prioritize ticker from symbol for matching
            const symbolTicker = data.symbol.split(/[0-9]/)[0]?.trim();
            const ticker = symbolTicker || companyName;
            if (!ticker) return;

            try {
                const res = await fetch(`/api/options/track?ticker=${ticker}`);
                if (res.ok) {
                    const { tracked } = await res.json();
                    const isAlreadyTracked = tracked.some((o: any) =>
                        (o.id || '').replace(/\s+/g, '') === (data.symbol || '').replace(/\s+/g, '')
                    );
                    setIsTracked(isAlreadyTracked);
                }
            } catch (e) {
                console.error('Failed to check tracked status:', e);
                setIsTracked(false);
            }
        };

        checkTrackedStatus();
    }, [data?.symbol, companyName]);

    const handleTrack = async () => {
        if (!data || !data.symbol) return;
        setIsTrackLoading(true);
        try {
            const res = await fetch('/api/options/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    option: data,
                    companyName: companyName || data.symbol.split(/[0-9]/)[0],
                    underlyingPrice: underlyingPrice || data.entryPrice
                })
            });
            if (res.ok) {
                setIsTracked(true);
            }
        } catch (e) {
            console.error('Failed to track option:', e);
        } finally {
            setIsTrackLoading(false);
        }
    };

    const [activeDetail, setActiveDetail] = useState<'tech' | 'fund' | 'social' | null>(null);

    if (loading) {
        return <div className="animate-pulse h-24 bg-gray-800 rounded-xl mb-4"></div>;
    }

    if (!data || data.type === 'WAIT') {
        return (
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 mb-4 opacity-75">
                <div className="flex items-center gap-2 mb-2 text-gray-100">
                    <MousePointerClick className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Options AI</span>
                    {onRefresh && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onRefresh(); }}
                            className="p-1 hover:bg-gray-700 rounded-md transition-colors text-gray-200 hover:text-white"
                            title="Refresh Signal"
                        >
                            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    )}
                </div>
                <div className="text-center py-2">
                    <div className="text-gray-200 font-bold text-lg mb-1">No High-Prob Setup</div>

                    {data && data.strike > 0 && (
                        <div className="flex flex-col items-center gap-1 mb-3">
                            <div className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Intended Alpha Play</div>
                            <div className="text-white font-mono text-base bg-gray-900/50 px-3 py-1 rounded border border-gray-700/50">
                                ${data.strike} <span className="text-gray-400 text-xs">Strike</span>
                            </div>
                            <div className="text-[9px] text-blue-400/80 font-medium italic mt-1 bg-blue-500/5 px-2 py-0.5 rounded border border-blue-500/10">
                                <span className="opacity-60">Logic:</span> Price ± (0.5 × ATR) → Rounded | <span className="text-white font-bold">{data.dte} DTE</span>
                            </div>
                        </div>
                    )}

                    {data && data.reason && (
                        <p className="text-[11px] text-gray-300 px-4 leading-relaxed mb-4">
                            {data.reason}
                        </p>
                    )}

                    <div className="">
                        <span className="text-[10px] text-blue-400 font-bold bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20 animate-pulse">
                            Monitoring Liquidity...
                        </span>
                    </div>
                </div>
                <div className="mt-4 pt-2 border-t border-gray-700/30 flex justify-end">
                    <DataSourceIndicator source="Schwab / AI" />
                </div>
            </div>
        );
    }

    const isCall = data.type === 'CALL';
    const color = isCall ? 'text-green-400' : 'text-red-400';
    const bg = isCall ? 'bg-green-500' : 'bg-red-500';
    const border = isCall ? 'border-green-500/30' : 'border-red-500/30';

    const renderDetailCard = () => {
        if (!activeDetail) return null;

        const details = {
            tech: { title: 'Technical Analysis', items: data.technicalDetails || [], color: 'text-emerald-400', icon: <TrendingUp className="w-4 h-4" /> },
            fund: { title: 'Fundamental Check', items: data.fundamentalDetails || [], color: 'text-blue-400', icon: <Shield className="w-4 h-4" /> },
            social: { title: 'Sentiment Analysis', items: data.socialDetails || [], color: 'text-purple-400', icon: <TrendingDown className="w-4 h-4" /> }
        }[activeDetail];

        return (
            <div className="absolute inset-x-2 top-2 bottom-2 bg-gray-900/95 backdrop-blur-md rounded-xl border border-gray-700 z-50 flex flex-col p-4 animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <span className={details.color}>{details.icon}</span>
                        <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">{details.title}</h4>
                    </div>
                    <button
                        onClick={() => setActiveDetail(null)}
                        className="p-1 hover:bg-gray-800 rounded-lg transition-colors border border-gray-700/50"
                    >
                        <X className="w-4 h-4 text-gray-200" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {details.items.length > 0 ? (
                        details.items.map((item, i) => (
                            <div key={i} className="flex items-start gap-2 bg-gray-800/50 p-2 rounded border border-gray-700/30">
                                <div className={`w-1 h-1 rounded-full mt-1.5 ${details.color.replace('text', 'bg')}`}></div>
                                <span className="text-[11px] text-gray-100 font-medium leading-tight">{item}</span>
                            </div>
                        ))
                    ) : (
                        <div className="text-[10px] text-gray-200 italic py-2">No detailed factors captured for this signal.</div>
                    )}
                </div>
                <div className="mt-3 text-[9px] text-gray-300 text-center uppercase tracking-widest font-bold">
                    AI Analysis Result
                </div>
            </div>
        );
    };

    // Calculate segmented confidence widths
    const baseScore = 50;
    const techMax = 15;
    const fundMax = 9;
    const socMax = 6;
    
    // Reverse calculate rough contributions to the total confidence score
    // This is approximate for visual purposes based on confirmations
    const totalConfs = (data.technicalConfirmations || 0) + (data.fundamentalConfirmations || 0) + (data.socialConfirmations || 0) || 1;
    const extraConf = data.confidence - baseScore;
    
    // Distribute extra confidence proportionally based on confirmations, guaranteeing a minimum visual size if present
    const techCont = (data.technicalConfirmations || 0) > 0 ? Math.max(2, (data.technicalConfirmations || 0) / totalConfs * extraConf) : 0;
    const fundCont = (data.fundamentalConfirmations || 0) > 0 ? Math.max(2, (data.fundamentalConfirmations || 0) / totalConfs * extraConf) : 0;
    const socCont = (data.socialConfirmations || 0) > 0 ? Math.max(2, (data.socialConfirmations || 0) / totalConfs * extraConf) : 0;
    
    // Remaining chunk from PCR/Volume bonuses
    const bonusCont = Math.max(0, extraConf - techCont - fundCont - socCont);

    return (
        <div className={`bg-gray-900/80 backdrop-blur-md rounded-2xl p-5 border shadow-xl ${border} mb-4 relative overflow-hidden group hover:shadow-[0_0_30px_-5px_var(--tw-shadow-color)] ${isCall ? 'shadow-emerald-900/20' : 'shadow-rose-900/20'} transition-all duration-500`}>
            {/* Detail Card Overlay */}
            {renderDetailCard()}

            {/* Premium Glow Effects */}
            <div className={`pointer-events-none absolute top-0 right-0 w-32 h-32 ${bg} opacity-10 blur-3xl -mr-10 -mt-10 rounded-full transition-opacity duration-1000 group-hover:opacity-20`}></div>
            <div className={`pointer-events-none absolute bottom-0 left-0 w-24 h-24 ${bg} opacity-5 blur-2xl -ml-10 -mb-10 rounded-full`}></div>

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <MousePointerClick className={`w-4 h-4 ${color}`} />
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-100">Options AI</span>
                    {onRefresh && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onRefresh(); }}
                            className="p-1 hover:bg-gray-700 rounded-md transition-colors text-gray-200 hover:text-white"
                            title="Refresh Signal"
                        >
                            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    )}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full bg-gray-700 ${color} font-bold`}>
                    {data.confidence}% Confidence
                </span>
                <button
                    onClick={(e) => { e.stopPropagation(); handleTrack(); }}
                    disabled={isTracked || isTrackLoading}
                    className={`ml-2 p-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${isTracked
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-gray-700/50 border-gray-600 hover:border-blue-500/50 hover:bg-gray-700 text-gray-300 hover:text-white'
                        }`}
                    title={isTracked ? "Tracked" : "Track Performance"}
                >
                    {isTrackLoading ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : isTracked ? (
                        <>
                            <Check className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase">Tracked</span>
                        </>
                    ) : (
                        <>
                            <Pin className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase">Track</span>
                        </>
                    )}
                </button>
            </div>

            {/* Signal Type & Strike */}
            <div className="flex justify-between items-end mb-3">
                <div>
                    <div className={`text-xl font-bold ${color} leading-none mb-1`}>
                        {data.type}
                    </div>
                    <div className="text-white font-mono text-sm flex items-center gap-2">
                        ${data.strike} <span className="text-gray-200 text-xs">Strike</span>
                        {data.contractPrice && (
                            <span className={`text-[10px] font-bold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/30 transition-colors duration-300 ${priceFlash === 'up' ? 'text-green-400 border-green-500/50' :
                                priceFlash === 'down' ? 'text-red-400 border-red-500/50' :
                                    'text-blue-400'
                                }`}>
                                @ ${data.contractPrice.toFixed(2)}
                            </span>
                        )}
                    </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1.5">
                    <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Target Expiry</div>
                    <div className="text-white text-sm font-semibold flex items-center gap-2">
                        {data.expiry}
                        <span className="text-[10px] text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20 shadow-sm shadow-blue-900/20">
                            {data.dte} DTE
                        </span>
                    </div>
                    <div className="flex gap-1.5 flex-wrap justify-end mt-0.5">
                        {data.isUnusual && (
                            <span className="text-[9px] font-bold uppercase bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30">
                                Vol Surge
                            </span>
                        )}
                        {data.rsi && (data.rsi > 70 || data.rsi < 30) && (
                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${data.rsi > 70 ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}>
                                {data.rsi > 70 ? 'Overbought' : 'Oversold'}
                            </span>
                        )}
                        {(() => {
                            const patternStr = data?.technicalDetails?.find(d => d.startsWith('Pattern:'));
                            if (patternStr) {
                                const match = patternStr.match(/Pattern:\s*(.+?)\s*\(/);
                                const name = match ? match[1] : patternStr.replace('Pattern: ', '');
                                const isBull = patternStr.includes('(Bullish)');
                                const isBear = patternStr.includes('(Bearish)');
                                return (
                                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${isBull ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : isBear ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30'
                                        }`}>
                                        {name}
                                    </span>
                                );
                            }
                            return null;
                        })()}
                    </div>
                </div>
            </div>

            {/* Strategy Badge */}
            {data?.strategy && (
                <div className="mb-4">
                    <span className={`text-[10px] px-2.5 py-1 rounded-md ${isCall ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'} font-bold uppercase tracking-widest shadow-sm`}>
                        {data.strategy}
                    </span>
                </div>
            )}

            {/* Segmented Confidence Bar */}
            <div className="mb-5">
                <div className="flex justify-between items-end mb-1.5 px-0.5">
                    <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">AI Signal Confidence</span>
                    <span className="text-xs font-bold text-white">{data.confidence}%</span>
                </div>
                <div className="w-full bg-gray-800 h-2 rounded-full flex overflow-hidden border border-gray-700/50 shadow-inner">
                    {/* Base Score (50) */}
                    <div className="h-full bg-gray-600 transition-all duration-1000 ease-out" style={{ width: `${(baseScore / 100) * 100}%` }} title="Base Model Baseline (50%)" />
                    {/* Technical (Green/Red) */}
                    <div className={`h-full ${isCall ? 'bg-emerald-400' : 'bg-rose-400'} opacity-90 transition-all duration-1000 ease-out delay-100`} style={{ width: `${techCont}%` }} title="Technical Edge" />
                    {/* Fundamental (Blue) */}
                    <div className="h-full bg-blue-400 opacity-90 transition-all duration-1000 ease-out delay-200" style={{ width: `${fundCont}%` }} title="Fundamental Edge" />
                    {/* Social (Purple) */}
                    <div className="h-full bg-purple-400 opacity-90 transition-all duration-1000 ease-out delay-300" style={{ width: `${socCont}%` }} title="Sentiment Edge" />
                    {/* Flow/Bonus (Yellow) */}
                    <div className="h-full bg-amber-400 opacity-90 transition-all duration-1000 ease-out delay-500" style={{ width: `${bonusCont}%` }} title="Options Flow Bonus" />
                </div>
                <div className="flex justify-between px-1 mt-1 lg:hidden">
                    <div className="flex items-center gap-1.5 text-[8px] text-gray-400 uppercase font-medium">
                        <div className={`w-1.5 h-1.5 rounded-full ${isCall ? 'bg-emerald-400' : 'bg-rose-400'}`}></div> Tech
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 ml-1"></div> Fund
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-400 ml-1"></div> Sent
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 ml-1"></div> Flow
                    </div>
                </div>
            </div>

            {/* Data Row: Core Metrics & Greeks */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {/* Implied Volatility */}
                <div className="bg-gray-800/60 rounded-lg p-2 border border-gray-700/40 flex flex-col justify-center text-center backdrop-blur-sm">
                    <div className="text-[9px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">Implied Vol (IV)</div>
                    <div className={`text-xs font-mono font-bold ${(data.iv || 0) > 0.6 ? 'text-rose-400' : (data.iv || 0) > 0.4 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {data.iv ? `${(data.iv * 100).toFixed(1)}%` : '---'}
                    </div>
                </div>

                {/* Probability ITM (Delta proxy) */}
                <div className="bg-gray-800/60 rounded-lg p-2 border border-gray-700/40 flex flex-col justify-center text-center backdrop-blur-sm">
                    <div className="text-[9px] text-gray-400 uppercase font-bold tracking-wider mb-0.5 flex items-center justify-center gap-1">
                        Prob. ITM <span className="text-[8px] text-gray-500 font-normal normal-case">(Δ{(data.probabilityITM || 0).toFixed(2)})</span>
                    </div>
                    <div className={`text-xs font-mono font-bold ${(data.probabilityITM || 0) > 0.40 ? 'text-emerald-400' : (data.probabilityITM || 0) < 0.25 ? 'text-amber-400' : 'text-blue-400'}`}>
                        {data.probabilityITM ? `${(data.probabilityITM * 100).toFixed(1)}%` : '---'}
                    </div>
                </div>

                {/* Volume Profile */}
                <div className="bg-gray-800/60 rounded-lg p-2 border border-gray-700/40 flex flex-col justify-center text-center backdrop-blur-sm col-span-2 sm:col-span-2">
                    <div className="text-[9px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">Liquidity Profile</div>
                    <div className="flex items-center justify-center gap-2">
                        <span className="text-xs font-mono font-bold text-white" title="Volume">
                            {data.volume ? (data.volume > 1000 ? `${(data.volume / 1000).toFixed(1)}k` : data.volume) : '---'} <span className="text-[9px] text-gray-500 ml-0.5">Vol</span>
                        </span>
                        <span className="text-gray-600">/</span>
                        <span className="text-xs font-mono font-bold text-gray-300" title="Open Interest">
                            {data.openInterest ? (data.openInterest > 1000 ? `${(data.openInterest / 1000).toFixed(1)}k` : data.openInterest) : '---'} <span className="text-[9px] text-gray-500 ml-0.5">OI</span>
                        </span>
                    </div>
                </div>
            </div>

            {/* Confirmations Section - Glass Look */}
            <div className="bg-gray-800/40 backdrop-blur-md rounded-xl p-3 border border-gray-700/50 mb-5 shadow-inner">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-bold text-gray-200 tracking-wider">Confluence Analysis</span>
                    <span className="text-[10px] font-mono text-blue-400 font-bold">{(data.technicalConfirmations || 0) + (data.fundamentalConfirmations || 0) + (data.socialConfirmations || 0)} Factors</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                        onClick={() => setActiveDetail('tech')}
                        className={`text-center bg-gray-800/30 rounded-md p-1.5 border border-gray-700/20 hover:bg-gray-700/30 transition-all ${isCall ? 'hover:border-emerald-500/50' : 'hover:border-red-500/50'}`}
                    >
                        <div className="text-[9px] font-bold text-gray-200 uppercase mb-1">Technical</div>
                        <div className={`text-[10px] font-bold leading-tight ${data.technicalConfirmations && data.technicalConfirmations >= 3 ? (isCall ? 'text-emerald-400' : 'text-red-400') : 'text-gray-100'}`}>
                            {(data.technicalConfirmations || 0) >= 4 ? (isCall ? 'Overlapping' : 'Breakdown') : (data.technicalConfirmations || 0) >= 3 ? (isCall ? 'Bullish' : 'Bearish') : 'Neutral'}
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveDetail('fund')}
                        className="text-center bg-gray-800/30 rounded-md p-1.5 border border-gray-700/20 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all"
                    >
                        <div className="text-[9px] font-bold text-gray-200 uppercase mb-1">Fundamental</div>
                        <div className={`text-[10px] font-bold leading-tight ${data.fundamentalConfirmations && data.fundamentalConfirmations >= 1 ? 'text-blue-400' : 'text-gray-100'}`}>
                            {(data.fundamentalConfirmations || 0) >= 2 ? 'Strong Value' : (data.fundamentalConfirmations || 0) >= 1 ? 'Fair Value' : 'Mixed'}
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveDetail('social')}
                        className="text-center bg-gray-800/30 rounded-md p-1.5 border border-gray-700/20 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all"
                    >
                        <div className="text-[9px] font-bold text-gray-200 uppercase mb-1">Sentiment</div>
                        <div className={`text-[10px] font-bold leading-tight ${data.socialConfirmations && data.socialConfirmations >= 1 ? 'text-purple-400' : 'text-gray-100'}`}>
                            {(data.socialConfirmations || 0) >= 2 ? 'Viral Buzz' : (data.socialConfirmations || 0) >= 1 ? 'Positive' : 'Quiet'}
                        </div>
                    </button>
                </div>
            </div>

            {/* === TRADE EXECUTION PLAN === */}
            {data.entryPrice && (
                <div className="space-y-3 pt-4 border-t border-gray-700/50">
                    <div className="flex items-center gap-2 mb-1">
                        <Target className="w-4 h-4 text-amber-400" />
                        <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">Execution Plan</h4>
                    </div>

                    {/* Trade Plan Grid (Entry, Stop, Target) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Entry */}
                        <div className="flex flex-col bg-gray-800/80 rounded-xl p-3 border border-gray-600/50 shadow-md relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-8 h-8 bg-blue-500/10 rounded-bl-full"></div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <Crosshair className="w-3.5 h-3.5 text-blue-400" />
                                <span className="text-[10px] text-gray-300 uppercase font-bold tracking-wider">Underlying</span>
                            </div>
                            <div className="text-sm font-mono text-white font-bold tracking-tight">${data.entryPrice.toFixed(2)}</div>
                        </div>

                        {/* Stop Loss */}
                        <div className="flex flex-col bg-gray-800/80 rounded-xl p-3 border border-rose-900/50 shadow-md relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-8 h-8 bg-rose-500/10 rounded-bl-full"></div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <Shield className="w-3.5 h-3.5 text-rose-400" />
                                <span className="text-[10px] text-rose-300 uppercase font-bold tracking-wider">Hard Stop</span>
                            </div>
                            <div className="text-sm font-mono text-rose-400 font-bold tracking-tight">{data.stopLoss ? `$${data.stopLoss.toFixed(2)}` : '---'}</div>
                        </div>

                        {/* Target */}
                        <div className="flex flex-col bg-gray-800/80 rounded-xl p-3 border border-emerald-900/50 shadow-md relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-8 h-8 bg-emerald-500/10 rounded-bl-full"></div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-[10px] text-emerald-300 uppercase font-bold tracking-wider">Target</span>
                            </div>
                            <div className="text-sm font-mono text-emerald-400 font-bold tracking-tight">{data.takeProfit1 ? `$${data.takeProfit1.toFixed(2)}` : '---'}</div>
                        </div>
                    </div>

                    {/* Secondary Trade Info (Entry Condition & R:R) */}
                    <div className="flex items-center justify-between px-1 text-[10px]">
                        {data.entryCondition && (
                            <div className="flex items-center gap-1 text-gray-200">
                                <Zap className="w-3 h-3 text-yellow-400" />
                                <span>{data.entryCondition}</span>
                            </div>
                        )}
                        {data.riskReward && (
                            <div className="text-gray-200 border border-gray-700/50 px-1.5 rounded bg-gray-900/50">
                                R:R Target: <span className="text-yellow-400 font-bold">{data.riskReward}</span>
                            </div>
                        )}
                    </div>

                    {/* Max Loss Note */}
                    {data.maxLoss && (
                        <div className="flex items-start gap-1.5 pt-1">
                            <AlertCircle className="w-3.5 h-3.5 text-gray-100 mt-0.5 flex-shrink-0" />
                            <p className="text-[11px] text-gray-100 leading-tight">
                                Max loss: {data.maxLoss}. {data.reason}.
                            </p>
                        </div>
                    )}
                </div>
            )}
            <div className="mt-4 pt-2 border-t border-gray-700/30 flex justify-end">
                <DataSourceIndicator source="Schwab / AI" />
            </div>
        </div>
    );
}
