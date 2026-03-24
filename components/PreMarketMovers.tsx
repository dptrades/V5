"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    TrendingUp, TrendingDown, Activity, Zap, Clock, RefreshCw,
    Newspaper, MessageCircle, BarChart2, Star, Target, FlaskConical,
    CandlestickChart, ArrowUpRight, ArrowDownRight, Megaphone, Filter
} from 'lucide-react';
import { PreMarketMover, CatalystType, GapQuality, assessGapQuality } from '../lib/pre-market-engine';
import RefreshClock from './RefreshClock';

// ─── Filter Types ──────────────────────────────────────────────────────────
type FilterType = 'all' | 'earnings' | 'fda' | 'upgrade' | 'momentum' | 'social' | 'options';

// ─── Helpers ──────────────────────────────────────────────────────────────
function formatPrice(p: number | null) {
    if (p === null) return '—';
    return `$${p.toFixed(2)}`;
}
function formatVolume(v: number | null) {
    if (v === null) return '—';
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return v.toString();
}
function getMarketSession(): 'pre' | 'open' | 'after' | 'closed' {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const t = h * 60 + m;
    if (t >= 4 * 60 && t < 9 * 60 + 30) return 'pre';
    if (t >= 9 * 60 + 30 && t < 16 * 60) return 'open';
    if (t >= 16 * 60 && t < 20 * 60) return 'after';
    return 'closed';
}

// ─── Catalyst Badge Config ─────────────────────────────────────────────────
const CATALYST_CONFIG: Record<CatalystType, { label: string; color: string; icon: React.FC<any> }> = {
    earnings: { label: 'Earnings', color: 'bg-amber-500/15 text-amber-400 border-amber-500/25', icon: CandlestickChart },
    fda: { label: 'FDA', color: 'bg-rose-500/15 text-rose-400 border-rose-500/25', icon: FlaskConical },
    upgrade: { label: 'Upgrade', color: 'bg-blue-500/15 text-blue-400 border-blue-500/25', icon: TrendingUp },
    macro: { label: 'Macro', color: 'bg-purple-500/15 text-purple-400 border-purple-500/25', icon: Megaphone },
    options: { label: 'Options', color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25', icon: Target },
    social: { label: 'Social', color: 'bg-orange-500/15 text-orange-400 border-orange-500/25', icon: MessageCircle },
    momentum: { label: 'Momentum', color: 'bg-green-500/15 text-green-400 border-green-500/25', icon: Activity },
    unknown: { label: 'Signal', color: 'bg-gray-500/15 text-gray-400 border-gray-500/25', icon: Zap },
};

// ─── Gap Quality Config ────────────────────────────────────────────────────
const GAP_QUALITY_CONFIG: Record<GapQuality, { label: string; color: string }> = {
    high: { label: '✦ High Quality', color: 'text-emerald-400' },
    speculative: { label: '◆ Speculative', color: 'text-amber-400' },
    dangerous: { label: '⚠ Dangerous', color: 'text-rose-400' },
};

// ─── Score Bar ─────────────────────────────────────────────────────────────
function ScoreBar({ score }: { score: number }) {
    let barColor = 'bg-gray-500';
    if (score >= 85) barColor = 'bg-gradient-to-r from-yellow-400 to-orange-500';
    else if (score >= 70) barColor = 'bg-gradient-to-r from-blue-400 to-cyan-400';
    else if (score >= 55) barColor = 'bg-gradient-to-r from-emerald-500 to-green-400';
    return (
        <div className="mt-2 h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
            <div
                className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                style={{ width: `${score}%` }}
            />
        </div>
    );
}

// ─── RVOL Badge ────────────────────────────────────────────────────────────
function RvolBadge({ rvol }: { rvol: number | null }) {
    if (!rvol) return null;
    const extreme = rvol >= 5;
    const high = rvol >= 2;
    return (
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${extreme ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                high ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' :
                    'bg-blue-500/20 text-blue-300 border-blue-500/30'
            }`}>
            {rvol.toFixed(1)}× RVOL
        </span>
    );
}

// ─── Mover Card ────────────────────────────────────────────────────────────
function MoverCard({
    mover,
    isWatchlisted,
    onToggleWatchlist
}: {
    mover: PreMarketMover;
    isWatchlisted: boolean;
    onToggleWatchlist: (sym: string) => void;
}) {
    const gapUp = (mover.gapPercent ?? 0) >= 0;
    const catalystCfg = CATALYST_CONFIG[mover.catalystType] || CATALYST_CONFIG.unknown;
    const CatIcon = catalystCfg.icon;
    const gapQuality = assessGapQuality(mover);
    const gapQualityCfg = GAP_QUALITY_CONFIG[gapQuality];
    const glowColor = mover.catalystScore >= 85
        ? 'hover:border-yellow-500/30 hover:shadow-[0_0_24px_rgba(234,179,8,0.1)]'
        : mover.catalystScore >= 70
            ? 'hover:border-blue-500/30 hover:shadow-[0_0_24px_rgba(59,130,246,0.1)]'
            : 'hover:border-white/15';

    return (
        <div className={`relative bg-white/[0.025] border border-white/8 rounded-2xl p-5 transition-all duration-300 group ${glowColor} flex flex-col gap-3`}>
            {/* Star watchlist button */}
            <button
                onClick={() => onToggleWatchlist(mover.symbol)}
                className={`absolute top-3 right-3 p-1 rounded-lg transition-colors ${isWatchlisted ? 'text-yellow-400' : 'text-gray-600 hover:text-gray-400'}`}
                title={isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist'}
            >
                <Star className="w-3.5 h-3.5" fill={isWatchlisted ? 'currentColor' : 'none'} />
            </button>

            {/* Row 1: Symbol + Score */}
            <div className="flex justify-between items-start pr-6">
                <div>
                    <Link href={`/?symbol=${mover.symbol}`} className="text-xl font-black tracking-tight hover:text-blue-400 transition-colors">
                        {mover.symbol}
                    </Link>
                    <div className="text-[10px] text-gray-500 font-medium truncate max-w-[130px] mt-0.5" title={mover.name}>
                        {mover.name || mover.symbol}
                    </div>
                </div>
                <div className="text-right">
                    <div className={`text-lg font-black ${mover.catalystScore >= 85 ? 'text-yellow-400' :
                            mover.catalystScore >= 70 ? 'text-blue-400' : 'text-gray-300'
                        }`}>{mover.catalystScore}</div>
                    <div className="text-[8px] text-gray-500 font-black uppercase tracking-widest">Score</div>
                </div>
            </div>

            {/* Score Bar */}
            <ScoreBar score={mover.catalystScore} />

            {/* Row 2: Price + Gap */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-sm font-bold text-white">{formatPrice(mover.preMarketPrice)}</div>
                    <div className="text-[9px] text-gray-500 uppercase tracking-wider">Pre-Mkt</div>
                </div>
                {mover.gapPercent !== null && (
                    <div className={`flex items-center gap-1 text-sm font-black ${gapUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {gapUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                        {gapUp ? '+' : ''}{mover.gapPercent}%
                    </div>
                )}
            </div>

            {/* Row 3: RVOL + Volume */}
            <div className="flex items-center gap-2 flex-wrap">
                <RvolBadge rvol={mover.rvol} />
                {mover.preMarketVolume && (
                    <span className="text-[9px] text-gray-500 font-mono">
                        Vol {formatVolume(mover.preMarketVolume)}
                    </span>
                )}
                {mover.avgVolume && (
                    <span className="text-[9px] text-gray-600 font-mono">
                        / avg {formatVolume(mover.avgVolume)}
                    </span>
                )}
            </div>

            {/* Row 4: Catalyst type + Gap Quality */}
            <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[9px] font-black uppercase tracking-wider ${catalystCfg.color}`}>
                    <CatIcon className="w-3 h-3" />
                    {catalystCfg.label}
                </span>
                {mover.gapPercent !== null && (
                    <span className={`text-[9px] font-bold ${gapQualityCfg.color}`}>
                        {gapQualityCfg.label}
                    </span>
                )}
            </div>

            {/* Row 5: Factor badges */}
            <div className="flex gap-1.5 flex-wrap">
                {mover.factors.volume && (
                    <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[8px] font-black uppercase flex items-center gap-1">
                        <BarChart2 className="w-2.5 h-2.5" /> VOL
                    </span>
                )}
                {mover.factors.price && (
                    <span className="px-1.5 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded text-[8px] font-black uppercase flex items-center gap-1">
                        <TrendingUp className="w-2.5 h-2.5" /> GAP
                    </span>
                )}
                {mover.factors.news && (
                    <span className="px-1.5 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded text-[8px] font-black uppercase flex items-center gap-1">
                        <Newspaper className="w-2.5 h-2.5" /> NEWS
                    </span>
                )}
                {mover.factors.social && (
                    <span className="px-1.5 py-0.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded text-[8px] font-black uppercase flex items-center gap-1">
                        <MessageCircle className="w-2.5 h-2.5" /> BUZZ
                    </span>
                )}
            </div>

            {/* Row 6: Catalyst reason */}
            <div className="text-[10px] text-gray-400 leading-relaxed font-mono line-clamp-2 border-t border-white/5 pt-2" title={mover.catalystReason}>
                {mover.catalystReason || mover.signal.replace(/ \| /g, ' · ')}
            </div>
        </div>
    );
}

// ─── Filter Tabs ───────────────────────────────────────────────────────────
const FILTER_TABS: { key: FilterType; label: string; icon: React.FC<any> }[] = [
    { key: 'all', label: 'All', icon: Zap },
    { key: 'earnings', label: 'Earnings', icon: CandlestickChart },
    { key: 'fda', label: 'FDA', icon: FlaskConical },
    { key: 'upgrade', label: 'Upgrades', icon: TrendingUp },
    { key: 'momentum', label: 'Movers', icon: Activity },
    { key: 'social', label: 'Social', icon: MessageCircle },
    { key: 'options', label: 'Options', icon: Target },
];

// ─── Market Session Banner ─────────────────────────────────────────────────
function SessionBanner({ session }: { session: ReturnType<typeof getMarketSession> }) {
    if (session === 'pre') return null; // Page is most useful, no banner needed

    const configs = {
        open: { msg: 'Market is OPEN — data reflects live session', color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', dot: 'bg-emerald-400' },
        after: { msg: 'After-hours session active — data may be delayed', color: 'bg-blue-500/10 border-blue-500/20 text-blue-400', dot: 'bg-blue-400' },
        closed: { msg: 'Market CLOSED — pre-market opens at 4:00 AM ET', color: 'bg-gray-500/10 border-gray-500/20 text-gray-400', dot: 'bg-gray-500' },
    };
    const c = configs[session];

    return (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${c.color} mb-6 text-xs font-semibold`}>
            <div className={`w-2 h-2 rounded-full ${c.dot} ${session === 'open' ? 'animate-pulse' : ''}`} />
            {c.msg}
            {session === 'open' && (
                <Link href="/" className="ml-auto underline opacity-70 hover:opacity-100">Go to Dashboard →</Link>
            )}
        </div>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function PreMarketMovers() {
    const [movers, setMovers] = useState<PreMarketMover[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');
    const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
    const [session, setSession] = useState<ReturnType<typeof getMarketSession>>('closed');
    const [countdown, setCountdown] = useState(600); // 10m

    // Load watchlist from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('premarket_watchlist');
        if (saved) {
            try { setWatchlist(new Set(JSON.parse(saved))); } catch { }
        }
        setSession(getMarketSession());
    }, []);

    const toggleWatchlist = (symbol: string) => {
        setWatchlist(prev => {
            const next = new Set(prev);
            if (next.has(symbol)) next.delete(symbol); else next.add(symbol);
            localStorage.setItem('premarket_watchlist', JSON.stringify([...next]));
            return next;
        });
    };

    const fetchMovers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/pre-market');
            if (res.ok) {
                const data = await res.json();
                setMovers(data);
                setLastUpdated(new Date());
                setSession(getMarketSession());
            }
        } catch (e) {
            console.error('Failed to fetch pre-market movers', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMovers();
        // Timer for the visual clock (10m during pre-market)
        const tick = setInterval(() => {
            const s = getMarketSession();
            if (s === 'pre') {
                setCountdown(prev => {
                    if (prev <= 1) {
                        fetchMovers();
                        return 600;
                    }
                    return prev - 1;
                });
            } else {
                setCountdown(600); // Reset for next pre-market
            }
        }, 1000);

        return () => clearInterval(tick);
    }, [fetchMovers]);

    // ── Filtered movers ──────────────────────────────────────────────────
    const filtered = movers.filter(m => {
        if (activeFilter === 'all') return true;
        return m.catalystType === activeFilter;
    });

    // ── Watchlisted movers (pinned to top) ────────────────────────────────
    const starred = filtered.filter(m => watchlist.has(m.symbol));
    const rest = filtered.filter(m => !watchlist.has(m.symbol));
    const displayMovers = [...starred, ...rest];

    // ── Top stats banner ────────────────────────────────────────────────
    const avgGap = movers.length > 0
        ? (movers.reduce((s, m) => s + (m.gapPercent ?? 0), 0) / movers.length).toFixed(1)
        : null;
    const topGainer = movers.reduce<PreMarketMover | null>((best, m) =>
        (m.gapPercent ?? -999) > (best?.gapPercent ?? -999) ? m : best, null);
    const topRvol = movers.reduce<PreMarketMover | null>((best, m) =>
        (m.rvol ?? 0) > (best?.rvol ?? 0) ? m : best, null);

    if (loading && movers.length === 0) {
        return (
            <div className="bg-[#0d0d0d] border border-white/5 rounded-[2rem] p-12 flex flex-col items-center justify-center min-h-[220px]">
                <div className="relative mb-4">
                    <div className="w-14 h-14 border-4 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin" />
                    <Zap className="w-5 h-5 text-yellow-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                </div>
                <p className="text-gray-400 text-sm font-semibold animate-pulse">Scanning Pre-Market Catalysts...</p>
                <p className="text-gray-600 text-xs mt-1">Fetching price, volume & news data</p>
            </div>
        );
    }

    if (!loading && movers.length === 0) return null;

    return (
        <div className="space-y-6">
            {/* Session Banner */}
            <SessionBanner session={session} />

            {/* Stats Strip */}
            {movers.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: 'Avg Gap', value: avgGap ? `${Number(avgGap) >= 0 ? '+' : ''}${avgGap}%` : '—', color: 'text-white' },
                        { label: 'Top Gainer', value: topGainer ? `${topGainer.symbol} +${topGainer.gapPercent}%` : '—', color: 'text-emerald-400' },
                        { label: 'Highest RVOL', value: topRvol?.rvol ? `${topRvol.symbol} ${topRvol.rvol.toFixed(1)}×` : '—', color: 'text-blue-400' },
                    ].map(({ label, value, color }) => (
                        <div key={label} className="bg-white/[0.025] border border-white/8 rounded-xl px-4 py-3 text-center">
                            <div className="text-[9px] text-gray-500 uppercase tracking-widest font-black mb-1">{label}</div>
                            <div className={`text-sm font-black ${color} truncate`}>{value}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Main Panel */}
            <div className="bg-[#0d0d0d] border border-white/5 rounded-[2rem] p-8">
                {/* Header */}
                <div className="flex justify-between items-start mb-6 gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                            <Zap className="w-5 h-5 text-yellow-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black tracking-tight text-white">Pre-Market Intelligence</h2>
                            <div className="text-xs text-gray-400 font-semibold mt-0.5">
                                {movers.length} catalysts · Scored by volume, gap, news & RVOL
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {lastUpdated && session === 'pre' && (
                            <RefreshClock countdown={countdown} total={600} label="Next Scan" size="sm" color="#EAB308" />
                        )}
                        {lastUpdated && (
                            <div className="text-[10px] text-gray-500 font-mono hidden sm:block">
                                <Clock className="w-3 h-3 inline mr-1" />
                                {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        )}
                        <button
                            onClick={() => {
                                fetchMovers();
                                setCountdown(600);
                            }}
                            disabled={loading}
                            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors disabled:opacity-50 text-gray-400 hover:text-white"
                            title="Refresh"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2 mb-6 flex-wrap">
                    <Filter className="w-3.5 h-3.5 text-gray-500 self-center mr-1" />
                    {FILTER_TABS.map(({ key, label, icon: Icon }) => {
                        const count = key === 'all' ? movers.length : movers.filter(m => m.catalystType === key).length;
                        if (key !== 'all' && count === 0) return null;
                        return (
                            <button
                                key={key}
                                onClick={() => setActiveFilter(key)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${activeFilter === key
                                        ? 'bg-white/10 border-white/20 text-white'
                                        : 'bg-white/[0.02] border-white/8 text-gray-500 hover:text-gray-300 hover:border-white/15'
                                    }`}
                            >
                                <Icon className="w-3 h-3" />
                                {label}
                                <span className="ml-0.5 opacity-60">{count}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Watchlist Section (if any starred in current filter) */}
                {starred.length > 0 && (
                    <div className="mb-6">
                        <div className="flex items-center gap-2 mb-3">
                            <Star className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-yellow-400">Watchlist</span>
                            <div className="h-px bg-yellow-500/20 flex-1" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {starred.map(m => (
                                <MoverCard key={m.symbol} mover={m} isWatchlisted={true} onToggleWatchlist={toggleWatchlist} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Results grid */}
                {rest.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                        {rest.map(m => (
                            <MoverCard key={m.symbol} mover={m} isWatchlisted={watchlist.has(m.symbol)} onToggleWatchlist={toggleWatchlist} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 text-gray-600 text-sm">
                        No {activeFilter !== 'all' ? activeFilter : ''} catalysts found in this scan.
                        <button onClick={() => setActiveFilter('all')} className="ml-2 text-blue-400 underline">Show all</button>
                    </div>
                )}
            </div>
        </div>
    );
}
