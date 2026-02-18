import React from 'react';
import { Flame, MessageSquare, TrendingUp, TrendingDown, Users, Globe } from 'lucide-react';

interface SocialPulseCardProps {
    stock: {
        symbol: string;
        name: string;
        sector?: string;
        price: number;
        change: number;
        heat: number;
        sentiment: number;
        mentions: number;
        retailBuyRatio: number;
        topPlatform: string;
        description: string;
    };
    onSelect?: (symbol: string) => void;
}

export default function SocialPulseCard({ stock, onSelect }: SocialPulseCardProps) {
    const isBullish = stock.sentiment > 0.5;
    const sentimentColor = stock.sentiment > 0.7 ? 'text-green-400' : stock.sentiment < 0.4 ? 'text-red-400' : 'text-yellow-400';
    const heatColor = stock.heat > 80 ? 'text-orange-500' : stock.heat > 50 ? 'text-yellow-500' : 'text-blue-400';
    const glowColor = stock.heat > 80 ? 'shadow-[0_0_20px_rgba(249,115,22,0.15)]' : '';

    return (
        <div
            onClick={() => onSelect?.(stock.symbol)}
            className={`bg-gray-800/40 border border-gray-700/50 rounded-2xl p-5 hover:border-orange-500/50 transition-all group relative overflow-hidden backdrop-blur-sm cursor-pointer hover:bg-gray-800/60 active:scale-[0.98] ${glowColor}`}
        >
            {/* Heat Glow Background */}
            <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full blur-3xl opacity-10 transition-colors ${stock.heat > 80 ? 'bg-orange-500' : 'bg-blue-500'}`}></div>

            {/* Header */}
            <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-2xl font-black text-white leading-none tracking-tighter flex items-center gap-2">
                            {stock.symbol}
                            {stock.heat > 85 && <Flame className="w-5 h-5 text-orange-500 animate-pulse" />}
                        </h3>
                        {stock.sector && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-gray-700 text-gray-300 border border-gray-600 uppercase tracking-widest truncate">
                                {stock.sector}
                            </span>
                        )}
                    </div>
                    <p className="text-[10px] text-gray-300 font-bold uppercase tracking-widest truncate max-w-[150px]">{stock.name}</p>
                </div>
                <div className="text-right ml-2 flex-shrink-0">
                    <div className="text-lg font-mono font-bold text-white">${stock.price.toFixed(2)}</div>
                    <div className={`text-xs font-bold ${stock.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}%
                    </div>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4 relative z-10">
                <div className="bg-gray-900/60 p-3 rounded-xl border border-gray-700/30">
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <Flame className={`w-3.5 h-3.5 ${heatColor}`} />
                        <span className="text-[10px] font-bold text-gray-200 uppercase tracking-wider">Social Heat</span>
                    </div>
                    <div className="flex items-end gap-2">
                        <span className={`text-xl font-black ${heatColor} leading-none`}>{stock.heat}</span>
                        <span className="text-[10px] text-gray-300 font-bold mb-0.5">/ 100</span>
                    </div>
                    {/* Heat Bar */}
                    <div className="w-full bg-gray-700 h-1 rounded-full mt-2 overflow-hidden">
                        <div
                            className={`h-full ${stock.heat > 80 ? 'bg-orange-500' : 'bg-blue-500'} transition-all duration-1000`}
                            style={{ width: `${stock.heat}%` }}
                        ></div>
                    </div>
                </div>

                <div className="bg-gray-900/60 p-3 rounded-xl border border-gray-700/30">
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <MessageSquare className={`w-3.5 h-3.5 ${sentimentColor}`} />
                        <span className="text-[10px] font-bold text-gray-200 uppercase tracking-wider">Sentiment</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className={`text-xs font-black uppercase ${sentimentColor}`}>
                            {stock.sentiment > 0.7 ? 'Bullish' : stock.sentiment < 0.4 ? 'Bearish' : 'Neutral'}
                        </span>
                        <span className="text-[10px] font-mono text-gray-200">{(stock.sentiment * 100).toFixed(0)}%</span>
                    </div>
                    {/* Sentiment Meter */}
                    <div className="w-full bg-gray-700 h-1 rounded-full mt-2 relative">
                        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-600 z-10"></div>
                        <div
                            className={`h-full ${sentimentColor.replace('text', 'bg')} transition-all duration-1000`}
                            style={{ width: `${stock.sentiment * 100}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {/* Detail Section */}
            <div className="space-y-3 mb-4 relative z-10">
                <div className="flex justify-between items-center px-1">
                    <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-[11px] font-medium text-gray-100">{stock.mentions.toLocaleString()} Mentions</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-gray-900/80 px-2 py-0.5 rounded-md border border-gray-700/50">
                        <Globe className="w-3 h-3 text-purple-400" />
                        <span className="text-[9px] font-bold text-purple-300 uppercase">{stock.topPlatform}</span>
                    </div>
                </div>

                <div className="bg-gray-900/40 p-3 rounded-xl border border-gray-700/20">
                    <p className="text-[11px] text-gray-200 leading-relaxed italic line-clamp-2">
                        "{stock.description}"
                    </p>
                </div>
            </div>

            {/* Retail vs Institutional Flow */}
            {(() => {
                const ratio = stock.retailBuyRatio;
                const sent = stock.sentiment;
                let flowLabel: string;
                let flowColor: string;
                let FlowIcon = TrendingUp;

                if (ratio > 0.7 && sent > 0.65) {
                    flowLabel = 'Buying Heavy';
                    flowColor = 'text-emerald-400';
                } else if (ratio > 0.55 || sent > 0.55) {
                    flowLabel = 'Leaning Bullish';
                    flowColor = 'text-green-300';
                } else if (ratio < 0.3 && sent < 0.35) {
                    flowLabel = 'Selling Heavy';
                    flowColor = 'text-red-400';
                    FlowIcon = TrendingDown;
                } else if (ratio < 0.45 || sent < 0.45) {
                    flowLabel = 'Leaning Bearish';
                    flowColor = 'text-red-300';
                    FlowIcon = TrendingDown;
                } else {
                    flowLabel = 'Mixed / Neutral';
                    flowColor = 'text-yellow-400';
                }

                return (
                    <div className="pt-3 border-t border-gray-700/30 flex justify-between items-center relative z-10">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Retail Flow</span>
                            <span className={`text-xs font-black uppercase tracking-tighter ${flowColor}`}>{flowLabel}</span>
                        </div>
                        <div className="flex -space-x-1.5">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="w-6 h-6 rounded-full border-2 border-gray-800 bg-gray-700 flex items-center justify-center overflow-hidden">
                                    <FlowIcon className={`w-3 h-3 ${flowColor}`} />
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
