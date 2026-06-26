import React, { useState } from 'react';
import type { ConvictionStock } from '../types/stock';
import { TrendingUp, Users, BarChart3, PieChart, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

interface Props {
    stock: ConvictionStock;
    onSelect?: (symbol: string) => void;
}

export default function ConvictionCard({ stock, onSelect }: Props) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Color coding for score
    const getScoreColor = (s: number) => {
        if (s >= 80) return 'text-green-400';
        if (s >= 60) return 'text-blue-400';
        if (s >= 40) return 'text-yellow-400';
        return 'text-red-400';
    };

    const isCall = stock.suggestedOption?.type === 'CALL';
    const isPut = stock.suggestedOption?.type === 'PUT';
    const cardBg = isCall ? 'bg-green-800' : isPut ? 'bg-red-800' : 'bg-gray-800';
    const cardBorder = isCall ? 'border-green-500 hover:border-green-400' : isPut ? 'border-red-500 hover:border-red-400' : 'border-gray-700 hover:border-gray-500';

    const handleSelect = (e: React.MouseEvent) => {
        e.stopPropagation(); // Avoid triggering expansion toggling
        if (onSelect) {
            onSelect(stock.symbol);
        }
    };

    // Collapsed View
    if (!isExpanded) {
        return (
            <div
                onClick={() => setIsExpanded(true)}
                className={`${cardBg} border ${cardBorder} rounded-xl p-4 transition-all shadow-md cursor-pointer hover:brightness-105 flex flex-col gap-3 w-full relative overflow-hidden`}
            >
                {/* Top Row: Ticker, Sector, Score, Chevron */}
                <div className="flex justify-between items-center w-full pl-3 mt-1">
                    <div className="flex items-center gap-2 min-w-0">
                        <div 
                            onClick={handleSelect}
                            className="flex items-center gap-1 bg-gray-900/80 hover:bg-blue-600/30 px-2 py-0.5 rounded border border-gray-700/50 transition-all group shrink-0"
                            title="Go to Live Dashboard"
                        >
                            <span className="text-base font-bold text-white tracking-tight group-hover:text-blue-400 transition-colors">{stock.symbol}</span>
                            <ExternalLink className="w-3 h-3 text-gray-400 group-hover:text-blue-400 shrink-0" />
                        </div>
                        <span className="text-[9px] text-gray-300 bg-gray-900/40 px-1.5 py-0.5 rounded border border-gray-800 uppercase tracking-wider truncate max-w-[100px]">
                            {stock.sector || 'Stock'}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono font-bold ${getScoreColor(stock.score)} bg-gray-900/60 px-2 py-0.5 rounded border border-gray-800`}>
                            {stock.score} <span className="text-[8px] text-gray-400 uppercase font-bold ml-0.5">Alpha</span>
                        </span>
                        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    </div>
                </div>

                {/* Bottom Row: Price, Change, Trend Signal */}
                <div className="flex justify-between items-center w-full pl-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-white">${stock.price?.toFixed(2) ?? 'N/A'}</span>
                        <span className={`text-[10px] font-bold ${stock.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {stock.change24h > 0 ? '+' : ''}{stock.change24h?.toFixed(2) ?? '0.00'}%
                        </span>
                    </div>

                    <div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${stock.metrics.trend === 'BULLISH' ? 'bg-green-900/40 text-green-400 border border-green-500/20' : 'bg-red-900/40 text-red-400 border border-red-500/20'}`}>
                            {stock.metrics.trend}
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    // Expanded View (Original detailed card layout)
    return (
        <div
            onClick={() => setIsExpanded(false)}
            className={`${cardBg} border ${cardBorder} rounded-xl p-5 transition-all shadow-lg cursor-pointer`}
        >
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div 
                            onClick={handleSelect}
                            className="flex items-center gap-1 hover:underline cursor-pointer group"
                            title="Go to Live Dashboard"
                        >
                            <h3 className="text-2xl font-bold text-white tracking-tight group-hover:text-blue-400 transition-colors">{stock.symbol}</h3>
                            <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-400" />
                        </div>
                        <span className="text-[10px] text-gray-100 bg-gray-700/50 px-2 py-0.5 rounded border border-gray-600 uppercase tracking-widest">{stock.sector || 'Stock'}</span>
                    </div>
                    <p className="text-xs text-gray-100 mb-2 truncate max-w-[180px]">{stock.name}</p>
                    <div className="flex items-baseline gap-3">
                        <div className="text-3xl font-mono text-white">
                            ${stock.price?.toFixed(2) ?? 'N/A'}
                        </div>
                        <div className={`text-sm font-bold px-2 py-0.5 rounded ${stock.change24h >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                            {stock.change24h > 0 ? '+' : ''}{stock.change24h?.toFixed(2) ?? '0.00'}%
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="text-center bg-gray-900 p-2 rounded-lg border border-gray-850">
                        <div className={`text-3xl font-bold ${getScoreColor(stock.score)}`}>{stock.score}</div>
                        <div className="text-[10px] text-gray-200 uppercase font-bold tracking-wider">Alpha Score</div>
                    </div>
                    <div className="p-1.5 bg-gray-900/50 hover:bg-gray-700 rounded-lg text-gray-400 transition-colors">
                        <ChevronUp className="w-5 h-5 text-gray-400 hover:text-white" />
                    </div>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                <ScoreBar label="Technicals" score={stock.technicalScore} icon={<TrendingUp className="w-3 h-3" />} />
                <ScoreBar label="Fundamentals" score={stock.fundamentalScore} icon={<PieChart className="w-3 h-3" />} />
                <ScoreBar label="Analyst Ratings" score={stock.analystScore} icon={<BarChart3 className="w-3 h-3" />} />
                <ScoreBar label="News Sentiment" score={stock.sentimentScore} icon={<Users className="w-3 h-3" />} />
            </div>

            {/* Deep Dive Details */}
            <div className="bg-gray-900/50 rounded-lg p-3 text-xs space-y-2 mb-4 border border-gray-800/50">
                <div className="flex justify-between">
                    <span className="text-gray-200">Trend Structure</span>
                    <span className={`font-mono font-bold ${stock.metrics.trend === 'BULLISH' ? 'text-green-400' : 'text-gray-200'}`}>
                        {stock.metrics.trend}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-200">P/E Ratio</span>
                    <span className="text-gray-200 font-mono">{stock.metrics.pe?.toFixed(1) || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-200">Rev Growth (YoY)</span>
                    <span className={`font-mono ${stock.metrics.revenueGrowth != null && stock.metrics.revenueGrowth < 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {stock.metrics.revenueGrowth != null ? `${stock.metrics.revenueGrowth >= 0 ? '+' : ''}${(stock.metrics.revenueGrowth * 100).toFixed(1)}%` : 'N/A'}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-200">Analyst View</span>
                    <span className="text-blue-300 font-bold">{stock.metrics.analystRating}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-200">Volume</span>
                    <div className="text-right">
                        <span className="text-white font-mono block">{(stock.volume / 1000000).toFixed(1)}M</span>
                        {stock.volumeDiff !== undefined && (
                            <span className={`text-[10px] font-bold block ${stock.volumeDiff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {stock.volumeDiff > 0 ? '+' : ''}{Math.round(stock.volumeDiff)}% vs 1y
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Reasons / Badges */}
            <div className="flex flex-wrap gap-2">
                {stock.reasons.map((r, i) => (
                    <span key={i} className="text-[10px] bg-blue-500/10 text-blue-300 px-2 py-1 rounded border border-blue-500/20">
                        {r}
                    </span>
                ))}
            </div>

            {/* Option Play Suggestion */}
            {stock.suggestedOption && (
                <div className="mt-4 pt-4 border-t border-gray-700/50">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-purple-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse"></span>
                            AI Option Play
                        </span>
                        <span className="text-xs text-gray-200">{stock.suggestedOption.expiry}</span>
                    </div>
                    <div className="bg-gray-900 rounded p-2 flex justify-between items-center border border-gray-800">
                        <div className="font-mono text-sm font-bold text-gray-100">
                            ${stock.suggestedOption.strike} <span className={stock.suggestedOption.type === 'CALL' ? 'text-green-400' : 'text-red-400'}>{stock.suggestedOption.type}</span>
                        </div>
                        <div className="text-[10px] text-gray-200 italic">
                            {stock.suggestedOption.reason}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ScoreBar({ label, score, icon }: { label: string, score: number, icon: any }) {
    const getColor = (s: number) => {
        if (s >= 75) return 'bg-green-500';
        if (s >= 50) return 'bg-blue-500';
        if (s >= 30) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-1 text-xs">
                <span className="text-gray-100 flex items-center gap-1">{icon} {label}</span>
                <span className="text-gray-200 font-mono">{score}</span>
            </div>
            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                    className={`h-full ${getColor(score)} rounded-full transition-all duration-500`}
                    style={{ width: `${score}%` }}
                ></div>
            </div>
        </div>
    );
}
