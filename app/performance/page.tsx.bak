"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Clock, Activity, ChevronLeft, Target, Shield, Zap, Info } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { Loading } from '@/components/ui/Loading';
import { TrackedOption } from '@/lib/tracking';
import { calculatePriceStats } from '@/lib/stats';
import { detectPatterns } from '@/lib/patterns';
import { calculateIndicators } from '@/lib/indicators';

export default function PerformancePage() {
    const [trackedOptions, setTrackedOptions] = useState<TrackedOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    useEffect(() => {
        const fetchTracked = async () => {
            try {
                const res = await fetch('/api/options/tracked');
                if (res.ok) {
                    const data = await res.json();
                    setTrackedOptions(data);
                }
            } catch (e) {
                console.error('Failed to fetch tracked options:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchTracked();
    }, []);

    const calculateGainLoss = (option: TrackedOption) => {
        if (option.history.length === 0) return 0;
        const currentPremium = option.history[option.history.length - 1].optionPremium;
        const entryPremium = option.entryPremium;
        if (entryPremium === 0) return 0;
        return ((currentPremium - entryPremium) / entryPremium) * 100;
    };

    const renderChart = (option: TrackedOption) => {
        const data = option.history.map(h => ({
            date: h.date.split('-').slice(1).join('/'),
            premium: h.optionPremium,
            stock: h.stockPrice
        }));

        const isPositive = calculateGainLoss(option) >= 0;

        return (
            <div className="h-40 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                        <XAxis
                            dataKey="date"
                            stroke="#9CA3AF"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            hide
                            domain={['auto', 'auto']}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                            itemStyle={{ fontSize: '10px' }}
                            labelStyle={{ fontSize: '10px', color: '#9CA3AF' }}
                        />
                        <Line
                            type="monotone"
                            dataKey="premium"
                            stroke={isPositive ? '#10B981' : '#EF4444'}
                            strokeWidth={2}
                            dot={data.length < 10}
                            animationDuration={1500}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        );
    };

    return (
        <main className="flex h-screen bg-gray-900 overflow-hidden font-sans text-gray-100 relative">
            <div className={`
                fixed inset-y-0 left-0 z-[110] transition-transform duration-300 ease-in-out md:relative md:translate-x-0
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                ${isSidebarOpen ? 'w-[18vw] min-w-[200px]' : 'w-0'} 
                h-full overflow-hidden flex-shrink-0 border-r border-gray-800
            `}>
                <Sidebar
                    isOpen={isSidebarOpen}
                    setIsOpen={setIsSidebarOpen}
                />
            </div>

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                <div className="flex-1 p-4 md:p-8 flex flex-col overflow-y-auto w-full pt-16 md:pt-8 transition-all duration-300">
                    <header className="mb-8">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                                    <TrendingUp className="w-8 h-8 text-blue-400" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Tracked Performance</h1>
                                    <p className="text-gray-400 text-sm font-medium">Real-time performance of your tactical option picks</p>
                                </div>
                            </div>
                        </div>
                    </header>

                    {loading ? (
                        <Loading message="Loading performance data..." />
                    ) : trackedOptions.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-gray-800/20 rounded-3xl border-2 border-dashed border-gray-800">
                            <div className="p-4 bg-gray-800/50 rounded-full mb-4">
                                <Zap className="w-12 h-12 text-gray-500" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-300 mb-2">No Active Trackers</h2>
                            <p className="text-gray-500 max-w-sm">
                                Go to the dashboard and click the track button on an option suggestion to start monitoring its performance.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
                            {trackedOptions.map((option) => {
                                const performance = calculateGainLoss(option);
                                const isPositive = performance >= 0;

                                return (
                                    <div key={option.id} className="bg-gray-800/40 border border-gray-700/50 rounded-3xl p-6 backdrop-blur-sm hover:border-blue-500/30 transition-all group">
                                        <div className="flex justify-between items-start mb-6">
                                            <div>
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <Link
                                                        href={`/?symbol=${(option.ticker || '').trim()}`}
                                                        className="text-2xl font-black text-white tracking-tighter uppercase hover:text-blue-400 transition-colors cursor-pointer"
                                                    >
                                                        {(option.ticker || '').trim()}
                                                    </Link>
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${option.type === 'CALL' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                                        {option.type}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wide truncate max-w-[120px]">
                                                        {option.companyName}
                                                    </span>
                                                    <span className="text-xs font-black text-blue-400 tracking-tight">
                                                        ${option.strike} Strike
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className={`text-2xl font-black tracking-tighter ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {isPositive ? '+' : ''}{performance.toFixed(1)}%
                                                </div>
                                                <div className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Premium ROI</div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 mb-6">
                                            <div className="bg-gray-900/50 p-3 rounded-2xl border border-gray-700/30">
                                                <div className="text-[10px] text-gray-500 uppercase font-black mb-1 tracking-widest flex items-center gap-1">
                                                    <Clock className="w-3 h-3" /> Expiry
                                                </div>
                                                <div className="text-sm font-bold text-gray-200">{option.expiry}</div>
                                            </div>
                                            <div className="bg-gray-900/50 p-3 rounded-2xl border border-gray-700/30">
                                                <div className="text-[10px] text-gray-500 uppercase font-black mb-1 tracking-widest flex items-center gap-1">
                                                    <Shield className="w-3 h-3" /> Entry
                                                </div>
                                                <div className="text-sm font-bold text-gray-200">${option.entryPremium.toFixed(2)}</div>
                                            </div>
                                        </div>

                                        <div className="mb-4">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Premium Trend</span>
                                                <span className="text-[10px] text-gray-400 font-mono">{option.history.length} Data Points</span>
                                            </div>
                                            {renderChart(option)}
                                        </div>

                                        <div className="pt-4 border-t border-gray-700/30">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Info className="w-3 h-3 text-blue-400" />
                                                <span className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Technical Logic</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {option.reasoning.map((reason, i) => (
                                                    <span key={i} className="text-[9px] bg-gray-900/50 text-gray-400 px-2 py-0.5 rounded border border-gray-700/50 font-medium whitespace-nowrap">
                                                        {reason}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
