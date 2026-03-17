'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Database } from 'lucide-react';

interface LivePriceDisplayProps {
    symbol: string;
    fallbackPrice?: number;
    enabled?: boolean;
    showChange?: boolean;
    refreshKey?: number; // Parent-driven refresh trigger (synchronized 60s timer)
    className?: string;
    displayMode?: 'auto' | 'regular' | 'extended'; // Force which price to show
    showStatusBadge?: boolean; // When true, renders a market session badge alongside the price
}

interface PriceData {
    price: number;
    regularMarketPrice?: number;
    change: number;
    changePercent: number;
    regularMarketChange?: number;
    regularMarketChangePercent?: number;
    marketSession?: 'PRE' | 'REG' | 'POST' | 'OFF';
    source?: string;
}

export default function LivePriceDisplay({ symbol, fallbackPrice, enabled = true, showChange = false, refreshKey, className, displayMode = 'auto', showStatusBadge = false }: LivePriceDisplayProps) {
    const [priceData, setPriceData] = useState<PriceData | null>(null);
    const [isLive, setIsLive] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [priceFlash, setPriceFlash] = useState<'up' | 'down' | null>(null);

    const fetchLivePrice = useCallback(async () => {
        if (!enabled || !symbol) return;

        try {
            const res = await fetch(`/api/live-price?symbol=${symbol}`, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                if (data.price !== null && data.price !== undefined) {
                    const isSessionLive = data.marketSession === 'REG';
                    let latestPrice = data.price;
                    let latestChange = data.change;
                    let latestChangePercent = data.changePercent;

                    if (displayMode === 'regular') {
                        // STRICTLY show regular market hours price
                        // If regularMarketPrice is missing (e.g. timeout), fall back to the 4PM close (fallbackPrice) instead of live extended hours (data.price).
                        latestPrice = data.regularMarketPrice || fallbackPrice || data.price;
                        latestChange = data.regularMarketChange || data.change;
                        latestChangePercent = data.regularMarketChangePercent || data.changePercent;
                    } else if (displayMode === 'extended') {
                        // STRICTLY show extended hours price if available
                        latestPrice = isSessionLive ? data.price : (data.preMarketPrice || data.postMarketPrice || data.price);
                        latestChange = isSessionLive ? data.change : (data.preMarketChange || data.postMarketChange || data.change);
                        latestChangePercent = isSessionLive ? data.changePercent : (data.preMarketChangePercent || data.postMarketChangePercent || data.changePercent);
                    } else {
                        // 'auto' mode - default behavior
                        latestPrice = isSessionLive ? data.price : (data.regularMarketPrice || fallbackPrice || data.price);
                        latestChange = isSessionLive ? data.change : (data.regularMarketChange || data.change);
                        latestChangePercent = isSessionLive ? data.changePercent : (data.regularMarketChangePercent || data.changePercent);
                    }

                    // Detect price direction change for flash animation
                    if (priceData?.price) {
                        if (latestPrice > priceData.price) setPriceFlash('up');
                        else if (latestPrice < priceData.price) setPriceFlash('down');
                        else setPriceFlash(null);
                    }

                    setPriceData({
                        price: latestPrice,
                        regularMarketPrice: data.regularMarketPrice,
                        change: latestChange,
                        changePercent: latestChangePercent,
                        regularMarketChange: data.regularMarketChange,
                        regularMarketChangePercent: data.regularMarketChangePercent,
                        marketSession: data.marketSession,
                        source: data.source
                    });
                    setIsLive(isSessionLive);
                    setLastUpdate(new Date());

                    // Clear flash after animation
                    setTimeout(() => setPriceFlash(null), 1000);
                } else {
                    setIsLive(false);
                }
            } else {
                console.error(`[LivePriceDisplay] Fetch failed for ${symbol}: Status ${res.status}`);
            }
        } catch (e) {
            console.error('Error fetching live price:', e);
            setIsLive(false);
        }
    }, [symbol, enabled, priceData?.price]);

    // Fetch on mount + whenever parent's refreshKey changes (synchronized 60s timer)
    useEffect(() => {
        fetchLivePrice();
    }, [fetchLivePrice, refreshKey]); // Now depends on fetchLivePrice which depends on enabled

    // Reset when symbol changes
    // Reset when symbol changes
    // useEffect(() => {
    //     setPriceData(null);
    //     setIsLive(false);
    //     setLastUpdate(null);
    //     setPriceFlash(null);
    // }, [symbol]);

    const displayPrice = priceData?.price || fallbackPrice;
    const change = priceData?.change || 0;
    const changePercent = priceData?.changePercent || 0;
    const isPositive = change >= 0;

    if (!displayPrice) {
        return <span className="text-gray-200">--</span>;
    }

    const isOff = priceData?.marketSession === 'OFF';
    const isPost = priceData?.marketSession === 'POST' || priceData?.marketSession === 'PRE';

    if (className === 'status-badge-only') {
        return (
            <div className="flex flex-col items-end gap-2">
                {isLive ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-[10px] text-blue-400 font-bold uppercase tracking-wider animate-pulse">
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></span>
                        Live Feed Active
                    </div>
                ) : isPost ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-lg text-[10px] text-purple-400 font-bold uppercase tracking-wider">
                        {priceData?.marketSession === 'POST' ? 'After Hours' : 'Pre-Market'}
                    </div>
                ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/80 border border-gray-700/50 rounded-lg text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        Market Closed
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-3 ${className || ''}`}>
            {/* Price */}
            <span
                className={`text-2xl font-bold transition-colors duration-300 ${priceFlash === 'up' ? 'text-green-400' :
                    priceFlash === 'down' ? 'text-red-400' :
                        'text-white'
                    }`}
            >
                ${displayPrice.toFixed(2)}
            </span>

            {/* Change */}
            {(isLive || showChange) && (
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md ${isPositive ? 'bg-green-500/10' : 'bg-red-500/10'
                    }`}>
                    {isPositive ? (
                        <TrendingUp className="w-3 h-3 text-green-400" />
                    ) : (
                        <TrendingDown className="w-3 h-3 text-red-400" />
                    )}
                    <span className={`text-sm font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                        {isPositive ? '+' : ''}{change.toFixed(2)}
                    </span>
                    <span className={`text-sm font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                        ({isPositive ? '+' : ''}{changePercent.toFixed(2)}%)
                    </span>
                </div>
            )}

            {/* Session Indicator */}
            {isLive ? (
                <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    <span className="text-[10px] text-green-400 uppercase font-bold tracking-wider">Live</span>
                </div>
            ) : isPost ? (
                <span className="text-[10px] text-purple-400 uppercase font-bold tracking-wider px-2 py-1 rounded bg-purple-500/10 border border-purple-500/20">
                    {priceData?.marketSession === 'POST' ? 'After Hours' : 'Pre-Market'}
                </span>
            ) : (
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider px-2 py-1 rounded bg-gray-800/80 border border-gray-700/50">
                    Market Closed
                </span>
            )}


            {/* Source and Market Close Price */}
            <div className="flex flex-col gap-0.5 ml-1">
                {priceData?.source && (
                    <div className="flex items-center gap-1.5 opacity-60">
                        <Database className="w-2.5 h-2.5 text-blue-400" />
                        <span className="text-[10px] uppercase font-bold tracking-tight text-gray-300">
                            via {priceData.source}
                        </span>
                    </div>
                )}

                {/* Show Regular Close when in Extended Hours/Closed */}
                {!isLive && priceData?.regularMarketPrice && (
                    <div className="flex items-center gap-1.5 opacity-80">
                        <span className="text-[10px] uppercase font-bold tracking-tight text-gray-400">
                            Close: ${priceData.regularMarketPrice.toFixed(2)}
                        </span>
                    </div>
                )}
            </div>

            {/* Inline market session badge (when showStatusBadge=true — replaces the second LivePriceDisplay instance) */}
            {showStatusBadge && (
                <div className="flex flex-col items-end gap-2 ml-2">
                    {isLive ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-[10px] text-blue-400 font-bold uppercase tracking-wider animate-pulse">
                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></span>
                            Live Feed Active
                        </div>
                    ) : isPost ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-lg text-[10px] text-purple-400 font-bold uppercase tracking-wider">
                            {priceData?.marketSession === 'POST' ? 'After Hours' : 'Pre-Market'}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/80 border border-gray-700/50 rounded-lg text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                            Market Closed
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
