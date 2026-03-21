"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Clock, Activity, ChevronLeft, Target, Shield, Zap, Info, Trash2, RefreshCw } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { Loading } from '@/components/ui/Loading';
import { TrackedOption } from '@/lib/tracking';
import { calculatePriceStats } from '@/lib/stats';
import { detectPatterns } from '@/lib/patterns';
import { calculateIndicators } from '@/lib/indicators';

export default function PerformancePage() {
    const [trackedOptions, setTrackedOptions] = useState<TrackedOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const fetchTracked = async (isManualRefresh = false) => {
        if (isManualRefresh) setIsRefreshing(true);
        try {
            const res = await fetch('/api/options/tracked', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                setTrackedOptions(data);
            }
        } catch (e) {
            console.error('Failed to fetch tracked options:', e);
        } finally {
            if (isManualRefresh) setIsRefreshing(false);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTracked();
    }, []);

    const handleDelete = async (id: string) => {
        // Removed native confirm to ensure 100% compatibility across all browsers
        console.log(`[Performance] Deleting tracker for:`, id);
        try {
            const res = await fetch(`/api/options/tracked/${encodeURIComponent(id)}`, {
                method: 'DELETE',
                cache: 'no-store'
            });
            if (res.ok) {
                setTrackedOptions(prev => prev.filter(o => o.id !== id));
            } else {
                const text = await res.text();
                alert(`Failed to delete (Status ${res.status}): ${text}`);
            }
        } catch (e: any) {
            console.error('Error deleting option:', e);
            alert(`Network error: ${e.message}`);
        }
    };


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
                            <button
                                onClick={() => fetchTracked(true)}
                                disabled={isRefreshing}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl border border-gray-700 transition-all font-bold text-sm disabled:opacity-50 group"
                            >
                                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-400' : 'group-hover:text-blue-400 transition-colors'}`} />
                                {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
                            </button>
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
                        <div className="flex flex-col gap-12 pb-12">
                            {/* Grouping Logic */}
                            {(() => {
                                const active: TrackedOption[] = [];
                                const profit: TrackedOption[] = [];
                                const loss: TrackedOption[] = [];

                                trackedOptions.forEach(option => {
                                    const perf = calculateGainLoss(option);
                                    if (option.status === 'PROFIT' || perf >= 25) {
                                        profit.push(option);
                                    } else if (option.status === 'LOSS' || perf <= -25) {
                                        loss.push(option);
                                    } else {
                                        active.push(option);
                                    }
                                });

                                const renderOptionCard = (option: TrackedOption) => {
                                    const performance = calculateGainLoss(option);
                                    const isPositive = performance >= 0;

                                    return (
                                        <div key={option.id} className="bg-gray-800/40 border border-gray-700/50 rounded-3xl p-6 backdrop-blur-sm hover:border-blue-500/30 transition-all group relative">
                                            <button
                                                onClick={() => handleDelete(option.id)}
                                                className="absolute top-4 right-4 p-2 bg-gray-900/50 border border-gray-700/50 rounded-xl text-gray-500 hover:text-rose-400 hover:border-rose-500/50 transition-colors z-20 opacity-40 group-hover:opacity-100"
                                                title="Stop Tracking"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
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
                                                    <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest flex items-center gap-2">
                                                        Premium Trend
                                                        {(option.status === 'PROFIT' || option.status === 'LOSS') && (
                                                            <span className={`px-1.5 py-0.5 rounded text-[8px] border ${option.status === 'PROFIT' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}`}>
                                                                LOCKED
                                                            </span>
                                                        )}
                                                    </span>
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
                                };

                                return (
                                    <>
                                        {/* Active Trackers */}
                                        {active.length > 0 && (
                                            <section>
                                                <div className="flex items-center gap-3 mb-6">
                                                    <div className="p-2 border border-blue-500/30 bg-blue-500/10 rounded-xl">
                                                        <Activity className="w-5 h-5 text-blue-400" />
                                                    </div>
                                                    <h2 className="text-xl font-black text-white uppercase tracking-tighter">Active Trackers</h2>
                                                    <div className="h-px bg-gray-800 flex-1 ml-4" />
                                                </div>
                                                <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
                                                    {active.map(renderOptionCard)}
                                                </div>
                                            </section>
                                        )}

                                        {/* Profit Targets Hit */}
                                        {profit.length > 0 && (
                                            <section>
                                                <div className="flex items-center gap-3 mb-6">
                                                    <div className="p-2 border border-emerald-500/30 bg-emerald-500/10 rounded-xl">
                                                        <Target className="w-5 h-5 text-emerald-400" />
                                                    </div>
                                                    <h2 className="text-xl font-black text-emerald-400 uppercase tracking-tighter">Profit Targets Hit (+25%)</h2>
                                                    <div className="h-px bg-gray-800 flex-1 ml-4" />
                                                </div>
                                                <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6 opacity-80 hover:opacity-100 transition-opacity">
                                                    {profit.map(renderOptionCard)}
                                                </div>
                                            </section>
                                        )}

                                        {/* Stop Loss Hit */}
                                        {loss.length > 0 && (
                                            <section>
                                                <div className="flex items-center gap-3 mb-6">
                                                    <div className="p-2 border border-rose-500/30 bg-rose-500/10 rounded-xl">
                                                        <TrendingDown className="w-5 h-5 text-rose-400" />
                                                    </div>
                                                    <h2 className="text-xl font-black text-rose-400 uppercase tracking-tighter">Stop Loss Hit (-25%)</h2>
                                                    <div className="h-px bg-gray-800 flex-1 ml-4" />
                                                </div>
                                                <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6 opacity-80 hover:opacity-100 transition-opacity">
                                                    {loss.map(renderOptionCard)}
                                                </div>
                                            </section>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
