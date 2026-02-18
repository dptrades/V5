import React from 'react';
import { IndicatorData } from '../types/financial';
import { MousePointerClick, ArrowUpCircle, ArrowDownCircle, MinusCircle } from 'lucide-react';

interface HeaderPatternProps {
    latestData: IndicatorData | null;
}

export default function HeaderPattern({ latestData }: HeaderPatternProps) {
    if (!latestData || !latestData.pattern || latestData.pattern.name === 'None') {
        return (
            <div className="flex items-center gap-4 bg-gray-800/50 px-4 py-2 rounded-lg border border-gray-700 opacity-50">
                <div className="flex items-center gap-2">
                    <MousePointerClick className="w-4 h-4 text-gray-200" />
                    <div className="flex flex-col leading-none">
                        <span className="text-[10px] text-gray-100 font-bold uppercase tracking-wider">Pattern</span>
                        <span className="text-sm font-bold text-gray-200">None detected</span>
                    </div>
                </div>
            </div>
        );
    }

    const { name, signal } = latestData.pattern;

    let icon = <MinusCircle className="w-4 h-4 text-gray-100" />;
    let color = "text-gray-100";
    let bgColor = "bg-gray-800/50";
    let borderColor = "border-gray-700";

    if (signal === 'bullish') {
        icon = <ArrowUpCircle className="w-4 h-4 text-green-400" />;
        color = "text-green-400";
        borderColor = "border-green-900/30";
        bgColor = "bg-green-900/10";
    } else if (signal === 'bearish') {
        icon = <ArrowDownCircle className="w-4 h-4 text-red-400" />;
        color = "text-red-400";
        borderColor = "border-red-900/30";
        bgColor = "bg-red-900/10";
    }

    return (
        <div className={`flex items-center gap-4 ${bgColor} px-4 py-2 rounded-lg border ${borderColor}`}>
            <div className="flex items-center gap-2">
                {icon}
                <div className="flex flex-col leading-none">
                    <span className="text-[10px] text-gray-100 font-bold uppercase tracking-wider">Pattern</span>
                    <span className={`text-sm font-bold ${color}`}>{name}</span>
                </div>
            </div>
        </div>
    );
}
