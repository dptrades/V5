import React from 'react';
import Link from 'next/link';
import type { ConvictionStock } from '../types/stock';
import { TrendingUp, Users, BarChart3, PieChart, Info } from 'lucide-react';

interface Props {
    stock: ConvictionStock;
    onSelect?: (symbol: string) => void;
}

export default function ConvictionCard({ stock, onSelect }: Props) {
    // Color coding for score
    const getScoreColor = (s: number) => {
        if (s >= 80) return 'text-green-400';
        if (s >= 60) return 'text-blue-400';
        if (s >= 40) return 'text-yellow-400';
        return 'text-red-400';
    };

    const getBarColor = (s: number) => {
        if (s >= 80) return 'bg-green-500';
        if (s >= 60) return 'bg-blue-500';
        if (s >= 40) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    return (
        <div
            onClick={() => onSelect && onSelect(stock.symbol)}
            className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-gray-500 transition-all shadow-lg cursor-pointer transform hover:-translate-y-1"
        >
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Link href={`/?symbol=${stock.symbol}&market=stocks`} className="hover:underline cursor-pointer">
                            <h3 className="text-2xl font-bold text-white tracking-tight hover:text-blue-400 transition-colors">{stock.symbol}</h3>
                        </Link>
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

                <div className="text-center bg-gray-900 p-2 rounded-lg border border-gray-800">
                    <div className={`text-3xl font-bold ${getScoreColor(stock.score)}`}>{stock.score}</div>
                    <div className="text-[10px] text-gray-200 uppercase font-bold tracking-wider">Alpha Score</div>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                <ScoreBar label="Technicals" score={stock.technicalScore} icon={<TrendingUp className="w-3 h-3" />} />
                <ScoreBar label="Fundamentals" score={stock.fundamentalScore} icon={<PieChart className="w-3 h-3" />} />
                <ScoreBar label="Analyst Ratings" score={stock.analystScore} icon={<BarChart3 className="w-3 h-3" />} />
                <ScoreBar label="Social Sentiment" score={stock.sentimentScore} icon={<Users className="w-3 h-3" />} />
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
                    <span className="text-green-400 font-mono">
                        {stock.metrics.revenueGrowth ? `+${(stock.metrics.revenueGrowth * 100).toFixed(1)}%` : 'N/A'}
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
