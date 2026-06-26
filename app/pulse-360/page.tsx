"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { Flame, MessageSquare, RefreshCw, X, ChevronRight, Activity, BarChart3, TrendingUp, HelpCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/Sidebar';
import Ticker360Card from '../../components/Ticker360Card';
import { Loading } from '../../components/ui/Loading';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { getMarketSession, getNextMarketOpen, isMarketActive } from '../../lib/refresh-utils';
import RefreshClock from '@/components/RefreshClock';
import BreakingNewsTicker from '../../components/BreakingNewsTicker';

const CACHE_KEY = 'pulse_360_results';
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

type SortKey = 'score' | 'heat' | 'change' | 'sentiment';
type FilterKey = 'ALL' | 'CALL' | 'PUT' | 'WAIT' | 'NONE';

export default function Pulse360Page() {
    const router = useRouter();

    // Sidebar Props (Standardized)
    const [symbol, setSymbol] = useState('TSLA');
    const [stockInput, setStockInput] = useState('TSLA');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const [stocks, setStocks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [countdown, setCountdown] = useState(900); // 15m
    const [error, setError] = useState('');
    const [showLogic, setShowLogic] = useState(false);
    const [sortKey, setSortKey] = useState<SortKey>('score');
    const [filterKey, setFilterKey] = useState<FilterKey>('ALL');

    // Persistence: Load sidebar state on mount
    useEffect(() => {
        const saved = localStorage.getItem('sidebarExpanded');
        if (saved !== null) {
            setIsSidebarOpen(saved === 'true');
        }
        fetchData();
    }, []);

    // Persistence: Save sidebar state on change
    useEffect(() => {
        localStorage.setItem('sidebarExpanded', isSidebarOpen.toString());
    }, [isSidebarOpen]);

    const fetchData = async (forceRefresh = false) => {
        if (!forceRefresh) {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                try {
                    const { data, timestamp } = JSON.parse(cached);
                    const age = Date.now() - timestamp;
                    if (age < CACHE_DURATION) {
                        console.log(`🚀 Using cached Pulse 360 results (${Math.round(age / 1000)}s old)`);
                        setStocks(data);
                        setLastUpdated(new Date(timestamp));
                        setLoading(false);
                        return;
                    }
                } catch (e) {
                    console.error("Failed to parse cached Pulse 360 data", e);
                }
            }
        }

        if (forceRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        setError('');

        try {
            const url = forceRefresh ? '/api/pulse-360?refresh=true' : '/api/pulse-360';
            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to fetch pulse 360 data');

            const result = await res.json();
            const dataList = result.data || [];

            setStocks(dataList);
            const now = new Date();
            setLastUpdated(now);

            // Save to Cache
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                data: dataList,
                timestamp: now.getTime()
            }));
            
            if (dataList.length === 0) {
                setError('No assets retrieved. Refresh to try again.');
            }
        } catch (e) {
            console.error("Failed to fetch Pulse 360 data", e);
            setError('Failed to retrieve unified scanner data. Please retry.');
        } finally {
            setLoading(false);
            setRefreshing(false);
            setCountdown(isMarketActive() ? 900 : 3600);
        }
    };

    // Auto-refresh timer during market hours
    useEffect(() => {
        const tick = setInterval(() => {
            if (isMarketActive() && !document.hidden) {
                setCountdown(prev => {
                    if (prev <= 1) {
                        console.log("🕒 Auto-refreshing Pulse 360 market data...");
                        fetchData(true);
                        return 900;
                    }
                    return prev - 1;
                });
            } else if (!isMarketActive()) {
                setCountdown(3600); // 1 hour cooldown when closed
            }
        }, 1000);

        return () => clearInterval(tick);
    }, []);

    const handleSelect = (symbol: string) => {
        router.push(`/?symbol=${symbol}`);
    };

    // Compute dynamic counts for filters
    const filterCounts = useMemo(() => {
        let calls = 0;
        let puts = 0;
        let waits = 0;
        let none = 0;
        
        stocks.forEach(s => {
            const type = s.suggestedOption?.type;
            if (type === 'CALL') calls++;
            else if (type === 'PUT') puts++;
            else if (type === 'WAIT') waits++;
            else none++;
        });

        return {
            ALL: stocks.length,
            CALL: calls,
            PUT: puts,
            WAIT: waits,
            NONE: none
        };
    }, [stocks]);

    // Filter and Sort list based on filterKey and sortKey
    const sortedStocks = useMemo(() => {
        const filtered = stocks.filter(stock => {
            if (filterKey === 'ALL') return true;
            if (filterKey === 'CALL') return stock.suggestedOption?.type === 'CALL';
            if (filterKey === 'PUT') return stock.suggestedOption?.type === 'PUT';
            if (filterKey === 'WAIT') return stock.suggestedOption?.type === 'WAIT';
            if (filterKey === 'NONE') return !stock.suggestedOption;
            return true;
        });

        return filtered.sort((a, b) => {
            if (sortKey === 'score') return (b.score || 0) - (a.score || 0);
            if (sortKey === 'heat') return (b.heat || 0) - (a.heat || 0);
            if (sortKey === 'change') return Math.abs(b.change24h || 0) - Math.abs(a.change24h || 0);
            if (sortKey === 'sentiment') return (b.sentimentScore || 0) - (a.sentimentScore || 0);
            return 0;
        });
    }, [stocks, filterKey, sortKey]);

    return (
        <div className="flex h-screen bg-[#0a0a0b] text-white font-sans overflow-hidden">
            {/* Sidebar Container */}
            <div className={`
                fixed inset-y-0 left-0 z-[110] transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                ${isSidebarOpen ? 'w-[20vw] lg:w-[18vw] min-w-[200px]' : 'w-0'} 
                h-full overflow-hidden flex-shrink-0 border-r border-gray-800
            `}>
                <Sidebar
                    currentPage="pulse-360"
                    symbol={symbol} setSymbol={setSymbol}
                    stockInput={stockInput} setStockInput={setStockInput}
                    isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen}
                    interval="1d" setInterval={() => { }}
                    data={[]} loading={false} stats={null} sentimentScore={50}
                    onSectorClick={() => {}}
                />
            </div>

            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                <BreakingNewsTicker />
                {/* Sidebar Toggle Button */}
                {!isSidebarOpen && (
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-[70] bg-blue-600/90 hover:bg-blue-500 p-2 pr-3 rounded-r-xl border-y border-r border-blue-400/50 text-white transition-all hover:pl-4 group shadow-[0_0_20px_rgba(37,99,235,0.4)] flex items-center gap-1 overflow-hidden"
                        title="Open Sidebar"
                    >
                        <ChevronRight className="w-6 h-6 animate-pulse" />
                    </button>
                )}

                <div className="flex-1 p-6 md:p-10 overflow-y-auto custom-scrollbar">
                    {/* Header */}
                    <header className="mb-8">
                        <div className="flex flex-col xl:flex-row lg:items-end justify-between gap-6">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                                        <Activity className="w-6 h-6 text-blue-400" />
                                    </div>
                                    <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 tracking-tighter uppercase italic">
                                        Pulse 360 Matrix
                                    </h1>
                                    <button
                                        onClick={() => setShowLogic(true)}
                                        className="p-1 text-gray-400 hover:text-white transition-colors"
                                        title="View Matrix Logic"
                                    >
                                        <HelpCircle className="w-5 h-5 mt-1" />
                                    </button>
                                </div>
                                <div className="flex items-center gap-3 mt-2 mb-3">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wider">
                                        System: Unified 360 Intel
                                    </span>
                                    {lastUpdated && (
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-[10px] text-gray-400 font-mono">
                                                Last Scanned: {lastUpdated.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            <RefreshClock countdown={countdown} total={isMarketActive() ? 900 : 3600} label="Update" size="xs" color="#3B82F6" />
                                        </div>
                                    )}
                                </div>
                                <p className="text-gray-300 max-w-2xl text-sm font-medium leading-relaxed">
                                    Our master intelligence terminal merging institutional technical setups, fundamental metrics, and retail social heat. Cross-referencing price structure with crowd velocity.
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => fetchData(true)}
                                    disabled={refreshing}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 border border-gray-700 hover:border-gray-500 text-sm font-bold transition-all text-white disabled:opacity-50"
                                >
                                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                                    {refreshing ? 'Refreshing...' : 'Force Scan'}
                                </button>

                                {isMarketActive() ? (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-xl text-[10px] text-green-400 font-bold uppercase tracking-wider animate-pulse">
                                        <Activity className="w-3.5 h-3.5" />
                                        Live Matrix Streaming
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-end text-right">
                                        <div className="px-3 py-1.5 bg-gray-800/80 border border-gray-700/50 rounded-xl text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                            Market Closed • Static State
                                        </div>
                                        <span className="text-[9px] text-gray-400 font-mono mt-0.5">
                                            Resumes at: {getNextMarketOpen().toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Filters & Sorting Bar */}
                        <div className="mt-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-t border-gray-800/40 pt-6">
                            {/* Filter Group */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-1">Filter Signal:</span>
                                {([
                                    { key: 'ALL' as FilterKey, label: 'All Indicators', count: filterCounts.ALL },
                                    { key: 'CALL' as FilterKey, label: 'Calls', count: filterCounts.CALL },
                                    { key: 'PUT' as FilterKey, label: 'Puts', count: filterCounts.PUT },
                                    { key: 'WAIT' as FilterKey, label: 'Waits', count: filterCounts.WAIT },
                                    { key: 'NONE' as FilterKey, label: 'No Signal', count: filterCounts.NONE },
                                ]).map(({ key, label, count }) => (
                                    <button
                                        key={key}
                                        onClick={() => setFilterKey(key)}
                                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all border flex items-center gap-1.5 ${filterKey === key
                                                ? key === 'CALL'
                                                    ? 'bg-green-500/25 border-green-500/40 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.15)]'
                                                    : key === 'PUT'
                                                    ? 'bg-red-500/25 border-red-500/40 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.15)]'
                                                    : key === 'WAIT'
                                                    ? 'bg-yellow-500/25 border-yellow-500/40 text-yellow-400'
                                                    : key === 'NONE'
                                                    ? 'bg-gray-700/50 border-gray-600 text-gray-200'
                                                    : 'bg-blue-500/25 border-blue-500/40 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.15)]'
                                                : 'bg-gray-800/40 border-gray-700/50 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                                            }`}
                                    >
                                        <span>{label}</span>
                                        <span className={`px-1.5 py-0.2 rounded font-mono text-[9px] ${filterKey === key ? 'bg-white/10 text-white' : 'bg-gray-900/60 text-gray-500'}`}>
                                            {count}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            {/* Sorting Bar */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-1">Order by:</span>
                                {([
                                    { key: 'score' as SortKey, label: 'Alpha Score', icon: <BarChart3 className="w-3 h-3" /> },
                                    { key: 'heat' as SortKey, label: 'Social Heat', icon: <Flame className="w-3 h-3" /> },
                                    { key: 'sentiment' as SortKey, label: 'Sentiment', icon: <MessageSquare className="w-3 h-3" /> },
                                ]).map(({ key, label, icon }) => (
                                    <button
                                        key={key}
                                        onClick={() => setSortKey(key)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all border ${sortKey === key
                                                ? 'bg-blue-500/20 border-blue-500/40 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.15)]'
                                                : 'bg-gray-800/40 border-gray-700/50 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                                            }`}
                                    >
                                        {icon} {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </header>

                    {error && (
                        <div className="mb-6">
                            <ErrorMessage
                                title="Data Sync Failed"
                                message={error}
                                onRetry={() => fetchData(true)}
                            />
                        </div>
                    )}

                    {loading && stocks.length === 0 ? (
                        <div className="h-96 flex flex-col items-center justify-center">
                            <Loading message="Synthesizing technical setups and crowd velocity..." />
                        </div>
                    ) : sortedStocks.length === 0 ? (
                        <div className="col-span-full flex flex-col items-center justify-center gap-4 py-24 text-center">
                            <div className="p-4 bg-gray-800/60 rounded-full border border-gray-700">
                                <Activity className="w-10 h-10 text-gray-500" />
                            </div>
                            <div>
                                <p className="text-gray-200 font-bold text-lg">No assets returned in unified scan</p>
                                <p className="text-gray-400 text-sm mt-1">Please check your configuration or force a fresh scan.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-12">
                            {sortedStocks.map((stock) => (
                                <Ticker360Card
                                    key={stock.symbol}
                                    stock={stock}
                                    onSelect={(s) => handleSelect(s)}
                                />
                            ))}
                        </div>
                    )}

                    {/* Logic Modal */}
                    {showLogic && (
                        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowLogic(false)} />
                            <div className="relative z-[210] bg-gray-900 border border-gray-700/50 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                                <div className="p-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
                                <div className="p-6 md:p-8">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h2 className="text-2xl font-bold text-white mb-1 uppercase tracking-tighter italic">Pulse 360 Methodology</h2>
                                            <p className="text-gray-300 text-sm">Harmonizing quantitative scores with crowd sentiment</p>
                                        </div>
                                        <button
                                            onClick={() => setShowLogic(false)}
                                            className="p-2 hover:bg-gray-800 rounded-lg text-gray-200 transition-colors"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>

                                    <div className="space-y-4 text-xs leading-relaxed text-gray-300">
                                        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                            <h4 className="font-bold text-blue-400 mb-1">1. Alpha Score (Conviction)</h4>
                                            <p>Computed by scanning 500+ leaders for EMA stacking, RSI breakouts, analyst sentiment upgrades, and institutional options flows. Values above 75 indicate heavy confirmation.</p>
                                        </div>
                                        <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                                            <h4 className="font-bold text-orange-400 mb-1">2. Social Heat (Crowd Flow)</h4>
                                            <p>Derived from WallStreetBets mentions, Twitter/X buzz, and StockTwits frequency spikes. Extreme heat (&gt;80) signals high FOMO risk, but when combined with high Alpha Scores, it signals a strong breakout confluence.</p>
                                        </div>
                                        <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                                            <h4 className="font-bold text-purple-400 mb-1">3. Retail Flow & Sentiment</h4>
                                            <p>Live news feeds undergo NLP modeling to score sentiment (0-100%). We track retail buy-sell execution ratios to confirm if retail traders are executing actual orders rather than just talking.</p>
                                        </div>
                                    </div>

                                    <div className="mt-8 flex justify-end">
                                        <button
                                            onClick={() => setShowLogic(false)}
                                            className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 rounded-xl border border-gray-700 transition-all font-bold text-xs uppercase tracking-widest"
                                        >
                                            Roger that
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
