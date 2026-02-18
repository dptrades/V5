import React from 'react';
import { Newspaper } from 'lucide-react';

interface HeaderSentimentProps {
    score: number;
}

export default function HeaderSentiment({ score }: HeaderSentimentProps) {
    const color = score >= 60 ? 'text-green-400' : score <= 40 ? 'text-red-400' : 'text-gray-100';
    const barColor = score >= 50 ? 'bg-green-500' : 'bg-red-500';
    const label = score >= 60 ? 'Bullish' : score <= 40 ? 'Bearish' : 'Neutral';

    return (
        <div className="flex items-center gap-3 bg-gray-800/50 px-4 py-2 rounded-lg border border-gray-700">
            <div className="flex items-center gap-2">
                <Newspaper className="w-4 h-4 text-purple-400" />
                <div className="flex flex-col leading-none">
                    <span className="text-[10px] text-gray-100 font-bold uppercase tracking-wider">Crowd Sentiment</span>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`text-sm font-bold ${color}`}>{label}</span>
                        <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-1000 ${barColor}`}
                                style={{ width: `${score}%` }}
                            ></div>
                        </div>
                        <span className="text-[10px] text-gray-200">({score}%)</span>
                    </div>
                </div>
            </div>
        </div>
    );
}


