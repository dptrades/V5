"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, DollarSign, Calendar, ArrowRight, X, ChevronRight, RefreshCw } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import LoginOverlay from '@/components/LoginOverlay';
import type { ConvictionStock } from '@/types/stock';
import ConvictionDetailModal from '@/components/ConvictionDetailModal';
import { REFRESH_INTERVALS, isMarketActive, getNextMarketOpen } from '../../lib/refresh-utils';
import { Activity, Loader2 } from 'lucide-react';

import { useRouter } from 'next/navigation';

export default function TopPicksPage() {
    const router = useRouter();
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [picks, setPicks] = useState<ConvictionStock[]>([]);
    const [loading, setLoading] = useState(true);
    const [showLogic, setShowLogic] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // Persistence: Load sidebar state on mount
    useEffect(() => {
        const saved = localStorage.getItem('sidebarExpanded');
        if (saved !== null) {
            setIsSidebarOpen(saved === 'true');
        }
    }, []);

    // Persistence: Save sidebar state on change
    useEffect(() => {
        localStorage.setItem('sidebarExpanded', isSidebarOpen.toString());
    }, [isSidebarOpen]);

    useEffect(() => {
        const runScan = async () => {
            // Check if we already have data (possibly from a quick navigation back)
            // If we don't, or it's been a while, we show the loader
            if (picks.length === 0) {
                setLoading(true);
            }

            try {
                // Remove ?refresh=true to respect the 15-minute server-side cache
                // This prevents redundant scanning on every click
                const res = await fetch('/api/conviction');
                if (res.ok) {
                    const results: ConvictionStock[] = await res.json();
                    setPicks(results);
                    setLastUpdated(new Date());
                }
            } catch (e) {
                console.error("Failed to fetch picks", e);
            }
            setLoading(false);
        };

        const checkSession = async () => {
            try {
                const res = await fetch('/api/auth/session');
                setIsAuthenticated(res.ok);
            } catch (e) {
                setIsAuthenticated(false);
            }
        };

        checkSession();
        runScan();

        // Auto-refresh every 15 minutes during market hours
        const interval = setInterval(() => {
            if (isMarketActive()) {
                console.log('[Top Picks] Auto-refreshing...');
                runScan();
            }
        }, REFRESH_INTERVALS.AUTO_REFRESH);

        return () => clearInterval(interval);
    }, []);

    const handleSelect = (symbol: string) => {
        // Navigate to dashboard with this symbol
        router.push(`/?symbol=${symbol}`);
    };

    if (isAuthenticated === null) return null;

    if (!isAuthenticated) {
        return <LoginOverlay onLoginSuccess={() => setIsAuthenticated(true)} />;
    }

    return (
        <div className="flex h-screen bg-gray-900 text-white font-sans overflow-hidden">
            {/* Sidebar with "picks" active */}
            <div className={`
                fixed inset-y-0 left-0 z-[110] transition-transform duration-300 ease-in-out md:relative md:translate-x-0
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                ${isSidebarOpen ? 'w-[18vw] min-w-[200px]' : 'w-0'} 
                h-full overflow-hidden flex-shrink-0 border-r border-gray-800
            `}>
                <Sidebar
                    currentPage="picks"
                    symbol="PICK"
                    setSymbol={() => { }}
                    stockInput=""
                    setStockInput={() => { }}
                    isOpen={isSidebarOpen}
                    setIsOpen={setIsSidebarOpen}
                    interval="1d"
                    setInterval={() => { }}
                    data={[]}
                    loading={false}
                    stats={null}
                    sentimentScore={50}
                    onSectorClick={() => {
                        // If selecting a sector from here, we might want to close sidebar on mobile
                        if (window.innerWidth < 768) {
                            setIsSidebarOpen(false);
                        }
                    }}
                />
            </div>

            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                {/* Toggle Button for Sidebar when closed */}
                {!isSidebarOpen && (
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-[70] bg-blue-600/90 hover:bg-blue-500 p-2 pr-3 rounded-r-xl border-y border-r border-blue-400/50 text-white transition-all hover:pl-4 group shadow-[0_0_20px_rgba(37,99,235,0.4)] flex items-center gap-1 overflow-hidden"
                        title="Open Sidebar"
                    >
                        <ChevronRight className="w-6 h-6 animate-pulse" />
                    </button>
                )}

                <div className="flex-1 p-6 flex flex-col overflow-hidden transition-all duration-300">
                    <header className="mb-8 flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-4">
                                <h2 className="text-3xl font-bold tracking-tight text-blue-400">Top Picks</h2>
                                <button
                                    onClick={() => setShowLogic(true)}
                                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium underline underline-offset-4 mt-2"
                                >
                                    (How did I do that?)
                                </button>
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wider">
                                    Source: Alpaca & Finnhub
                                </span>
                                {lastUpdated && (
                                    <span className="text-[10px] text-gray-300 font-mono">
                                        Last Updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-gray-100 mt-2">
                                High Mega Cap picks from S&P 500 & Nasdaq 100 • AI-analyzed for Momentum, Trends & Technicals
                            </p>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                            {isMarketActive() ? (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-[10px] text-blue-400 font-bold uppercase tracking-wider animate-pulse">
                                    <Activity className="w-3 h-3" />
                                    Live Matrix Active
                                </div>
                            ) : (
                                <div className="flex flex-col items-end gap-1">
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/80 border border-gray-700/50 rounded-lg text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                        Market Closed • Displaying Last Analysis
                                    </div>
                                    <div className="text-[9px] text-gray-400 font-mono">
                                        Scan restarts at: {getNextMarketOpen().toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </header>

                    <div className="flex-1 overflow-y-auto pr-2">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-64">
                                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                <span className="text-lg text-gray-200 animate-pulse">Scanning the Market...</span>
                                <span className="text-xs text-gray-200 mt-2">Analyzing High Mega Cap S&P 500 & Nasdaq 100 Stocks</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
                                {picks.map((pick, index) => {
                                    return (
                                        <div
                                            key={pick.symbol}
                                            onClick={() => handleSelect(pick.symbol)}
                                            className="bg-gray-800 rounded-xl border border-gray-700 hover:border-blue-500 transition-all shadow-lg relative overflow-hidden group cursor-pointer hover:-translate-y-1"
                                        >
                                            {/* Rank Badge */}
                                            <div className="absolute top-0 right-0 bg-gray-700 text-gray-200 text-xs font-bold px-3 py-1 rounded-bl-xl border-b border-l border-gray-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                #{index + 1}
                                            </div>

                                            <div className="p-5">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h3 className="text-2xl font-bold text-white tracking-tight group-hover:text-blue-400 transition-colors">{pick.symbol}</h3>
                                                            <span className="text-[10px] text-gray-100 bg-gray-700/50 px-2 py-0.5 rounded border border-gray-600 uppercase tracking-widest leading-normal">
                                                                {pick.sector || 'Stock'}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-gray-100 mb-2 truncate max-w-[170px]">{pick.name}</p>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${pick.metrics.trend === 'BULLISH' ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
                                                            {pick.metrics.trend}
                                                        </span>
                                                    </div>
                                                    <div className="text-right bg-gray-900/50 p-2 rounded-lg border border-gray-700/50 min-w-16">
                                                        <div className="text-2xl font-mono font-bold text-blue-400">{pick.score}</div>
                                                        <div className="text-[10px] text-gray-200 uppercase font-bold tracking-wider">Win Prob</div>
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
                                })}
                            </div>
                        )}
                    </div>

                    {/* Top Picks Logic Modal */}
                    {showLogic && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowLogic(false)} />
                            <div className="relative z-50 bg-gray-900 border border-gray-700/50 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                                <div className="p-1 bg-gradient-to-r from-blue-500 to-purple-500" />
                                <div className="p-6 md:p-8">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h2 className="text-2xl font-bold text-white mb-1">Top Picks Logic</h2>
                                            <p className="text-gray-200 text-sm">How we identify high-conviction mega-caps</p>
                                        </div>
                                        <button
                                            onClick={() => setShowLogic(false)}
                                            className="p-2 hover:bg-gray-800 rounded-lg text-gray-200 transition-colors"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>

                                    <div className="space-y-6">
                                        <p className="text-gray-100 text-[15px] font-medium leading-relaxed mb-6">
                                            Unlike Alpha Hunter which scans the broader market, **Top Picks** is hyper-focused on the most liquid, institutional-grade companies in the S&P 500 and Nasdaq 100.
                                        </p>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
                                                    <span className="font-bold text-blue-400 text-sm">Institutional Universe</span>
                                                </div>
                                                <p className="text-sm text-gray-100 leading-relaxed">
                                                    Limited to stocks with market caps &gt;$200B. We filter for companies with the highest institutional ownership to ensure stability and liquidity.
                                                </p>
                                            </div>

                                            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]" />
                                                    <span className="font-bold text-purple-400 text-sm">Momentum Scoring</span>
                                                </div>
                                                <p className="text-sm text-gray-100 leading-relaxed">
                                                    Prioritizes stocks trading above key psychological levels (50/200 EMAs) with positive MACD divergence and RSI between 40-70.
                                                </p>
                                            </div>

                                            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                                                    <span className="font-bold text-emerald-400 text-sm">Growth & Value Balance</span>
                                                </div>
                                                <p className="text-sm text-gray-100 leading-relaxed">
                                                    Cross-references Revenue Growth against P/E ratios to identify "GARP" (Growth at a Reasonable Price) setups.
                                                </p>
                                            </div>

                                            <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
                                                    <span className="font-bold text-yellow-400 text-sm">Consensus Overdrive</span>
                                                </div>
                                                <p className="text-sm text-gray-100 leading-relaxed">
                                                    Requires at least 3 recent "Strong Buy" ratings from Tier-1 investment banks and &gt;10% upside potential to the mean price target.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-8 flex justify-end">
                                        <button
                                            onClick={() => setShowLogic(false)}
                                            className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 rounded-xl border border-gray-700 transition-all font-bold text-sm"
                                        >
                                            I Understand
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
