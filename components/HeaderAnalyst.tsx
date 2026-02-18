import React, { useMemo } from 'react';
import { Target, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { NewsItem } from '../lib/news';

interface HeaderAnalystProps {
    symbol: string;
    analystNews: NewsItem[];
}

export default function HeaderAnalyst({ symbol, analystNews }: HeaderAnalystProps) {

    // Parse Analyst News for Sentiments
    const stats = useMemo(() => {
        let upgrades = 0;
        let downgrades = 0;
        let maintains = 0;

        analystNews.forEach(item => {
            const title = item.title.toLowerCase();
            if (title.includes('upgrade') || title.includes('raise') || title.includes('buy') || title.includes('outperform')) {
                upgrades++;
            } else if (title.includes('downgrade') || title.includes('cut') || title.includes('sell') || title.includes('underperform') || title.includes('lower')) {
                downgrades++;
            } else {
                maintains++;
            }
        });

        return { upgrades, downgrades, maintains, total: upgrades + downgrades + maintains };
    }, [analystNews]);

    // Determine Label
    let label = "NEUTRAL";
    let subtext = "No recent data";
    let color = "text-gray-100";
    let bgColor = "bg-gray-800";
    let borderColor = "border-gray-700";

    if (stats.total === 0) {
        // Default state
    } else if (stats.upgrades > stats.downgrades) {
        label = "NET BULLISH";
        subtext = `${stats.upgrades} Upgrades vs ${stats.downgrades} Cuts`;
        color = "text-green-400";
        bgColor = "bg-green-900/20";
        borderColor = "border-green-500/50";
    } else if (stats.downgrades > stats.upgrades) {
        label = "NET BEARISH";
        subtext = `${stats.downgrades} Cuts vs ${stats.upgrades} Upgrades`;
        color = "text-red-400";
        bgColor = "bg-red-900/20";
        borderColor = "border-red-500/50";
    } else {
        label = "MIXED";
        subtext = `${stats.upgrades} Upgrades / ${stats.downgrades} Cuts`;
        color = "text-yellow-400";
        bgColor = "bg-yellow-900/20";
        borderColor = "border-yellow-500/50";
    }

    return (
        <div className={`flex items-center gap-4 ${bgColor} px-4 py-2 rounded-xl border shadow-xl transition-all ${borderColor}`}>
            <div className="flex items-center gap-2">
                <Target className={`w-4 h-4 ${color}`} />
                <div className="flex flex-col gap-1">
                    <span className="text-[8px] text-gray-100 font-bold uppercase tracking-widest leading-none">Analyst Flow</span>
                    <div className="flex items-center gap-2 leading-none">
                        <span className={`text-[10px] font-bold ${color} leading-none`}>{label}</span>
                        {/* Mini Visual Bar */}
                        <div className="flex gap-[2px]">
                            {Array.from({ length: stats.upgrades }).map((_, i) => (
                                <div key={`up-${i}`} className="w-1 h-[10px] bg-green-500 rounded-sm" title="Upgrade" />
                            ))}
                            {Array.from({ length: stats.downgrades }).map((_, i) => (
                                <div key={`down-${i}`} className="w-1 h-[10px] bg-red-500 rounded-sm" title="Downgrade" />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
