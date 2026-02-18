import React, { useEffect, useState } from 'react';
import { Shield, Activity, Target, Zap, Info, X } from 'lucide-react';

interface FundamentalData {
    marketCap: number;
    qualityScore: number;
    metrics: {
        epsGrowth: number;
        roe: number;
        peg: number;
        pe: number;
        de: number;
        fcf: number;
    };
    checks: {
        epsGrowth: boolean;
        roe: boolean;
        peg: boolean;
        pe: boolean;
        de: boolean;
        fcf: boolean;
    };
}

interface HeaderFundamentalsProps {
    symbol: string;
}

export default function HeaderFundamentals({ symbol }: HeaderFundamentalsProps) {
    const [data, setData] = useState<FundamentalData | null>(null);
    const [loading, setLoading] = useState(true);
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        let ignore = false;
        setShowDetails(false); // Reset on symbol change
        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/fundamentals/${symbol}`);
                if (!res.ok) throw new Error('Failed to fetch');
                const json = await res.json();
                if (!ignore) {
                    setData(json);
                }
            } catch (err) {
                console.error('Error fetching fundamentals:', err);
            } finally {
                if (!ignore) setLoading(false);
            }
        };

        fetchData();
        return () => { ignore = true; };
    }, [symbol]);

    if (loading) return <div className="h-10 w-48 bg-gray-800/50 rounded-xl animate-pulse" />;

    // Fallback if data is missing (common for ETFs in Finnhub Basic Metrics)
    if (!data || !data.marketCap) {
        return (
            <div className="flex items-center gap-4 px-4 py-2 rounded-xl bg-gray-900/60 border border-gray-800/50 opacity-60 grayscale cursor-help" title="Fundamentals only available for individual stocks.">
                <div className="flex flex-col gap-1 pr-4 border-r border-gray-800">
                    <span className="text-[8px] text-gray-400 font-bold uppercase tracking-widest leading-none">Market Cap</span>
                    <span className="text-sm font-black text-gray-500 leading-none">N/A</span>
                </div>
                <div className="flex flex-col gap-1 text-[8px] text-gray-500 font-bold uppercase tracking-widest">
                    <span>Business Vitality</span>
                    <span className="text-[10px] text-gray-600">NOT AVAILABLE</span>
                </div>
            </div>
        );
    }

    const formatMarketCap = (mc: number) => {
        if (mc >= 1000000) return `$${(mc / 1000000).toFixed(2)}T`;
        if (mc >= 1000) return `$${(mc / 1000).toFixed(2)}B`;
        return `$${mc.toFixed(2)}M`;
    };

    const getScoreColor = (score: number) => {
        if (score >= 5) return 'text-green-400';
        if (score >= 3) return 'text-yellow-400';
        return 'text-red-400';
    };

    const scoreTitle = data.qualityScore >= 5 ? "Elite" : data.qualityScore >= 3 ? "Strong" : "Weak";

    return (
        <div className="flex items-center gap-4 px-4 py-2 rounded-xl bg-gray-900/80 border border-gray-800 shadow-xl relative group">
            {/* Market Cap */}
            <div className="flex flex-col gap-1 pr-4 border-r border-gray-800">
                <span className="text-[8px] text-gray-200 font-bold uppercase tracking-widest leading-none">Market Cap</span>
                <span className="text-sm font-black text-white leading-none">
                    {formatMarketCap(data.marketCap)}
                </span>
            </div>

            {/* Vitality Score */}
            <div className="flex items-center gap-3">
                <div className="relative">
                    <Zap className={`w-4 h-4 ${getScoreColor(data.qualityScore)}`} />
                    {data.qualityScore >= 5 && (
                        <Zap className="w-4 h-4 absolute inset-0 text-green-400 animate-ping opacity-20" />
                    )}
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-[8px] text-gray-200 font-bold uppercase tracking-widest leading-none">Business Vitality</span>
                    <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold ${getScoreColor(data.qualityScore)} leading-none uppercase`}>
                            {scoreTitle}
                        </span>
                        <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5, 6].map((s) => (
                                <div
                                    key={s}
                                    className={`w-1.5 h-1.5 rounded-full ${s <= data.qualityScore ? getScoreColor(data.qualityScore).replace('text', 'bg') : 'bg-gray-700'}`}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Info Button */}
            <button
                onClick={() => setShowDetails(!showDetails)}
                className={`p-1 rounded-md transition-colors ${showDetails ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                title="View Analysis Details"
            >
                <Info className="w-3.5 h-3.5" />
            </button>

            {/* Detailed Dropdown Analysis */}
            {showDetails && (
                <div className="absolute top-full left-0 mt-2 z-[150] w-[260px] bg-gray-900 border border-gray-700 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] p-4 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                            <Target className="w-3 h-3 text-blue-400" /> Fundamental Breakdown
                        </h4>
                        <button onClick={() => setShowDetails(false)}><X className="w-3 h-3 text-gray-500 hover:text-white" /></button>
                    </div>

                    <div className="space-y-2.5">
                        <MetricRow label="EPS Growth" value={`${data.metrics.epsGrowth?.toFixed(1)}%`} target="> 10%" pass={data.checks.epsGrowth} />
                        <MetricRow label="ROE (Manag. Eff.)" value={`${data.metrics.roe?.toFixed(1)}%`} target="> 15%" pass={data.checks.roe} />
                        <MetricRow label="PE Ratio (Value)" value={data.metrics.pe?.toFixed(2) || 'N/A'} target="< 25" pass={data.checks.pe} />
                        <MetricRow label="PEG Ratio (Value)" value={data.metrics.peg?.toFixed(2) || 'N/A'} target="< 1.2" pass={data.checks.peg} />
                        <MetricRow label="D/E Ratio (Risk)" value={data.metrics.de?.toFixed(2) || 'N/A'} target="< 1.0" pass={data.checks.de} />
                        <MetricRow label="Free Cash Flow" value={data.metrics.fcf ? '$' + (data.metrics.fcf / 1000).toFixed(1) + 'B' : 'N/A'} target="> 0" pass={data.checks.fcf} />
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-800">
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] text-gray-400 font-bold uppercase">Vitality Score</span>
                            <span className={`text-sm font-black ${getScoreColor(data.qualityScore)}`}>{data.qualityScore}/6</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function MetricRow({ label, value, target, pass }: { label: string, value: string, target: string, pass: boolean }) {
    return (
        <div className="flex items-center justify-between text-[11px]">
            <div className="flex flex-col">
                <span className="text-gray-100 font-bold">{label}</span>
                <span className="text-[9px] text-gray-500">Target: {target}</span>
            </div>
            <div className="text-right">
                <div className={`font-mono font-bold ${pass ? 'text-green-400' : 'text-red-400'}`}>{value}</div>
                <div className={`text-[8px] font-black uppercase tracking-tighter ${pass ? 'text-green-500/60' : 'text-red-500/60'}`}>
                    {pass ? 'Pass' : 'Failed'}
                </div>
            </div>
        </div>
    );
}
