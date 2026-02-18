import { PriceStats } from '../lib/stats';

const HighLowCard = ({ label, stats }: { label: string, stats: { high: number, low: number } }) => {
    return (
        <div className="p-4 rounded-lg bg-gray-800 border border-gray-700 hover:border-blue-500 transition-colors">
            <h4 className="text-xs font-semibold text-gray-100 uppercase tracking-wider mb-3">{label}</h4>
            <div className="flex justify-between items-center text-sm">
                <div className="flex flex-col">
                    <span className="text-xs text-green-400 mb-1">High</span>
                    <span className="font-bold text-white font-mono text-lg">${stats.high.toFixed(2)}</span>
                </div>
                <div className="h-8 w-px bg-gray-700 mx-2"></div>
                <div className="flex flex-col text-right">
                    <span className="text-xs text-red-400 mb-1">Low</span>
                    <span className="font-bold text-white font-mono text-lg">${stats.low.toFixed(2)}</span>
                </div>
            </div>
        </div>
    );
};

export default function StatsGrid({ stats }: { stats: PriceStats }) {
    if (!stats) return null;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            {/* Previous Day */}
            <HighLowCard label="Previous Day" stats={stats.previousDay} />

            {/* Current Week */}
            <HighLowCard label="Current Week" stats={stats.currentWeek} />

            {/* Previous Week */}
            <HighLowCard label="Previous Week" stats={stats.previousWeek} />

            {/* Current Month */}
            <HighLowCard label="Current Month" stats={stats.currentMonth} />

            {/* Current Year */}
            <HighLowCard label="Current Year" stats={stats.currentYear} />

            {/* All Time */}
            <HighLowCard label="All Time" stats={stats.allTime} />
        </div>
    );
}
