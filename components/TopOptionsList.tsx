"use client";

import { useState, useEffect } from 'react';
import { Target, TrendingUp, TrendingDown, Clock, Shield, Zap, ChevronRight, Pin, Check, RefreshCw } from 'lucide-react';
import DataSourceIndicator from './ui/DataSourceIndicator';
import { OptionRecommendation } from '../lib/options';

interface TopOptionsListProps {
    options: OptionRecommendation[];
    symbol: string;
    loading?: boolean;
    companyName?: string;
    underlyingPrice?: number;
}

export default function TopOptionsList({ options, symbol, loading, companyName, underlyingPrice }: TopOptionsListProps) {
    const [priceFlashes, setPriceFlashes] = useState<Record<string, 'up' | 'down' | null>>({});
    const [prevPrices, setPrevPrices] = useState<Record<string, number>>({});
    const [trackedSymbols, setTrackedSymbols] = useState<Record<string, boolean>>({});
    const [trackLoading, setTrackLoading] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const newFlashes: Record<string, 'up' | 'down' | null> = { ...priceFlashes };
        const newPrevPrices: Record<string, number> = { ...prevPrices };
        let hasChanges = false;

        options.forEach((opt) => {
            const key = opt.symbol || `${opt.strike}-${opt.expiry}-${opt.type}`;
            if (opt.contractPrice !== undefined && prevPrices[key] !== undefined) {
                if (opt.contractPrice > prevPrices[key]) {
                    newFlashes[key] = 'up';
                    hasChanges = true;
                    setTimeout(() => {
                        setPriceFlashes(prev => ({ ...prev, [key]: null }));
                    }, 1000);
                } else if (opt.contractPrice < prevPrices[key]) {
                    newFlashes[key] = 'down';
                    hasChanges = true;
                    setTimeout(() => {
                        setPriceFlashes(prev => ({ ...prev, [key]: null }));
                    }, 1000);
                }
            }
            if (opt.contractPrice !== undefined) {
                newPrevPrices[key] = opt.contractPrice;
            }
        });

        if (hasChanges) {
            setPriceFlashes(newFlashes);
        }
        setPrevPrices(newPrevPrices);
    }, [options]);

    const handleTrack = async (option: OptionRecommendation) => {
        if (!option.symbol) return;
        const key = option.symbol;
        setTrackLoading(prev => ({ ...prev, [key]: true }));
        try {
            const res = await fetch('/api/options/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    option,
                    companyName: companyName || symbol,
                    underlyingPrice: underlyingPrice || option.entryPrice
                })
            });
            if (res.ok) {
                setTrackedSymbols(prev => ({ ...prev, [key]: true }));
            }
        } catch (e) {
            console.error('Failed to track option:', e);
        } finally {
            setTrackLoading(prev => ({ ...prev, [key]: false }));
        }
    };

    if (loading) {
        return (
            <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-5 mb-6 backdrop-blur-sm">
                <div className="flex items-center space-x-2 mb-4">
                    <div className="w-8 h-8 bg-gray-700 rounded-lg animate-pulse" />
                    <div className="w-48 h-6 bg-gray-700 rounded animate-pulse" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-gray-900/40 border border-gray-700/30 rounded-lg p-4 h-48 animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    if (!options || options.length === 0) {
        return (
            <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-8 mb-6 backdrop-blur-sm text-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="p-3 bg-gray-700/30 rounded-full">
                        <Shield className="w-8 h-8 text-gray-300" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-200">No High-Conviction Option Play</h3>
                    <p className="text-sm text-gray-300 max-w-sm mb-2">
                        Current liquidity and flow metrics do not justify a defensive or aggressive setup for {symbol} at this time.
                    </p>
                    <p className="text-xs text-blue-400 font-bold bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                        Refresh to get the latest data
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-5 mb-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-blue-500/20 rounded-lg">
                        <Zap className="w-5 h-5 text-blue-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white tracking-tight">Top High-Conviction Options</h3>
                </div>
                <span className="text-[10px] font-mono text-gray-200 uppercase tracking-widest bg-gray-900/50 px-2 py-0.5 rounded border border-gray-700">Live Feedback</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {options.map((opt, idx) => (
                    <div key={idx} className="bg-gray-900/40 border border-gray-700/30 rounded-lg p-4 hover:border-blue-500/30 transition-all group">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <div className="flex items-center space-x-2">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${opt.type === 'CALL' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                        {opt.type}
                                    </span>
                                    <span className="text-base font-mono text-white font-extrabold">${opt.strike}</span>
                                    {opt.contractPrice && (
                                        <span className={`text-xs font-mono border px-2 rounded bg-blue-500/10 font-bold transition-colors duration-300 ${priceFlashes[opt.symbol || `${opt.strike}-${opt.expiry}-${opt.type}`] === 'up' ? 'text-green-400 border-green-500/50' :
                                            priceFlashes[opt.symbol || `${opt.strike}-${opt.expiry}-${opt.type}`] === 'down' ? 'text-red-400 border-red-500/50' :
                                                'text-blue-400 border-blue-500/40'
                                            }`}>
                                            @ ${opt.contractPrice.toFixed(2)}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center space-x-3 mt-1.5">
                                    <div className="flex items-center space-x-1 text-gray-200">
                                        <Clock className="w-3.5 h-3.5 text-blue-400/80" />
                                        <span className="text-xs font-bold">{opt.expiry}</span>
                                    </div>
                                    {opt.expiry && (
                                        <span className="text-[10px] font-extrabold bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded border border-blue-500/20">
                                            {Math.ceil((new Date(opt.expiry).getTime() - new Date().getTime()) / (1000 * 3600 * 24))} DTE
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                {opt.isUnusual && (
                                    <span className="text-[8px] font-bold uppercase tracking-wider bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded border border-orange-500/30 animate-pulse">
                                        Unusual Vol
                                    </span>
                                )}
                                {opt.rsi && (opt.rsi > 70 || opt.rsi < 30) && (
                                    <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${opt.rsi > 70 ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}`}>
                                        {opt.rsi > 70 ? 'Overbought' : 'Oversold'}
                                    </span>
                                )}
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleTrack(opt); }}
                                    disabled={trackedSymbols[opt.symbol || ''] || trackLoading[opt.symbol || '']}
                                    className={`mt-1 p-1 rounded-md border transition-all flex items-center gap-1 ${trackedSymbols[opt.symbol || '']
                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                        : 'bg-gray-800/50 border-gray-700 hover:border-blue-500/50 text-gray-400 hover:text-white'
                                        }`}
                                    title={trackedSymbols[opt.symbol || ''] ? "Tracked" : "Track Performance"}
                                >
                                    {trackLoading[opt.symbol || ''] ? (
                                        <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                    ) : trackedSymbols[opt.symbol || ''] ? (
                                        <Check className="w-2.5 h-2.5" />
                                    ) : (
                                        <Pin className="w-2.5 h-2.5" />
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4">
                            <div className="flex justify-between text-xs py-0.5">
                                <span className="text-gray-100 font-medium">Volume</span>
                                <span className="text-blue-400 font-mono font-bold">{opt.volume?.toLocaleString() || '---'}</span>
                            </div>
                            <div className="flex justify-between text-xs py-0.5">
                                <span className="text-gray-100 font-medium">Open Int.</span>
                                <span className="text-gray-100 font-mono font-bold">{opt.openInterest?.toLocaleString() || '---'}</span>
                            </div>
                            <div className="flex justify-between text-xs py-0.5">
                                <span className="text-gray-100 font-medium">Implied Vol</span>
                                <span className={`font-mono font-extrabold ${(opt.iv || 0) > 0.5 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                                    {opt.iv ? `${(opt.iv * 100).toFixed(1)}%` : '---'}
                                </span>
                            </div>
                            <div className="flex justify-between text-xs py-0.5">
                                <span className="text-gray-100 font-medium">Prob. ITM</span>
                                <span className={`font-mono font-extrabold ${(opt.probabilityITM || 0) > 0.6 ? 'text-emerald-400' : (opt.probabilityITM || 0) < 0.3 ? 'text-red-400' : 'text-blue-400'}`}>
                                    {opt.probabilityITM ? `${(opt.probabilityITM * 100).toFixed(1)}%` : '---'}
                                </span>
                            </div>
                            <div className="flex justify-between text-xs py-0.5">
                                <span className="text-gray-100 font-medium">Strategy</span>
                                <span className="text-gray-100 font-bold italic truncate max-w-[85px] text-right">{opt.strategy}</span>
                            </div>
                        </div>

                        <div className="pt-3 border-t border-gray-700/50">
                            <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-mono">
                                <div className="bg-gray-800/50 p-1.5 rounded border border-gray-700/30">
                                    <div className="text-gray-200 mb-0.5">TP (1:2)</div>
                                    <div className="text-emerald-400 font-bold">{opt.takeProfit1 ? `$${opt.takeProfit1.toFixed(2)}` : '---'}</div>
                                </div>
                                <div className="bg-gray-800/50 p-1.5 rounded border border-gray-700/30">
                                    <div className="text-gray-200 mb-0.5">Stop Loss</div>
                                    <div className="text-rose-400 font-bold">{opt.stopLoss ? `$${opt.stopLoss.toFixed(2)}` : '---'}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-gray-700/50 pt-2 px-2">
                <p className="text-[10px] text-gray-200 max-w-md">
                    Targeting 1:2 Risk/Reward on premium. Calculated via Schwab Greeks.
                </p>
                <DataSourceIndicator source="Schwab / AI" />
            </div>
        </div >
    );
}
