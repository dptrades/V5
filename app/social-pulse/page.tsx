"use client";

import React, { useEffect, useState } from 'react';
import { Flame, MessageSquare, RefreshCw, Info, ChevronRight, Activity } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import SocialPulseCard from '@/components/SocialPulseCard';
import DataSourceIndicator from '@/components/ui/DataSourceIndicator';
import { Loading } from '@/components/ui/Loading';
import SectorDetailModal from '@/components/SectorDetailModal';
import { REFRESH_INTERVALS, isMarketActive, getNextMarketOpen } from '@/lib/refresh-utils';

export default function SocialPulsePage() {
    const router = useRouter();
    const [trending, setTrending] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [showLogic, setShowLogic] = useState(false);
    const [selectedSector, setSelectedSector] = useState<any>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // Sidebar Props (Standardized)
    const [symbol, setSymbol] = useState('TSLA');
    const [stockInput, setStockInput] = useState('TSLA');

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
        fetchPulse();

        // 15-minute auto-refresh during market hours
        const interval = setInterval(() => {
            if (isMarketActive()) {
                console.log('[Social Pulse] Auto-refreshing...');
                fetchPulse();
            }
        }, REFRESH_INTERVALS.AUTO_REFRESH);

        return () => clearInterval(interval);
    }, []);

    const fetchPulse = async () => {
        setRefreshing(true);
        try {
            const res = await fetch('/api/social-pulse', { cache: 'no-store' });
            const data = await res.json();
            setTrending(data.data || []);
            setLastUpdated(new Date());
        } catch (err) {
            console.error('Failed to fetch social pulse:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    return (
        <div className="flex h-screen bg-[#0a0a0b] text-white font-sans overflow-hidden">
            {/* Sidebar Container */}
            <div className={`
                fixed inset-y-0 left-0 z-[110] transition-transform duration-300 ease-in-out md:relative md:translate-x-0
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                ${isSidebarOpen ? 'w-[18vw] min-w-[200px]' : 'w-0'} 
                h-full overflow-hidden flex-shrink-0 border-r border-gray-800
            `}>
                <Sidebar
                    currentPage="social"
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

                <div className="flex-1 p-6 md:p-10 overflow-y-auto transition-all duration-300">
                    {/* Header */}
                    <header className="mb-10">
                        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-orange-500/20 rounded-xl border border-orange-500/30">
                                        <Flame className="w-6 h-6 text-orange-500" />
                                    </div>
                                    <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-400 tracking-tighter uppercase italic">
                                        Social Pulse
                                    </h1>
                                    <button
                                        onClick={() => setShowLogic(true)}
                                        className="text-xs text-orange-400 hover:text-orange-300 transition-colors font-medium underline underline-offset-4 mt-2"
                                    >
                                        (How did I do that?)
                                    </button>
                                </div>
                                <div className="flex items-center gap-3 mt-2 mb-3">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20 uppercase tracking-wider">
                                        Source: Social Intelligence AI
                                    </span>
                                    {lastUpdated && (
                                        <span className="text-[10px] text-gray-300 font-mono">
                                            Last Updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </span>
                                    )}
                                </div>
                                <p className="text-gray-200 max-w-2xl text-sm font-medium leading-relaxed">
                                    Tracking the top 25 stocks driving the strongest retail momentum across WallStreetBets, Twitter/X, and StockTwits.
                                    Detecting surges in mention velocity and sentiment shifts before they hit the tape.
                                </p>
                            </div>

                            <div className="flex flex-col items-end gap-2">
                                <div className="bg-blue-500/10 border border-blue-500/30 p-2.5 rounded-xl hidden xl:block mb-1">
                                    <DataSourceIndicator source="Social Intelligence AI" />
                                </div>

                                {isMarketActive() ? (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-lg text-[10px] text-orange-400 font-bold uppercase tracking-wider animate-pulse">
                                        <Activity className="w-3 h-3" />
                                        Live Pulse Streaming
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
                        </div>

                        {/* Info Bar */}
                        <div className="mt-8 flex items-center gap-3 bg-blue-500/5 border border-blue-500/10 p-4 rounded-xl">
                            <Info className="w-5 h-5 text-blue-400 flex-shrink-0" />
                            <p className="text-xs text-blue-300 font-bold uppercase tracking-wider">
                                Social Heat &gt; 80 indicates extreme retail FOMO. Cross-reference with Alpha Hunter for divergence trades.
                            </p>
                        </div>
                    </header>

                    {loading ? (
                        <div className="h-96 flex flex-col items-center justify-center">
                            <Loading message="Scanning Social Frequency..." />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 pb-12">
                            {trending.map((stock) => (
                                <SocialPulseCard
                                    key={stock.symbol}
                                    stock={stock}
                                    onSelect={(s) => router.push(`/?symbol=${s}`)}
                                />
                            ))}
                        </div>
                    )}

                    {/* Footer */}
                    <footer className="mt-16 pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4 text-gray-300">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-center md:text-left">
                            © 2026 AntiGravity V3 • Institutional Intelligence Engine
                        </p>
                        <div className="flex gap-6">
                            <span className="text-[10px] font-bold uppercase tracking-widest hover:text-white cursor-pointer transition-colors">Documentation</span>
                            <span className="text-[10px] font-bold uppercase tracking-widest hover:text-white cursor-pointer transition-colors">API Status</span>
                        </div>
                    </footer>
                </div>

                {/* Social Pulse Logic Modal */}
                {showLogic && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowLogic(false)} />
                        <div className="relative z-[210] bg-gray-900 border border-gray-700/50 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                            <div className="p-1 bg-gradient-to-r from-orange-500 to-yellow-500" />
                            <div className="p-6 md:p-8">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h2 className="text-2xl font-bold text-white mb-1 uppercase tracking-tighter italic">Social Pulse Intelligence</h2>
                                        <p className="text-gray-200 text-sm">Quantifying retail momentum and sentiment velocity</p>
                                    </div>
                                    <button
                                        onClick={() => setShowLogic(false)}
                                        className="p-2 hover:bg-gray-800 rounded-lg text-gray-200 transition-colors"
                                    >
                                        <RefreshCw className="w-5 h-5 rotate-45" />
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                                                <span className="font-bold text-orange-400 text-xs uppercase tracking-wider">Mention Velocity (40%)</span>
                                            </div>
                                            <p className="text-[11px] text-gray-200 leading-relaxed font-medium">
                                                Scans high-frequency channels (WSB, Twitter, StockTwits) for surges in ticker mentions. We calculate the rate of change against a 7-day rolling average to detect organic viral expansion.
                                            </p>
                                        </div>

                                        <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]" />
                                                <span className="font-bold text-yellow-400 text-xs uppercase tracking-wider">Sentiment NLP (30%)</span>
                                            </div>
                                            <p className="text-[11px] text-gray-200 leading-relaxed font-medium">
                                                Uses Natural Language Processing to categorize retail mood. We filter out "noise" and bot activity to extract high-conviction bullish/bearish intent from real traders.
                                            </p>
                                        </div>

                                        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
                                                <span className="font-bold text-blue-400 text-xs uppercase tracking-wider">Asset Correlation (15%)</span>
                                            </div>
                                            <p className="text-[11px] text-gray-200 leading-relaxed font-medium">
                                                Maps social ripples to price action. We prioritize stocks where mentions precede price breakout, identifying potential "lead indicators" for momentum.
                                            </p>
                                        </div>

                                        <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]" />
                                                <span className="font-bold text-purple-400 text-xs uppercase tracking-wider">Flow Contrast (15%)</span>
                                            </div>
                                            <p className="text-[11px] text-gray-200 leading-relaxed font-medium">
                                                Weighting retail "buying heavy" flow against institutional positioning. High social heat combined with heavy institutional call buying creates an "Ultimate Bull" signal.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="p-5 rounded-xl bg-white/5 border border-white/10">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                                            <span className="font-bold text-white text-xs uppercase tracking-wider">The "Divergence" Metric</span>
                                        </div>
                                        <p className="text-[11px] text-gray-100 leading-relaxed font-medium">
                                            The Social Pulse is designed to find **Psychology/Price Divergence**. When social heat is extreme (&gt;90) but price is flat, a volatility event is often imminent. Use this with Alpha Hunter to confirm setups.
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-8 flex justify-end">
                                    <button
                                        onClick={() => setShowLogic(false)}
                                        className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 rounded-xl border border-gray-700 transition-all font-bold text-xs uppercase tracking-widest"
                                    >
                                        I'm in tune
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <SectorDetailModal
                    sector={selectedSector}
                    onClose={() => setSelectedSector(null)}
                    onSelectStock={(s) => router.push(`/?symbol=${s}`)}
                />
            </main>
        </div>
    );
}
