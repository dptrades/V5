"use client";

import React, { useState, useEffect } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SidebarInternals from './SidebarInternals';
import { Search, Activity, Clock, Zap, BarChart2, Hash, Newspaper, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Terminal } from 'lucide-react';
import { IndicatorData } from '../types/financial';
import { PriceStats } from '../lib/stats';
import PreMarketMovers from './PreMarketMovers';


interface SidebarProps {
    isOpen: boolean;
    setIsOpen?: (open: boolean) => void;
    symbol?: string;
    setSymbol?: (s: string) => void;
    stockInput?: string;
    setStockInput?: (s: string) => void;
    interval?: string;
    setInterval?: (i: string) => void;
    data?: IndicatorData[];
    loading?: boolean;
    currentPage?: string; // Kept for backward compatibility but ignored for highlighting
    stats?: PriceStats | null;
    sentimentScore?: number;
    onSectorClick?: (sector: any) => void;
}

const StatsCarousel = ({ stats }: { stats: PriceStats | null }) => {
    const [index, setIndex] = useState(0);

    // Manual navigation only
    const next = () => setIndex((prev) => (prev + 1) % 6);
    const prev = () => setIndex((prev) => (prev - 1 + 6) % 6);

    if (!stats) return <div className="h-20 bg-gray-800/50 rounded-lg animate-pulse my-4"></div>;

    const items = [
        { label: 'Prev Day', high: stats.previousDay.high, low: stats.previousDay.low },
        { label: 'Current Week', high: stats.currentWeek.high, low: stats.currentWeek.low },
        { label: 'Prev Week', high: stats.previousWeek.high, low: stats.previousWeek.low },
        { label: 'Current Month', high: stats.currentMonth.high, low: stats.currentMonth.low },
        { label: 'Current Year', high: stats.currentYear.high, low: stats.currentYear.low },
        { label: '52 Week', high: stats.fiftyTwoWeek.high, low: stats.fiftyTwoWeek.low },
    ];

    const current = items[index];

    return (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 my-4 relative overflow-hidden group">
            <div className="flex justify-between items-center mb-1">
                <button
                    onClick={prev}
                    className="p-1 hover:bg-gray-700 rounded transition-colors text-gray-100 hover:text-white"
                >
                    <ChevronLeft className="w-3 h-3" />
                </button>

                <span className="text-[10px] text-gray-100 uppercase tracking-wider font-bold select-none">{current.label}</span>

                <button
                    onClick={next}
                    className="p-1 hover:bg-gray-700 rounded transition-colors text-gray-100 hover:text-white"
                >
                    <ChevronRight className="w-3 h-3" />
                </button>
            </div>

            <div className="flex justify-between items-end mt-2 px-1">
                <div>
                    <span className="text-[10px] text-gray-200 block">High</span>
                    <span className="text-sm font-mono text-green-400">${current.high.toFixed(2)}</span>
                </div>
                <div className="text-right">
                    <span className="text-[10px] text-gray-200 block">Low</span>
                    <span className="text-sm font-mono text-red-400">${current.low.toFixed(2)}</span>
                </div>
            </div>

            {/* Dots */}
            <div className="flex justify-center space-x-1 mt-2">
                {[0, 1, 2, 3, 4, 5].map(i => (
                    <button
                        key={i}
                        onClick={() => setIndex(i)}
                        className={`h-1 rounded-full transition-all ${i === index ? 'w-3 bg-blue-400' : 'w-1 bg-gray-600 hover:bg-gray-500'}`}
                    />
                ))}
            </div>
        </div>
    );
};

export default function Sidebar({
    isOpen,
    setIsOpen = () => { },
    symbol = 'SPY',
    setSymbol = () => { },
    stockInput = 'SPY',
    setStockInput = () => { },
    interval = '1d',
    setInterval = () => { },
    data = [],
    loading = false,
    currentPage = 'dashboard',
    stats = null,
    sentimentScore = 50,
    onSectorClick = () => { }
}: SidebarProps) {
    const pathname = usePathname();
    const activePage = pathname === '/' ? 'dashboard'
        : pathname.startsWith('/pre-market') ? 'pre-market'
            : pathname.startsWith('/picks') ? 'picks'
                : pathname.startsWith('/conviction') ? 'conviction'
                    : pathname.startsWith('/social-pulse') ? 'social'
                        : pathname.startsWith('/performance') ? 'performance'
                            : pathname.startsWith('/terminal') ? 'terminal'
                                : 'dashboard';



    const enableBetaFeatures = process.env.NEXT_PUBLIC_ENABLE_BETA_FEATURES === 'true';

    return (
        <aside className={`${isOpen ? 'w-full lg:w-80' : 'w-0 lg:w-0'} bg-gray-800 border-r border-gray-700 flex flex-col h-full overflow-y-auto custom-scrollbar shadow-2xl transition-all duration-300`}>
            <div className="p-4 flex justify-between items-center bg-gray-900/60 border-b border-gray-700/50 backdrop-blur-md sticky top-0 z-20">
                <div className="flex-1">
                    <h1 className="text-xl font-bold text-blue-400 tracking-tight flex items-center gap-2">
                        <Activity className="w-5 h-5" />
                        DP TradeDesk
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-blue-400 border border-gray-700 transition-all active:scale-95 shadow-lg flex items-center gap-1 group"
                        title="Close Menu"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        <span className="text-[10px] font-bold uppercase md:hidden">Close</span>
                    </button>
                </div>
            </div>

            {/* Navigation */}
            <nav className="space-y-1.5 p-3">
                <Link
                    href="/"
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold transition-all w-full group ${activePage === 'dashboard'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 border border-transparent'
                        }`}
                >
                    <span className="truncate">📡 Live Dashboard</span>
                </Link>
                <Link
                    href="/terminal"
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold transition-all w-full group ${activePage === 'terminal'
                        ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                        : 'text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10 border border-transparent'
                        }`}
                >
                    <span className="truncate">🖥️ DPTrade Terminal</span>
                </Link>
                <Link
                    href="/pre-market"
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold transition-all w-full group ${activePage === 'pre-market'
                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        : 'text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10 border border-transparent'
                        }`}
                >
                    <span className="truncate">⚡ Pre-Market</span>
                </Link>
                <Link
                    href="/picks"
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold transition-all w-full group ${activePage === 'picks'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 border border-transparent'
                        }`}
                >
                    <span className="truncate">💎 Top Picks</span>
                </Link>
                <Link
                    href="/conviction"
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold transition-all w-full group ${activePage === 'conviction'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 border border-transparent'
                        }`}
                >
                    <span className="truncate">✨ Alpha Hunter</span>
                </Link>
                <Link
                    href="/social-pulse"
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold transition-all w-full group ${activePage === 'social'
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                        : 'text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 border border-transparent'
                        }`}
                >
                    <span className="truncate">🔥 Social Pulse</span>
                </Link>
                {enableBetaFeatures && (
                    <>
                        <Link
                            href="/performance"
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold transition-all w-full group ${activePage === 'performance'
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : 'text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 border border-transparent'
                                }`}
                        >
                            <span className="truncate">📈 Performance</span>
                        </Link>
                    </>
                )}
            </nav>

            <div className="flex-1 overflow-y-auto mt-4">
                {/* Market Internals (Market Pulse) - Below Navigation */}
                <SidebarInternals onSectorClick={onSectorClick} isOpen={isOpen} />
            </div>

            {/* Footer: Source & Timestamp */}
            <div className="p-3 border-t border-gray-800 bg-gray-900/50 text-center">
                <p className="text-[9px] text-gray-300 font-mono mb-0.5">
                    Source: Schwab / Alpaca / Public / Finnhub
                </p>
                <p className="text-[9px] text-gray-400 font-mono">
                    Updated: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
            </div>
        </aside>
    );
}
