"use client";

import React, { useEffect, useState } from 'react';
import { Activity, TrendingUp, TrendingDown, Info, X } from 'lucide-react';
import { REFRESH_INTERVALS, isMarketActive } from '../lib/refresh-utils';

interface MarketData {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
}

interface InternalsData {
    vix?: MarketData;
    sp500?: MarketData;
    nasdaq?: MarketData;
    ndx?: MarketData;
    dow?: MarketData;
    russell?: MarketData;
}

interface SectorGroup {
    name: string;
    avgChange: number;
    stocks: any[];
}

interface Props {
    onSectorClick: (sector: SectorGroup) => void;
    isOpen: boolean;
}

const GICS_SECTORS = [
    'Communication Services',
    'Consumer Discretionary',
    'Consumer Staples',
    'Energy',
    'Financials',
    'Health Care',
    'Industrials',
    'Information Technology',
    'Materials',
    'Real Estate',
    'Utilities'
];

const normalizeSector = (sector: string): string => {
    const s = sector.toLowerCase().trim();
    if (s.includes('information technology') || s === 'technology') return 'Information Technology';
    if (s.includes('communication') || s.includes('services')) return 'Communication Services';
    if (s.includes('discretionary') || s.includes('cyclical')) return 'Consumer Discretionary';
    if (s.includes('staples') || s.includes('defensive')) return 'Consumer Staples';
    if (s.includes('health')) return 'Health Care';
    if (s.includes('financial') || s === 'finance') return 'Financials';
    if (s.includes('industrial')) return 'Industrials';
    if (s.includes('energy')) return 'Energy';
    if (s.includes('material')) return 'Materials';
    if (s.includes('real estate')) return 'Real Estate';
    if (s.includes('utilities')) return 'Utilities';
    return sector;
};

export default function SidebarInternals({ onSectorClick, isOpen }: Props) {
    const [internals, setInternals] = useState<InternalsData | null>(null);
    const [sectors, setSectors] = useState<SectorGroup[]>([]);
    const [convictionStats, setConvictionStats] = useState<{
        advancers: number;
        decliners: number;
        bullishPercent: number;
    } | null>(null);
    const [activeLogic, setActiveLogic] = useState<'bullish' | 'breadth' | null>(null);

    useEffect(() => {
        // HYBRID POWER SETUP: JIT Telemetry
        // Only fetch if the sidebar is actually open to save API usage
        if (!isOpen) return;

        const fetchInternals = async () => {
            try {
                // Fetch market internals (VIX, indices)
                const internalsRes = await fetch('/api/market-internals');
                if (internalsRes.ok) {
                    const data = await internalsRes.json();
                    setInternals(data);
                }
            } catch (e) {
                console.error("Failed to fetch internals", e);
            }
        };

        const fetchConvictionStats = async () => {
            try {
                // Fetch conviction data for breadth calculation
                const res = await fetch('/api/conviction');
                if (!res.ok) return;
                const data = await res.json();

                if (Array.isArray(data)) {
                    // Update stocks with normalized sector
                    const normalizedData = data.map((s: any) => ({
                        ...s,
                        sector: normalizeSector(s.sector || 'Other')
                    }));

                    // 1. Breadth Logic
                    const marketStocks = normalizedData.filter((s: any) =>
                        GICS_SECTORS.includes(s.sector)
                    );

                    const advancers = marketStocks.filter((s: any) => s.change24h > 0).length;
                    const decliners = marketStocks.filter((s: any) => s.change24h < 0).length;

                    // Bullish Trend %
                    const bullCount = marketStocks.filter((s: any) => s.metrics?.trend === 'BULLISH').length;
                    const bullishPercent = marketStocks.length > 0 ? (bullCount / marketStocks.length) * 100 : 0;

                    setConvictionStats({ advancers, decliners, bullishPercent });

                    // 2. Sector Logic
                    const groups: Record<string, any[]> = {};
                    normalizedData.forEach(stock => {
                        const sector = stock.sector;
                        if (!GICS_SECTORS.includes(sector)) return;
                        if (!groups[sector]) groups[sector] = [];
                        groups[sector].push(stock);
                    });

                    const sectorList = GICS_SECTORS.map(name => {
                        const stocks = groups[name] || [];
                        const avgChange = stocks.length > 0
                            ? stocks.reduce((acc, s) => acc + s.change24h, 0) / stocks.length
                            : 0;
                        return { name, avgChange, stocks };
                    });

                    setSectors(sectorList);
                }
            } catch (e) {
                console.error("Failed to fetch conviction stats", e);
            }
        };

        // Trigger immediate fetch on "Open"
        fetchInternals();
        fetchConvictionStats();

        // Standard background sync (15 mins) only while open
        const syncInterval = setInterval(() => {
            if (isOpen && isMarketActive()) {
                fetchInternals();
                fetchConvictionStats();
            }
        }, REFRESH_INTERVALS.WIDGETS);

        return () => clearInterval(syncInterval);
    }, [isOpen]);

    if (!internals) return (
        <div className="px-4 py-4 text-xs text-gray-200 animate-pulse text-center">
            Loading Pulse...
        </div>
    );

    const { vix, sp500, nasdaq, ndx, dow, russell } = internals;
    const stats = convictionStats || { advancers: 0, decliners: 0, bullishPercent: 50 };

    return (
        <div className="mt-auto border-t border-gray-800 p-4 space-y-4">
            <h4 className="text-xs font-bold text-gray-200 uppercase tracking-widest flex items-center mb-2 justify-between">
                <span className="flex items-center">
                    <Activity className="w-3 h-3 mr-1" /> Market Pulse
                </span>
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
            </h4>

            {/* VIX & Bullish % */}
            <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-800 p-2 rounded border border-gray-700">
                    <span className="text-[10px] text-gray-100 block font-black uppercase tracking-wider mb-0.5">VIX</span>
                    <div className="flex items-center gap-1">
                        <span className={`text-sm font-bold ${vix && vix.change < 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {vix ? vix.price.toFixed(2) : 'N/A'}
                        </span>
                        {vix && (
                            <span className={`text-[10px] ${vix.change < 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {vix.change > 0 ? '+' : ''}{vix.changePercent.toFixed(1)}%
                            </span>
                        )}
                    </div>
                </div>
                <button
                    onClick={() => setActiveLogic('bullish')}
                    className="bg-gray-800 p-2 rounded border border-gray-700 hover:border-blue-500/50 hover:bg-gray-700/50 transition-all text-left group"
                >
                    <div className="flex justify-between items-center mb-0.5">
                        <span className="text-[10px] text-gray-100 block font-black uppercase tracking-wider">Bullish %</span>
                        <Info className="w-2.5 h-2.5 text-gray-300 group-hover:text-blue-400 transition-colors" />
                    </div>
                    <span className={`text-sm font-bold ${stats.bullishPercent > 50 ? 'text-green-400' : 'text-red-400'}`}>
                        {stats.bullishPercent.toFixed(0)}%
                    </span>
                </button>
            </div>

            {/* Major Indices */}
            <div className="space-y-1">
                {[
                    { label: 'S&P 500', data: sp500 },
                    { label: 'Nasdaq 100', data: ndx },
                    { label: 'Nasdaq Comp', data: nasdaq },
                    { label: 'Dow Jones', data: dow },
                    { label: 'Russell 2000', data: russell },
                ].map((item) => item.data && (
                    <div key={item.label} className="flex justify-between items-center text-[11px] bg-gray-800/50 p-1.5 rounded">
                        <span className="text-gray-100 font-bold tracking-tight truncate mr-2">{item.label}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                            <span className="text-white font-mono">{item.data.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            <span className={`text-[10px] ${item.data.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {item.data.change >= 0 ? '+' : ''}{item.data.changePercent.toFixed(1)}%
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Breadth Bar */}
            <button
                onClick={() => setActiveLogic('breadth')}
                className="w-full bg-gray-800 p-2 rounded border border-gray-700 hover:border-blue-500/50 hover:bg-gray-700/50 transition-all text-left group"
            >
                <div className="flex justify-between text-[10px] text-gray-100 mb-1">
                    <span className="text-green-400 font-bold flex items-center gap-1">
                        ▲ {stats.advancers}
                    </span>
                    <span className="text-gray-200 font-medium flex items-center gap-1 truncate">
                        Breadth
                        <Info className="w-2.5 h-2.5 text-gray-300 group-hover:text-blue-400 transition-colors flex-shrink-0" />
                    </span>
                    <span className="text-red-400 font-bold flex items-center gap-1">
                        ▼ {stats.decliners}
                    </span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden flex">
                    <div
                        className="h-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]"
                        style={{ width: `${(stats.advancers / (stats.advancers + stats.decliners || 1)) * 100}%` }}
                    />
                    <div
                        className="h-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                        style={{ width: `${(stats.decliners / (stats.advancers + stats.decliners || 1)) * 100}%` }}
                    />
                </div>
            </button>

            {/* Sector Performance (Stacked like Indexes) */}
            <div className="pt-2 border-t border-gray-800 space-y-1">
                <h4 className="text-[10px] font-bold text-gray-200 uppercase tracking-widest mb-2 truncate">Sector Performance</h4>
                {sectors.length > 0 ? (
                    sectors.map((sector) => (
                        <button
                            key={sector.name}
                            onClick={() => onSectorClick(sector)}
                            className="w-full flex justify-between items-center text-[10px] bg-gray-900/40 hover:bg-gray-700/50 p-1.5 rounded border border-transparent hover:border-gray-700 transition-all text-left group"
                        >
                            <span className="text-gray-100 font-bold group-hover:text-white transition-colors truncate mr-2">{sector.name}</span>
                            <span className={`font-mono font-bold flex-shrink-0 ${sector.avgChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {sector.avgChange > 0 ? '+' : ''}{sector.avgChange.toFixed(2)}%
                            </span>
                        </button>
                    ))
                ) : (
                    <div className="text-[10px] text-gray-100 animate-pulse text-center py-2">Loading Sectors...</div>
                )}
            </div>

            {/* Logic Explanation Modal */}
            {activeLogic && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setActiveLogic(null)} />
                    <div className="relative z-50 bg-gray-900 border border-gray-700/50 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className={`p-1 bg-gradient-to-r ${activeLogic === 'bullish' ? 'from-blue-500 to-emerald-500' : 'from-emerald-500 to-red-500'}`} />
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-xl font-bold text-white mb-1">
                                        {activeLogic === 'bullish' ? 'Bullish % Indicator' : 'Market Breadth'}
                                    </h2>
                                    <p className="text-gray-200 text-xs">Internal Market Health Metric</p>
                                </div>
                                <button
                                    onClick={() => setActiveLogic(null)}
                                    className="p-2 hover:bg-gray-800 rounded-lg text-gray-200 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                {activeLogic === 'bullish' ? (
                                    <>
                                        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                            <p className="text-[15px] text-white font-medium leading-relaxed">
                                                This monitors our curated universe of **~120 Institutional Mega-Caps** to measure structural market health.
                                            </p>
                                        </div>
                                        <div className="space-y-4 pt-2">
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0 shadow-[0_0_8px_rgba(96,165,250,0.6)]" />
                                                <p className="text-sm text-gray-100 leading-snug">Calculates the percentage of these leading stocks currently trading above both their **50-day and 200-day EMAs**.</p>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0 shadow-[0_0_8px_rgba(96,165,250,0.6)]" />
                                                <p className="text-sm text-gray-100 leading-snug">A reading **above 50%** means the majority of the market's "General" stocks are in a technical uptrend.</p>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 flex-shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                                                <p className="text-sm text-gray-100 leading-snug">**Warning Signal**: If the index is rising but Bullish % is falling, it indicates "Narrow Breadth" — a potential trap where only 2-3 stocks are holding up the entire market.</p>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                            <p className="text-[15px] text-white font-medium leading-relaxed">
                                                Breadth tracks the **immediate raw participation** of our ~120 stock mega-cap universe.
                                            </p>
                                        </div>
                                        <div className="space-y-4 pt-2">
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-green-400 mt-1.5 flex-shrink-0 shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
                                                <p className="text-sm text-gray-100 leading-snug">**Advancers (▲)**: The live count of stocks from our 120-symbol list currently trading **higher** than yesterday's close.</p>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-red-400 mt-1.5 flex-shrink-0 shadow-[0_0_8px_rgba(248,113,113,0.6)]" />
                                                <p className="text-sm text-gray-100 leading-snug">**Decliners (▼)**: The live count of stocks from that same list currently trading **lower** than yesterday's close.</p>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-white mt-1.5 flex-shrink-0 shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
                                                <p className="text-sm text-gray-100 leading-snug">The ratio reveals if a rally is "Full Participation" (whole army moving) or a "Fake Out" (just a few names moving).</p>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="mt-8 flex justify-end">
                                <button
                                    onClick={() => setActiveLogic(null)}
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
    );
}
