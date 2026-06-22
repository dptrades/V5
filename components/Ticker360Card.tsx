import React from 'react';
import Link from 'next/link';
import { TrendingUp, Users, BarChart3, PieChart, Flame, MessageSquare, Globe, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import InfoPopover from './terminal/InfoPopover';

interface Props {
    stock: {
        symbol: string;
        name: string;
        price: number;
        change24h: number;
        sector?: string;
        
        // Conviction details (optional)
        score?: number;
        technicalScore?: number;
        fundamentalScore?: number;
        analystScore?: number;
        sentimentScore?: number;
        volume?: number;
        volumeDiff?: number;
        reasons?: string[];
        suggestedOption?: {
            strike: number;
            type: 'CALL' | 'PUT' | 'WAIT';
            expiry: string;
            reason: string;
        };
        metrics?: {
            pe?: number;
            revenueGrowth?: number;
            trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
            analystRating?: string;
        };

        // Social Pulse details (optional)
        heat?: number;
        mentions?: number;
        retailBuyRatio?: number;
        topPlatform?: string;
        description?: string;
    };
    onSelect?: (symbol: string) => void;
}

export default function Ticker360Card({ stock, onSelect }: Props) {
    const isBullish = stock.change24h >= 0;
    const hasSocial = stock.heat !== undefined;
    const hasConviction = stock.score !== undefined;

    // Color coding for score
    const getScoreColor = (s: number) => {
        if (s >= 80) return 'text-green-400';
        if (s >= 60) return 'text-blue-400';
        if (s >= 40) return 'text-yellow-400';
        return 'text-red-400';
    };

    const getHeatColor = (h: number) => {
        if (h >= 80) return 'text-orange-500';
        if (h >= 50) return 'text-yellow-500';
        return 'text-blue-400';
    };

    const getHeatBgColor = (h: number) => {
        if (h >= 80) return 'bg-orange-500/10 border-orange-500/20';
        if (h >= 50) return 'bg-yellow-500/10 border-yellow-500/20';
        return 'bg-blue-500/10 border-blue-500/20';
    };

    const getSentimentLabel = (score: number) => {
        if (score >= 70) return 'Bullish';
        if (score <= 40) return 'Bearish';
        return 'Neutral';
    };

    const getSentimentColor = (score: number) => {
        if (score >= 70) return 'text-green-400';
        if (score <= 40) return 'text-red-400';
        return 'text-yellow-400';
    };

    const isCallSuggested = stock.suggestedOption?.type === 'CALL';
    const isPutSuggested = stock.suggestedOption?.type === 'PUT';
    const flashClass = isCallSuggested
        ? 'animate-call-flash border-green-500/30'
        : isPutSuggested
        ? 'animate-put-flash border-red-500/30'
        : 'border-gray-700/50 hover:border-blue-500/50';

    return (
        <div
            onClick={() => onSelect?.(stock.symbol)}
            className={`bg-gray-800/40 border rounded-2xl p-5 hover:bg-gray-800/60 transition-all group relative overflow-hidden backdrop-blur-sm cursor-pointer hover:shadow-2xl active:scale-[0.99] transform hover:-translate-y-0.5 flex flex-col justify-between min-h-[460px] ${flashClass}`}
        >
            {/* Ambient background glow if hot */}
            {hasSocial && (stock.heat || 0) >= 80 && (
                <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full blur-3xl opacity-10 bg-orange-500 pointer-events-none"></div>
            )}

            <div>
                {/* Header */}
                <div className="flex justify-between items-start mb-4 relative z-10">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <Link href={`/?symbol=${stock.symbol}&market=stocks`} className="hover:underline cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                <h3 className="text-2xl font-black text-white leading-none tracking-tighter hover:text-blue-400 transition-colors flex items-center gap-1.5">
                                    {stock.symbol}
                                    {hasSocial && (stock.heat || 0) >= 85 && (
                                        <Flame className="w-5 h-5 text-orange-500 animate-pulse flex-shrink-0" />
                                    )}
                                </h3>
                            </Link>
                            {stock.sector && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-gray-700/60 text-gray-300 border border-gray-600 uppercase tracking-widest truncate max-w-[80px]">
                                    {stock.sector}
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] text-gray-300 font-bold uppercase tracking-widest truncate max-w-[170px]">{stock.name}</p>
                    </div>

                    <div className="text-right ml-2 flex-shrink-0">
                        <div className="text-lg font-mono font-bold text-white">${stock.price.toFixed(2)}</div>
                        <div className={`text-xs font-bold flex items-center justify-end gap-0.5 ${isBullish ? 'text-green-400' : 'text-red-400'}`}>
                            {isBullish ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                            {isBullish ? '+' : ''}{stock.change24h.toFixed(2)}%
                        </div>
                    </div>
                </div>

                {/* Score Panel Layout */}
                <div className="grid grid-cols-2 gap-3 mb-4 relative z-10">
                    {/* Alpha Score Block */}
                    <div className="bg-gray-900/50 p-2.5 rounded-xl border border-gray-800/80 text-center flex flex-col justify-center min-h-[64px]">
                        {hasConviction ? (
                            <>
                                <div className={`text-2xl font-black leading-none ${getScoreColor(stock.score || 0)}`}>
                                    {stock.score}
                                </div>
                                <span className="text-[8px] text-gray-400 uppercase font-black tracking-wider mt-1 block">Alpha Score</span>
                            </>
                        ) : (
                            <>
                                <div className="text-gray-500 text-sm font-bold">N/A</div>
                                <span className="text-[8px] text-gray-400 uppercase tracking-wider mt-1 block">No Conviction</span>
                            </>
                        )}
                    </div>

                    {/* Social Heat Block */}
                    <div className="bg-gray-900/50 p-2.5 rounded-xl border border-gray-800/80 text-center flex flex-col justify-center min-h-[64px]">
                        {hasSocial ? (
                            <>
                                <div className={`text-2xl font-black leading-none flex items-center justify-center gap-1 ${getHeatColor(stock.heat || 0)}`}>
                                    {stock.heat}
                                    {(stock.heat || 0) >= 80 && <Flame className="w-4 h-4 text-orange-500 flex-shrink-0" />}
                                </div>
                                <span className="text-[8px] text-gray-400 uppercase font-black tracking-wider mt-1 block">Social Heat</span>
                            </>
                        ) : (
                            <>
                                <div className="text-gray-500 text-sm font-bold">N/A</div>
                                <span className="text-[8px] text-gray-400 uppercase tracking-wider mt-1 block">No Social Heat</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Blended Metrics Grid */}
                <div className="grid grid-cols-2 gap-3 mb-4 relative z-10">
                    {/* Technical & Fundamental scoring */}
                    <div className="space-y-2.5">
                        <MiniScoreBar label="Tech" score={stock.technicalScore} icon={<TrendingUp className="w-3 h-3 text-blue-400" />} />
                        <MiniScoreBar label="Fund" score={stock.fundamentalScore} icon={<PieChart className="w-3 h-3 text-emerald-400" />} />
                        <MiniScoreBar label="Analyst" score={stock.analystScore} icon={<BarChart3 className="w-3 h-3 text-purple-400" />} />
                    </div>

                    {/* Social Sentiment & Signals */}
                    <div className="bg-gray-900/40 p-2.5 rounded-xl border border-gray-800/50 flex flex-col justify-between text-xs min-h-[92px]">
                        <div>
                            <div className="flex justify-between items-center mb-1 text-[10px] uppercase font-bold text-gray-300">
                                <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3 text-yellow-400" /> Sent</span>
                                <span className={getSentimentColor(stock.sentimentScore || 50)}>
                                    {getSentimentLabel(stock.sentimentScore || 50)}
                                </span>
                            </div>
                            <div className="h-1 bg-gray-700 rounded-full overflow-hidden w-full">
                                <div
                                    className={`h-full ${getSentimentColor(stock.sentimentScore || 50).replace('text', 'bg')} transition-all duration-500`}
                                    style={{ width: `${stock.sentimentScore || 50}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="flex justify-between items-center text-[10px] pt-1 border-t border-gray-800/50 mt-1">
                            <span className="text-gray-400">Signals:</span>
                            <span className="font-mono text-white font-bold">{stock.mentions || 0}</span>
                        </div>
                    </div>
                </div>

                {/* Deep Dive Details */}
                <div className="bg-gray-900/50 rounded-xl p-3 text-[11px] space-y-1.5 mb-4 border border-gray-800/80 relative z-10">
                    <div className="flex justify-between">
                        <span className="text-gray-400">Trend / Flow</span>
                        <div className="flex items-center gap-1.5 font-bold">
                            <span className={stock.metrics?.trend === 'BULLISH' ? 'text-green-400' : stock.metrics?.trend === 'BEARISH' ? 'text-red-400' : 'text-gray-200'}>
                                {stock.metrics?.trend || 'NEUTRAL'}
                            </span>
                            {stock.retailBuyRatio !== undefined && (
                                <span className="text-[10px] px-1 bg-gray-800 border border-gray-700 rounded text-gray-300 font-mono">
                                    {(stock.retailBuyRatio * 100).toFixed(0)}% Buy
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-between">
                        <span className="text-gray-400">Valuation & Growth</span>
                        <span className="text-gray-200">
                            {stock.metrics?.pe ? `P/E ${stock.metrics.pe.toFixed(1)}` : 'P/E N/A'}
                            {stock.metrics?.revenueGrowth ? ` • YoY +${(stock.metrics.revenueGrowth * 100).toFixed(0)}%` : ''}
                        </span>
                    </div>

                    {stock.volume !== undefined && stock.volume > 0 && (
                        <div className="flex justify-between">
                            <span className="text-gray-400">Volume</span>
                            <div className="text-right flex items-center gap-1 font-mono">
                                <span className="text-white">{(stock.volume / 1000000).toFixed(1)}M</span>
                                {stock.volumeDiff !== undefined && (
                                    <span className={`text-[9px] font-bold ${stock.volumeDiff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        ({stock.volumeDiff > 0 ? '+' : ''}{Math.round(stock.volumeDiff)}%)
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {stock.topPlatform && (
                        <div className="flex justify-between items-center text-[10px] pt-1.5 border-t border-gray-800/50">
                            <span className="text-gray-400">Top Social Platform</span>
                            <span className="flex items-center gap-1 text-purple-300 font-bold bg-purple-950/20 px-1.5 py-0.5 rounded border border-purple-500/10 uppercase">
                                <Globe className="w-2.5 h-2.5" />
                                {stock.topPlatform}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Section (Description & Suggested Option) */}
            <div className="relative z-10 flex-grow flex flex-col justify-end">
                {/* Description Headline */}
                {stock.description && (
                    <div className="bg-gray-900/30 p-2.5 rounded-lg border border-gray-800/30 mb-3 text-[10px] text-gray-300 leading-relaxed italic line-clamp-2">
                        "{stock.description}"
                    </div>
                )}

                {stock.suggestedOption ? (
                    <div className="pt-3 border-t border-gray-700/50">
                        <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1">
                                <span className="text-[9px] uppercase font-black tracking-wider text-purple-400 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse"></span>
                                    AI Option Play
                                </span>
                                <InfoPopover
                                    title="AI Option Play Rules"
                                    bullets={[
                                        "Direction: Confluence scores determine Calls vs Puts. If signals are mixed, ADX < 22 (chop), or earnings are < 7 days, it recommends WAIT.",
                                        "DTE Target: Snaps to monthly chain nearest 35 days (Normal IV) or 50 days (High IV > 45%) to reduce premium decay speed.",
                                        "Strike Target: Targets a 0.42 Delta (center of optimal 0.40-0.45 range) for balanced Probability of expiring In-The-Money (PoP).",
                                        "Liquidity Filters: Enforces min 250 Open Interest and 100 volume (25 off-hours) to guarantee tight spreads and execution.",
                                        "Distance Cap: Excludes strikes far away from spot price using a dynamic cap of min(20%, ATM IV * 25%)."
                                    ]}
                                />
                            </div>
                            <span className="text-[10px] text-gray-300 font-mono font-medium">
                                {stock.suggestedOption.type === 'WAIT' ? 'Standby' : stock.suggestedOption.expiry}
                            </span>
                        </div>
                        <div className="bg-gray-950 rounded-xl p-2.5 flex justify-between items-center border border-gray-800">
                            <div className="font-mono text-xs font-bold text-gray-100 flex-shrink-0">
                                {stock.suggestedOption.type === 'WAIT' ? (
                                    <span className="text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider text-[10px]">WAIT</span>
                                ) : (
                                    <>
                                        ${stock.suggestedOption.strike} <span className={stock.suggestedOption.type === 'CALL' ? 'text-green-400' : 'text-red-400'}>{stock.suggestedOption.type}</span>
                                    </>
                                )}
                            </div>
                            <div className="text-[9px] text-gray-400 italic line-clamp-1 ml-3 text-right">
                                {stock.suggestedOption.reason}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="pt-2 text-center text-[9px] text-gray-500 uppercase tracking-widest border-t border-gray-700/30">
                        No Option Suggestion Available
                    </div>
                )}
            </div>
        </div>
    );
}

function MiniScoreBar({ label, score, icon }: { label: string, score: number | undefined, icon: React.ReactNode }) {
    const getBarColor = (s: number) => {
        if (s >= 75) return 'bg-green-500';
        if (s >= 50) return 'bg-blue-500';
        if (s >= 30) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    const hasScore = score !== undefined;

    return (
        <div>
            <div className="flex justify-between items-center mb-0.5 text-[10px]">
                <span className="text-gray-300 flex items-center gap-1">{icon} {label}</span>
                <span className="text-gray-200 font-mono font-bold">{hasScore ? score : '—'}</span>
            </div>
            <div className="h-1 bg-gray-700 rounded-full overflow-hidden w-full">
                {hasScore && (
                    <div
                        className={`h-full ${getBarColor(score)} rounded-full transition-all duration-500`}
                        style={{ width: `${score}%` }}
                    ></div>
                )}
            </div>
        </div>
    );
}
