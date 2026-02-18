"use client";

import { TrendingUp, TrendingDown, Minus, Calendar, BarChart3 } from "lucide-react";
import { PriceStatsData, PeriodStats } from "@/lib/price-stats";

interface PriceStatsWidgetProps {
    priceStats: PriceStatsData;
}

function StatCard({ current, previous, periodLabel }: { current: PeriodStats | null; previous: PeriodStats | null; periodLabel: string }) {
    return (
        <div className="bg-gray-800/40 rounded-lg border border-gray-700/40 overflow-hidden">
            <div className="px-3 py-1.5 bg-gray-800/60 border-b border-gray-700/30">
                <span className="text-xs font-semibold text-gray-200 uppercase tracking-wider">{periodLabel}</span>
            </div>
            <div className="grid grid-cols-2 divide-x divide-gray-700/30">
                <PeriodColumn stats={current} isCurrent={true} />
                <PeriodColumn stats={previous} isCurrent={false} />
            </div>
        </div>
    );
}

function PeriodColumn({ stats, isCurrent }: { stats: PeriodStats | null; isCurrent: boolean }) {
    if (!stats) {
        return (
            <div className="p-3 text-center">
                <div className="text-[10px] text-gray-200 uppercase mb-1">{isCurrent ? 'Current' : 'Previous'}</div>
                <div className="text-gray-100 text-xs">No data</div>
            </div>
        );
    }

    const isPositive = stats.changePct >= 0;
    const changeColor = isPositive ? 'text-green-400' : 'text-red-400';
    const changeBg = isPositive ? 'bg-green-500/10' : 'bg-red-500/10';
    const ChangeIcon = isPositive ? TrendingUp : TrendingDown;

    return (
        <div className="p-2.5">
            <div className="text-[10px] text-gray-200 uppercase mb-1.5 font-medium">{stats.label}</div>

            {/* Change % - hero metric */}
            <div className={`flex items-center gap-1 mb-1.5 ${changeBg} rounded px-1.5 py-0.5 w-fit`}>
                <ChangeIcon className={`w-3 h-3 ${changeColor}`} />
                <span className={`text-sm font-bold ${changeColor}`}>
                    {isPositive ? '+' : ''}{stats.changePct.toFixed(2)}%
                </span>
            </div>

            {/* OHLC mini grid */}
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
                <div className="text-gray-200">Open</div>
                <div className="text-gray-200 font-mono text-right">${stats.open.toFixed(2)}</div>
                <div className="text-gray-200">Close</div>
                <div className={`font-mono text-right ${changeColor}`}>${stats.close.toFixed(2)}</div>
                <div className="text-gray-200">High</div>
                <div className="text-gray-200 font-mono text-right">${stats.high.toFixed(2)}</div>
                <div className="text-gray-200">Low</div>
                <div className="text-gray-200 font-mono text-right">${stats.low.toFixed(2)}</div>
            </div>

            {/* Volume if available */}
            {stats.volume != null && stats.volume > 0 && (
                <div className="mt-1 text-[9px] text-gray-200 flex items-center gap-1">
                    <BarChart3 className="w-2.5 h-2.5" />
                    {formatVolume(stats.volume)}
                </div>
            )}
        </div>
    );
}

function formatVolume(vol: number): string {
    if (vol >= 1_000_000_000) return (vol / 1_000_000_000).toFixed(1) + 'B';
    if (vol >= 1_000_000) return (vol / 1_000_000).toFixed(1) + 'M';
    if (vol >= 1_000) return (vol / 1_000).toFixed(1) + 'K';
    return vol.toString();
}

export default function PriceStatsWidget({ priceStats }: PriceStatsWidgetProps) {
    return (
        <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-400" />
                Price Stats by Period
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <StatCard current={priceStats.currentDay} previous={priceStats.previousDay} periodLabel="Day" />
                <StatCard current={priceStats.currentWeek} previous={priceStats.previousWeek} periodLabel="Week" />
                <StatCard current={priceStats.currentMonth} previous={priceStats.previousMonth} periodLabel="Month" />
                <StatCard current={priceStats.currentYear} previous={priceStats.previousYear} periodLabel="Year" />
            </div>
            {/* All Time - full width */}
            {priceStats.allTime && (
                <div className="mt-3 bg-gray-800/40 rounded-lg border border-gray-700/40 overflow-hidden">
                    <div className="px-3 py-1.5 bg-gray-800/60 border-b border-gray-700/30">
                        <span className="text-xs font-semibold text-gray-200 uppercase tracking-wider">All Time (2Y History)</span>
                    </div>
                    <div className="p-2.5 flex items-center gap-4 flex-wrap">
                        <div className="text-[10px] text-gray-200">
                            High: <span className="text-gray-100 font-mono font-bold">${priceStats.allTime.high.toFixed(2)}</span>
                        </div>
                        <div className="text-[10px] text-gray-200">
                            Low: <span className="text-gray-100 font-mono font-bold">${priceStats.allTime.low.toFixed(2)}</span>
                        </div>
                        <div className="text-[10px] text-gray-200">
                            Range: <span className="text-gray-100 font-mono font-bold">${(priceStats.allTime.high - priceStats.allTime.low).toFixed(2)}</span>
                        </div>
                        <div className={`flex items-center gap-1 ${priceStats.allTime.changePct >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'} rounded px-1.5 py-0.5`}>
                            {priceStats.allTime.changePct >= 0 ? (
                                <TrendingUp className="w-3 h-3 text-green-400" />
                            ) : (
                                <TrendingDown className="w-3 h-3 text-red-400" />
                            )}
                            <span className={`text-xs font-bold ${priceStats.allTime.changePct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {priceStats.allTime.changePct >= 0 ? '+' : ''}{priceStats.allTime.changePct.toFixed(2)}%
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
