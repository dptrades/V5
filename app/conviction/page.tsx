"use client";

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import LoginOverlay from '../../components/LoginOverlay';
import ConvictionCard from '../../components/ConvictionCard';
import type { ConvictionStock } from '../../types/stock';
import { Loader2, RefreshCw, X, ChevronRight, Activity } from 'lucide-react';
import { Loading } from '../../components/ui/Loading';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import SectorDetailModal from '../../components/SectorDetailModal';
import { REFRESH_INTERVALS, getMarketSession, getNextMarketOpen, isMarketActive } from '../../lib/refresh-utils';
import HeaderSignals from '../../components/HeaderSignals';
import { OHLCVData } from '@/types/financial';

const CACHE_KEY = 'alpha_hunter_results';
const CACHE_DURATION = REFRESH_INTERVALS.WIDGETS;

export default function ConvictionPage() {
    const router = useRouter();
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

    // Sidebar Props (Standardized)
    const [symbol, setSymbol] = useState('AAPL');
    const [stockInput, setStockInput] = useState('NVDA');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const [stocks, setStocks] = useState<ConvictionStock[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [error, setError] = useState('');
    const [showLogic, setShowLogic] = useState(false);
    const [selectedSector, setSelectedSector] = useState<any>(null);

    // Persistence: Load sidebar state on mount
    useEffect(() => {
        const saved = localStorage.getItem('sidebarExpanded');
        if (saved !== null) {
            setIsSidebarOpen(saved === 'true');
        }

        // Initial Auth Check
        const checkSession = async () => {
            try {
                const res = await fetch('/api/auth/session');
                setIsAuthenticated(res.ok);
            } catch (e) {
                setIsAuthenticated(false);
            }
        };
        checkSession();
    }, []);

    // Persistence: Save sidebar state on change
    useEffect(() => {
        localStorage.setItem('sidebarExpanded', isSidebarOpen.toString());
    }, [isSidebarOpen]);

    const fetchConviction = async (forceRefresh = false) => {
        // 1. Check Cache first unless forceRefresh is true
        if (!forceRefresh) {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                try {
                    const { data, timestamp } = JSON.parse(cached);
                    const age = Date.now() - timestamp;
                    if (age < CACHE_DURATION) {
                        console.log(`🚀 Using cached Alpha Hunter results (${Math.round(age / 1000)}s old)`);
                        setStocks(data);
                        setLastUpdated(new Date(timestamp));
                        setLoading(false);
                        return;
                    }
                } catch (e) {
                    console.error("Failed to parse cached Alpha Hunter data", e);
                }
            }
        }

        if (forceRefresh) {
            setStocks([]); // Clear current results to show loading state
        }

        setLoading(true);
        setError('');
        try {
            const url = forceRefresh ? '/api/alpha-hunter?refresh=true' : '/api/alpha-hunter';
            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to fetch data');

            const data = await res.json();
            if (Array.isArray(data)) {
                setStocks(data);
                const now = new Date();
                setLastUpdated(now);

                // 2. Save to Cache
                localStorage.setItem(CACHE_KEY, JSON.stringify({
                    data,
                    timestamp: now.getTime()
                }));

                if (data.length === 0) setError('No live setups found at this time. Refresh to try again.');
            } else {
                setError('Invalid data format received from API.');
            }
        } catch (e) {
            console.error("Failed to fetch alpha hunter", e);
            setError('Failed to scan market. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Load data after authentication
    useEffect(() => {
        if (isAuthenticated === true) {
            fetchConviction();

            // Set up 15-minute auto-refresh during market hours
            const intervalId = setInterval(() => {
                if (isMarketActive()) {
                    console.log("🕒 Auto-refreshing Alpha Hunter market hours...");
                    fetchConviction(true);
                }
            }, REFRESH_INTERVALS.AUTO_REFRESH);

            return () => clearInterval(intervalId);
        }
    }, [isAuthenticated]);

    const handleSelect = (symbol: string) => {
        router.push(`/?symbol=${symbol}`);
    };

    if (isAuthenticated === null) return <Loading message="Authenticating session..." />;

    if (!isAuthenticated) {
        return <LoginOverlay onLoginSuccess={() => setIsAuthenticated(true)} />;
    }

    return (
        <div className="flex h-screen bg-gray-900 text-white font-sans overflow-hidden">
            <div className={`
                fixed inset-y-0 left-0 z-[110] transition-transform duration-300 ease-in-out md:relative md:translate-x-0
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                ${isSidebarOpen ? 'w-[18vw] min-w-[200px]' : 'w-0'} 
                h-full overflow-hidden flex-shrink-0 border-r border-gray-800
            `}>
                <Sidebar
                    currentPage="conviction"
                    symbol={symbol} setSymbol={setSymbol}
                    stockInput={stockInput} setStockInput={setStockInput}
                    isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen}
                    interval="1d" setInterval={() => { }}
                    data={[]} loading={false} stats={null} sentimentScore={50}
                    onSectorClick={(sector) => {
                        setSelectedSector(sector);
                        if (window.innerWidth < 768) {
                            setIsSidebarOpen(false);
                        }
                    }}
                />
            </div>

            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                {!isSidebarOpen && (
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-[70] bg-blue-600/90 hover:bg-blue-500 p-2 pr-3 rounded-r-xl border-y border-r border-blue-400/50 text-white transition-all hover:pl-4 group shadow-[0_0_20px_rgba(37,99,235,0.4)] flex items-center gap-1 overflow-hidden"
                        title="Open Sidebar"
                    >
                        <ChevronRight className="w-6 h-6 animate-pulse" />
                    </button>
                )}

                <div className="flex-1 p-4 md:p-8 overflow-y-auto transition-all duration-300">
                    <header className="flex justify-between items-end mb-8">
                        <div>
                            <div className="flex items-center gap-4">
                                <h1 className="text-4xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                                    Alpha Hunter
                                </h1>
                                <button
                                    onClick={() => setShowLogic(true)}
                                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium underline underline-offset-4 mt-2"
                                >
                                    (How did I do that?)
                                </button>
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wider">
                                    Source: Multi-Data AI
                                </span>
                                {lastUpdated && (
                                    <span className="text-[10px] text-gray-300 font-mono">
                                        Last Updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-gray-100 mt-2 max-w-2xl">
                                Scans for high-probability setups with Smart Discovery.
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

                    {error && (
                        <div className="mb-6">
                            <ErrorMessage
                                title="Scan Failed"
                                message={error}
                                onRetry={() => fetchConviction(true)}
                            />
                        </div>
                    )}

                    {loading && stocks.length === 0 ? (
                        <div className="h-96">
                            <Loading message="Crunching billions of data points..." />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
                            {stocks.map((stock) => (
                                <ConvictionCard
                                    key={stock.symbol}
                                    stock={stock}
                                    onSelect={(s) => handleSelect(s)}
                                />
                            ))}
                        </div>
                    )}

                    {/* Alpha Hunter Logic Modal (same as before) */}
                    {showLogic && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowLogic(false)} />
                            <div className="relative z-50 bg-gray-900 border border-gray-700/50 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                                <div className="p-1 bg-gradient-to-r from-blue-500 to-emerald-500" />
                                <div className="p-6 md:p-8">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h2 className="text-2xl font-bold text-white mb-1">Alpha Hunter Scoring Logic</h2>
                                            <p className="text-gray-200 text-sm">How we calculate the high-conviction scores</p>
                                        </div>
                                        <button
                                            onClick={() => setShowLogic(false)}
                                            className="p-2 hover:bg-gray-800 rounded-lg text-gray-200 transition-colors"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
                                                    <span className="font-bold text-blue-400 text-sm">Technical Analysis (25%)</span>
                                                </div>
                                                <p className="text-sm text-gray-100 leading-relaxed">
                                                    Evaluates Trend alignment, RSI momentum, MACD, and Bollinger Bands.
                                                </p>
                                            </div>
                                            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                                                    <span className="font-bold text-emerald-400 text-sm">Fundamentals & Growth (20%)</span>
                                                </div>
                                                <p className="text-sm text-gray-100 leading-relaxed">
                                                    Revenue Growth, Profit Margins, and healthy P/E ratios.
                                                </p>
                                            </div>
                                            <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
                                                    <span className="font-bold text-yellow-400 text-sm">Analyst Rating (15%)</span>
                                                </div>
                                                <p className="text-sm text-gray-100 leading-relaxed">
                                                    Wall Street analyst ratings and upside sentiment.
                                                </p>
                                            </div>
                                            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]" />
                                                    <span className="font-bold text-purple-400 text-sm">Social & Sentiment (15%)</span>
                                                </div>
                                                <p className="text-sm text-gray-100 leading-relaxed">
                                                    NLP scan of news headlines and social buzz.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="p-5 rounded-xl bg-white/5 border border-white/10">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                                                <span className="font-bold text-white text-sm uppercase tracking-wider">Smart Discovery Multiplier (25%)</span>
                                            </div>
                                            <p className="text-sm text-gray-100 leading-relaxed">
                                                Unusual Options Flow, Volume Breakouts, and Volatility News.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-8 flex justify-end">
                                        <button onClick={() => setShowLogic(false)} className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 rounded-xl border border-gray-700 transition-all font-bold text-sm">I Understand</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <SectorDetailModal
                    sector={selectedSector}
                    onClose={() => setSelectedSector(null)}
                    onSelectStock={(s) => router.push(`/?symbol=${s}`)}
                />
            </main>
        </div>
    );
}
