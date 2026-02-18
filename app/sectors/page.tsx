"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import LoginOverlay from '@/components/LoginOverlay';
import { ChevronRight } from 'lucide-react';
import type { ConvictionStock } from '@/types/stock';

type SectorGroup = {
    name: string;
    stocks: ConvictionStock[];
};

export default function SectorPage() {
    const [sectors, setSectors] = useState<SectorGroup[]>([]);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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
            setLoading(true);
            try {
                const res = await fetch('/api/conviction');
                if (!res.ok) throw new Error('API Error');
                const allStocks: ConvictionStock[] = await res.json();

                // Group by Sector
                const groups: Record<string, ConvictionStock[]> = {};
                allStocks.forEach(stock => {
                    const sector = stock.sector || 'Other';
                    if (!groups[sector]) groups[sector] = [];
                    groups[sector].push(stock);
                });

                // Convert to array and sort each group by performance (Change %)
                const sectorList = Object.keys(groups).map(name => ({
                    name,
                    stocks: groups[name].sort((a, b) => b.change24h - a.change24h)
                }));

                // Optional: Sort sectors by alphabet or average performance? 
                // Alphabetical for now is fine, or custom order.
                setSectors(sectorList.sort((a, b) => a.name.localeCompare(b.name)));
            } catch (e) {
                console.error("Failed to fetch sectors", e);
            } finally {
                setLoading(false);
            }
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
    }, []);

    if (isAuthenticated === null) return null;

    if (!isAuthenticated) {
        return <LoginOverlay onLoginSuccess={() => setIsAuthenticated(true)} />;
    }

    return (
        <div className="flex h-screen bg-gray-900 text-white font-sans overflow-hidden">
            <div className={`
                fixed inset-y-0 left-0 z-[110] transition-transform duration-300 ease-in-out md:relative md:translate-x-0
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                ${isSidebarOpen ? 'w-[280px]' : 'w-0'} 
                h-full overflow-hidden flex-shrink-0
            `}>
                <Sidebar
                    currentPage="sectors"
                    symbol="SECTOR"
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
                    onSectorClick={() => { }}
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

                <div className="flex-1 p-6 flex flex-col overflow-hidden">
                    <header className="mb-6">
                        <h2 className="text-3xl font-bold tracking-tight text-purple-400">Sector Heatmap</h2>
                        <p className="text-sm text-gray-100 mt-1">
                            Market Performance by Sector • Top Gainers & Losers
                        </p>
                    </header>

                    <div className="flex-1 overflow-y-auto pr-2 pb-6">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-64">
                                <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                <span className="text-lg text-gray-200 animate-pulse">Analyzing Sectors...</span>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {sectors.filter(s => s.name !== 'Internals').map((sector) => {
                                        // Get Top 5 Gainers (Start of array)
                                        const gainers = sector.stocks.filter(s => s.change24h > 0).slice(0, 5);
                                        // Get Top 5 Losers (End of array, reversed)
                                        const losers = [...sector.stocks].filter(s => s.change24h < 0).reverse().slice(0, 5);

                                        // Calculate avg sector change
                                        const avgChange = sector.stocks.reduce((acc, s) => acc + s.change24h, 0) / sector.stocks.length;

                                        return (
                                            <div key={sector.name} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg flex flex-col">
                                                {/* Header */}
                                                <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-850">
                                                    <div>
                                                        <h3 className="text-lg font-bold text-white">{sector.name}</h3>
                                                        <span className="text-xs text-gray-200">{sector.stocks.length} Assets</span>
                                                    </div>
                                                    <div className={`px-2 py-1 rounded text-xs font-bold ${avgChange >= 0 ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
                                                        {avgChange > 0 ? '+' : ''}{avgChange.toFixed(2)}%
                                                    </div>
                                                </div>

                                                {/* Content */}
                                                <div className="p-4 flex-1 flex flex-col space-y-4">

                                                    {/* Gainers */}
                                                    <div>
                                                        <h4 className="text-[10px] uppercase tracking-wider text-gray-200 font-bold mb-2 flex items-center">
                                                            <svg className="w-3 h-3 mr-1 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                                                            Daily Leaders
                                                        </h4>
                                                        {gainers.length > 0 ? (
                                                            <div className="space-y-1">
                                                                {gainers.map(s => (
                                                                    <Link
                                                                        key={s.symbol}
                                                                        href={`/?symbol=${s.symbol}&market=stocks`}
                                                                        className="flex justify-between items-center text-sm p-1 hover:bg-gray-700 rounded cursor-pointer transition-colors"
                                                                    >
                                                                        <span className="font-bold">{s.symbol}</span>
                                                                        <span className="text-green-400 font-mono">+{s.change24h.toFixed(2)}%</span>
                                                                    </Link>
                                                                ))}
                                                            </div>
                                                        ) : <span className="text-xs text-gray-100 italic">No gainers today</span>}
                                                    </div>

                                                    {/* Losers */}
                                                    <div>
                                                        <h4 className="text-[10px] uppercase tracking-wider text-gray-200 font-bold mb-2 flex items-center">
                                                            <svg className="w-3 h-3 mr-1 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"></path></svg>
                                                            Daily Laggers
                                                        </h4>
                                                        {losers.length > 0 ? (
                                                            <div className="space-y-1">
                                                                {losers.map(s => (
                                                                    <Link
                                                                        key={s.symbol}
                                                                        href={`/?symbol=${s.symbol}&market=stocks`}
                                                                        className="flex justify-between items-center text-sm p-1 hover:bg-gray-700 rounded cursor-pointer transition-colors"
                                                                    >
                                                                        <span className="font-bold">{s.symbol}</span>
                                                                        <span className="text-red-400 font-mono">{s.change24h.toFixed(2)}%</span>
                                                                    </Link>
                                                                ))}
                                                            </div>
                                                        ) : <span className="text-xs text-gray-100 italic">No losers today</span>}
                                                    </div>

                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Market Internals moved to Sidebar */}
                            </>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
