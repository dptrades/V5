"use client";

import { useState, useEffect } from 'react';
import { Loader2, TrendingUp, TrendingDown, Zap, Activity, BarChart2, Calendar, Target, ShieldCheck } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import LoginOverlay from '@/components/LoginOverlay';
import { Loading } from '@/components/ui/Loading';
import { DayDreamPick } from '@/lib/daydream';
import { getMarketStatus, MarketStatus } from '@/lib/market';
import { REFRESH_INTERVALS, isMarketActive } from '../../lib/refresh-utils';

export default function DayDreamPage() {
    const [picks, setPicks] = useState<DayDreamPick[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // Update market status every minute
    useEffect(() => {
        const updateStatus = () => setMarketStatus(getMarketStatus());
        updateStatus();
        const interval = setInterval(updateStatus, 60000);
        return () => clearInterval(interval);
    }, []);

    // Auth Check
    useEffect(() => {
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

    // Main Data Fetch Loop
    useEffect(() => {
        if (isAuthenticated) {
            fetchPicks();

            // Auto-refresh every 5 minutes (REFRESH_INTERVALS.DAYDREAM)
            const interval = setInterval(() => {
                // Only refresh if market is active (using centralized logic now)
                if (isMarketActive()) {
                    console.log("[DayDream] Auto-refreshing picks...");
                    fetchPicks();
                } else {
                    console.log("[DayDream] Market inactive, skipping auto-refresh.");
                }
            }, REFRESH_INTERVALS.DAYDREAM);

            return () => clearInterval(interval);
        }
    }, [isAuthenticated]);

    const fetchPicks = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/daydream');
            if (res.ok) {
                const data = await res.json();
                setPicks(data);
                setLastUpdated(new Date());
            }
        } catch (e) {
            console.error("Failed to fetch daydream picks", e);
        } finally {
            setLoading(false);
        }
    };

    if (isAuthenticated === null) return <Loading message="Authenticating..." />;
    if (!isAuthenticated) return <LoginOverlay onLoginSuccess={() => setIsAuthenticated(true)} />;

    return (
        <div className="flex min-h-screen bg-[#050505] text-white font-sans selection:bg-blue-500/30">
            <Sidebar isOpen={true} currentPage="daydream" />

            <main className="flex-1 p-8 lg:p-12 overflow-y-auto overflow-x-hidden relative">
                <div className="max-w-7xl mx-auto space-y-12">

                    {/* Header Section */}
                    <div className="relative">
                        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
                        <div className="absolute -top-24 -right-24 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="h-px w-8 bg-blue-500" />
                                    <span className="text-blue-400 font-bold uppercase tracking-[0.2em] text-[10px]">Institutional Intelligence</span>
                                </div>
                                <h1 className="text-5xl font-black tracking-tighter mb-2 bg-gradient-to-r from-white via-white to-gray-500 bg-clip-text text-transparent">
                                    DayDream <span className="text-blue-500 italic">Picks</span>
                                </h1>
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wider">
                                        Source: Alpaca & Sentiment Analysis
                                    </span>
                                    {lastUpdated && (
                                        <span className="text-[10px] text-gray-300 font-mono">
                                            Updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    )}
                                </div>
                                <p className="text-gray-200 text-sm max-w-lg leading-relaxed">
                                    The "Golden Strike" algorithm identifies high-probability weekly setups by blending technical confluence, news sentiment, and retail social velocity.
                                </p>
                            </div>

                            <div className="flex items-center gap-4">
                                {lastUpdated && (
                                    <div className="text-right">
                                        <div className="text-[9px] text-gray-300 font-bold uppercase tracking-widest mb-0.5">Last Sync</div>
                                        <div className="text-[11px] font-mono text-gray-200">
                                            {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                )}
                                <button
                                    onClick={fetchPicks}
                                    disabled={loading || !!(marketStatus && !marketStatus.isOpen && marketStatus.session === 'OFF')}
                                    className="px-6 py-3 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 rounded-2xl transition-all flex items-center gap-2 text-sm font-bold group"
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-yellow-400 group-hover:scale-110 transition-transform" />}
                                    {marketStatus && !marketStatus.isOpen && marketStatus.session === 'OFF' ? 'Market Closed' : 'Refresh Intel'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {marketStatus && !marketStatus.isOpen && (
                        <div className="relative group">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-3xl blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
                            <div className="relative flex flex-col items-center justify-center p-8 bg-[#0d0d0d] border border-white/5 rounded-3xl text-center space-y-4 overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <Activity className="w-24 h-24" />
                                </div>
                                <div className="p-3 bg-blue-500/10 rounded-2xl">
                                    <Activity className="w-8 h-8 text-blue-400" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black tracking-tight mb-2">Market is closed</h2>
                                    <p className="text-gray-200 text-sm max-w-md mx-auto">
                                        Check back on next market open which is <span className="text-white font-bold">{marketStatus.nextOpen}</span>
                                    </p>
                                </div>
                                <div className="flex items-center gap-6 pt-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-300">
                                    <span className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                        NYSE Closed
                                    </span>
                                    <span className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                        Nasdaq Closed
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {loading ? (
                        <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
                            <div className="relative">
                                <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                                <Zap className="w-6 h-6 text-blue-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                            </div>
                            <p className="text-gray-200 font-medium animate-pulse">Analyzing options chains & sentiment pulse...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {picks.map((pick) => (
                                <div key={pick.symbol} className="group relative">
                                    {/* Card Glow Effect */}
                                    <div className={`absolute -inset-0.5 bg-gradient-to-b ${pick.direction === 'CALL' ? 'from-green-500/20 to-transparent' : 'from-red-500/20 to-transparent'} rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                                    <div className="relative h-full bg-[#0d0d0d] border border-white/5 rounded-[2rem] p-8 flex flex-col overflow-hidden">

                                        {/* Ticker Header */}
                                        <div className="flex justify-between items-start mb-8">
                                            <div>
                                                <h2 className="text-4xl font-black tracking-tighter mb-1">{pick.symbol}</h2>
                                                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${pick.direction === 'CALL' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                                    {pick.direction === 'CALL' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                    {pick.direction} BIAS
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] text-gray-300 font-bold uppercase tracking-widest mb-1">Confidence</div>
                                                <div className="text-3xl font-black text-white">{pick.confidence}%</div>
                                            </div>
                                        </div>

                                        {/* Score Matrix */}
                                        <div className="grid grid-cols-3 gap-4 mb-8">
                                            <ScoreWidget label="TECH" score={pick.technicalScore} color="blue" />
                                            <ScoreWidget label="NEWS" score={pick.sentimentScore} color="purple" />
                                            <ScoreWidget label="SOCIAL" score={pick.socialScore} color="orange" />
                                        </div>

                                        {/* Reasoning */}
                                        <div className="mb-8 p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                                            <p className="text-xs text-gray-200 leading-relaxed italic">
                                                "{pick.reason}"
                                            </p>
                                        </div>

                                        {/* Golden Strikes */}
                                        <div className="space-y-4 flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Target className="w-4 h-4 text-blue-500" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-200">Top Strikes (Weekly)</span>
                                            </div>

                                            {pick.options.map((opt, i) => (
                                                <div key={i} className="p-4 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 rounded-2xl transition-all cursor-default group/opt">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-lg font-bold">${opt.strike} {opt.type}</span>
                                                        <span className="text-xs font-mono text-blue-400">${opt.contractPrice?.toFixed(2) || '0.00'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-[10px] text-gray-300 font-medium">
                                                        <div className="flex items-center gap-3">
                                                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {opt.expiry}</span>
                                                            <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> Vol/OI: {((opt.volume || 0) / (opt.openInterest || 1)).toFixed(1)}x</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <ShieldCheck className="w-3 h-3 text-green-500" />
                                                            {Math.round((opt.probabilityITM || 0) * 100)}% ITM
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Bottom Action */}
                                        <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center">
                                            <div className="text-[10px] text-gray-300 uppercase font-bold tracking-widest">Strike Health: Optimal</div>
                                            <div className="flex -space-x-2">
                                                {[1, 2, 3].map(i => (
                                                    <div key={i} className="w-6 h-6 rounded-full bg-gray-800 border-2 border-[#0d0d0d] flex items-center justify-center">
                                                        <Zap className="w-3 h-3 text-yellow-500/50" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Footer Info */}
                    <div className="pt-12 border-t border-white/5 text-center">
                        <p className="text-[10px] text-gray-400 uppercase tracking-[0.3em] font-bold">
                            Advanced Options Intelligence • Real-Time Data via Public.com & Alpaca
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}

function ScoreWidget({ label, score, color }: { label: string, score: number, color: 'blue' | 'purple' | 'orange' }) {
    const colorClasses = {
        blue: 'text-blue-400 bg-blue-400/10',
        purple: 'text-purple-400 bg-purple-400/10',
        orange: 'text-orange-400 bg-orange-400/10'
    };

    return (
        <div className="text-center p-3 rounded-2xl bg-white/[0.02] border border-white/5">
            <div className={`text-[9px] font-black mb-1 uppercase tracking-widest ${colorClasses[color].split(' ')[0]}`}>{label}</div>
            <div className="text-xl font-black">{score}</div>
            <div className="mt-2 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <div
                    className={`h-full ${colorClasses[color].split(' ')[1].replace('/10', '')}`}
                    style={{ width: `${score}%` }}
                />
            </div>
        </div>
    );
}
