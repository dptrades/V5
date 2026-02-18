import { PriceStats } from '../lib/stats';
import DataSourceIndicator from './ui/DataSourceIndicator';

export default function HighlightStats({ stats }: { stats: PriceStats | null }) {
    if (!stats) return <div className="h-20 bg-gray-800/50 rounded-lg animate-pulse my-4 w-full"></div>;

    const items = [
        { label: 'Prev Day', high: stats.previousDay.high, low: stats.previousDay.low },
        { label: 'This Week', high: stats.currentWeek.high, low: stats.currentWeek.low },
        { label: 'Last Week', high: stats.previousWeek.high, low: stats.previousWeek.low },
        { label: 'This Month', high: stats.currentMonth.high, low: stats.currentMonth.low },
        { label: 'This Year', high: stats.currentYear.high, low: stats.currentYear.low },
        { label: '52 Week', high: stats.fiftyTwoWeek.high, low: stats.fiftyTwoWeek.low },
    ];

    return (
        <div className="bg-gray-800 border-gray-700 border rounded-xl p-3">
            <div className="grid grid-cols-2 gap-2">
                {items.map((item, i) => (
                    <div key={i} className="flex flex-col bg-gray-900/50 p-2 rounded-lg border border-gray-700/50">
                        <span className="text-[10px] text-gray-100 uppercase tracking-wider font-bold mb-1">{item.label}</span>
                        <div className="flex justify-between items-end">
                            <div>
                                <span className="text-[9px] text-gray-200 block">High</span>
                                <span className="text-xs font-mono text-green-400 font-bold">${item.high.toFixed(2)}</span>
                            </div>
                            <div className="text-right ml-2">
                                <span className="text-[9px] text-gray-200 block">Low</span>
                                <span className="text-xs font-mono text-red-400 font-bold">${item.low.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <div className="mt-4 pt-2 border-t border-gray-700/30 flex justify-end">
                <DataSourceIndicator source="Yahoo Finance" />
            </div>
        </div>
    );
}
