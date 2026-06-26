import React, { useState } from 'react';
import type { ConvictionStock } from '../types/stock';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

interface Props {
    pick: ConvictionStock;
    index: number;
    onSelect?: (symbol: string) => void;
}

export default function PicksCard({ pick, index, onSelect }: Props) {
    const [isExpanded, setIsExpanded] = useState(false);

    const isCall = pick.suggestedOption?.type === 'CALL';
    const isPut = pick.suggestedOption?.type === 'PUT';
    const cardBg = isCall ? 'bg-green-800' : isPut ? 'bg-red-800' : 'bg-gray-800';
    const cardBorder = isCall ? 'border-green-500 hover:border-green-400' : isPut ? 'border-red-500 hover:border-red-400' : 'border-gray-700 hover:border-blue-500';

    const handleSelect = (e: React.MouseEvent) => {
        e.stopPropagation(); // Avoid triggering expansion toggling
        if (onSelect) {
            onSelect(pick.symbol);
        }
    };

    const getScoreColor = (s: number) => {
        if (s >= 80) return 'text-green-400';
        if (s >= 60) return 'text-blue-400';
        if (s >= 40) return 'text-yellow-400';
        return 'text-red-400';
    };

    // Collapsed View
    if (!isExpanded) {
        return (
            <div
                onClick={() => setIsExpanded(true)}
                className={`${cardBg} border ${cardBorder} rounded-xl p-4 transition-all shadow-md cursor-pointer hover:brightness-105 flex flex-col gap-3 w-full relative overflow-hidden`}
            >
                {/* Rank indicator */}
                <div className="absolute top-0 left-0 bg-gray-900/60 text-gray-300 text-[9px] font-mono font-bold px-2 py-0.5 rounded-br-lg border-b border-r border-gray-700/50">
                    #{index + 1}
                </div>

                {/* Top Row: Ticker, Sector, Score, Chevron */}
                <div className="flex justify-between items-center w-full pl-3 mt-1">
                    <div className="flex items-center gap-2 min-w-0">
                        <div 
                            onClick={handleSelect}
                            className="flex items-center gap-1 bg-gray-900/80 hover:bg-blue-600/30 px-2 py-0.5 rounded border border-gray-700/50 transition-all group shrink-0"
                            title="Go to Live Dashboard"
                        >
                            <span className="text-base font-bold text-white tracking-tight group-hover:text-blue-400 transition-colors">{pick.symbol}</span>
                            <ExternalLink className="w-3 h-3 text-gray-400 group-hover:text-blue-400 shrink-0" />
                        </div>
                        <span className="text-[9px] text-gray-300 bg-gray-900/40 px-1.5 py-0.5 rounded border border-gray-800 uppercase tracking-wider truncate max-w-[100px]">
                            {pick.sector || 'Stock'}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono font-bold ${getScoreColor(pick.score)} bg-gray-900/60 px-2 py-0.5 rounded border border-gray-800`}>
                            {pick.score} <span className="text-[8px] text-gray-400 uppercase font-bold ml-0.5">Win</span>
                        </span>
                        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    </div>
                </div>

                {/* Bottom Row: Price, Change, Trend Signal */}
                <div className="flex justify-between items-center w-full pl-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-white">${pick.price?.toFixed(2) ?? 'N/A'}</span>
                        <span className={`text-[10px] font-bold ${pick.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {pick.change24h > 0 ? '+' : ''}{pick.change24h?.toFixed(2) ?? '0.00'}%
                        </span>
                    </div>

                    <div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${pick.metrics.trend === 'BULLISH' ? 'bg-green-900/40 text-green-400 border border-green-500/20' : 'bg-red-900/40 text-red-400 border border-red-500/20'}`}>
                            {pick.metrics.trend}
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    // Expanded View
    return (
        <div
            onClick={() => setIsExpanded(false)}
            className={`${cardBg} rounded-xl border ${cardBorder} transition-all shadow-lg relative overflow-hidden cursor-pointer`}
        >
            {/* Rank Badge */}
            <div className="absolute top-0 right-0 bg-gray-700 text-gray-200 text-xs font-bold px-3 py-1 rounded-bl-xl border-b border-l border-gray-600">
                #{index + 1}
            </div>

            <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div 
                                onClick={handleSelect}
                                className="flex items-center gap-1 hover:underline cursor-pointer group"
                                title="Go to Live Dashboard"
                            >
                                <h3 className="text-2xl font-bold text-white tracking-tight group-hover:text-blue-400 transition-colors">{pick.symbol}</h3>
                                <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-400" />
                            </div>
                            <span className="text-[10px] text-gray-100 bg-gray-700/50 px-2 py-0.5 rounded border border-gray-600 uppercase tracking-widest leading-normal">
                                {pick.sector || 'Stock'}
                            </span>
                        </div>
                        <p className="text-xs text-gray-100 mb-2 truncate max-w-[170px]">{pick.name}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${pick.metrics.trend === 'BULLISH' ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
                            {pick.metrics.trend}
                        </span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <div className="text-right bg-gray-900/55 p-2 rounded-lg border border-gray-700/50 min-w-16">
                            <div className="text-2xl font-mono font-bold text-blue-400">{pick.score}</div>
                            <div className="text-[10px] text-gray-200 uppercase font-bold tracking-wider">Win Prob</div>
                        </div>
                        <div className="p-1.5 bg-gray-900/50 hover:bg-gray-700 rounded-lg text-gray-400 transition-colors">
                            <ChevronUp className="w-5 h-5 text-gray-400 hover:text-white" />
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center mb-4 text-sm font-mono text-gray-200 bg-gray-900 p-2 rounded">
                    <span>${pick.price.toFixed(2)}</span>
                    <span className={pick.change24h >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {pick.change24h > 0 ? '+' : ''}{pick.change24h.toFixed(2)}%
                    </span>
                </div>

                <div className="space-y-2 mb-4">
                    <p className="text-[10px] text-gray-200 uppercase tracking-wider mb-1">Key Signals</p>
                    {pick.reasons.map((reason, i) => (
                        <div key={i} className="flex items-center text-xs text-gray-200">
                            <svg className="w-3 h-3 text-blue-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                            {reason}
                        </div>
                    ))}
                </div>

                {/* Option Strategy Badge */}
                {pick.suggestedOption && (
                    <div className="mb-4 bg-gray-900 bg-opacity-50 rounded-lg p-3 border border-gray-700">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-gray-100 font-bold uppercase tracking-wider flex items-center">
                                <svg className="w-3 h-3 mr-1 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Suggested Play
                            </span>
                            <span className="text-[10px] text-gray-200">Swing (30-45d)</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <div className="text-sm font-mono font-bold text-white">
                                <span className="text-gray-100 mr-1">{pick.suggestedOption.expiry}</span>
                                ${pick.suggestedOption.strike}
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${pick.suggestedOption.type === 'CALL' ? 'bg-blue-900 text-blue-300' : 'bg-orange-900 text-orange-300'}`}>
                                {pick.suggestedOption.type}
                            </span>
                        </div>
                    </div>
                )}

                <div className="pt-4 border-t border-gray-700 grid grid-cols-2 gap-4 text-xs">
                    <div>
                        <span className="text-gray-200 block mb-1">RSI (14)</span>
                        <span className={`font-mono px-2 py-0.5 rounded ${pick.metrics.rsi > 70 ? 'bg-red-900 text-red-200' : pick.metrics.rsi < 30 ? 'bg-green-900 text-green-200' : 'bg-gray-700 text-white'}`}>
                            {pick.metrics.rsi.toFixed(1)}
                        </span>
                    </div>
                    <div className="text-right">
                        <span className="text-gray-200 block mb-1">Volume</span>
                        <span className="font-mono text-white block">
                            {(pick.volume / 1000000).toFixed(1)}M
                        </span>
                        {pick.volumeDiff !== undefined && (
                            <span className={`text-[10px] font-bold ${pick.volumeDiff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {pick.volumeDiff > 0 ? '+' : ''}{Math.round(pick.volumeDiff)}% vs 1y
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
