import React from 'react';
import { Bot, Sparkles, BrainCircuit } from 'lucide-react';

interface AISummaryCardProps {
    symbol: string;
    summary: string;
    loading?: boolean;
}

export default function AISummaryCard({ symbol, summary, loading = false }: AISummaryCardProps) {
    return (
        <div className="relative group rounded-xl bg-gray-900 border border-gray-800 p-0.5 shadow-2xl mt-4 z-10 block min-h-[100px] overflow-hidden">
            {/* Animated Gradient Border */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 opacity-20 group-hover:opacity-40 transition-opacity duration-1000 animate-gradient-xy"></div>

            <div className="relative bg-gray-900 rounded-[10px] p-5">
                <div className="flex items-center mb-3">
                    <div className="p-2 bg-blue-900/30 rounded-lg mr-3 border border-blue-500/20">
                        <BrainCircuit className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white flex items-center">
                            AI Technical Insight
                            <span className="ml-2 text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20">BETA</span>
                        </h3>
                        <p className="text-[10px] text-gray-200">Automated analysis based on EMA, RSI, & MACD</p>
                    </div>
                </div>

                {loading ? (
                    <div className="space-y-2 animate-pulse">
                        <div className="h-4 bg-gray-800 rounded w-3/4"></div>
                        <div className="h-4 bg-gray-800 rounded w-full"></div>
                        <div className="h-4 bg-gray-800 rounded w-5/6"></div>
                    </div>
                ) : (
                    <div className="prose prose-invert max-w-none">
                        <p className="text-sm text-gray-200 leading-relaxed font-light">
                            <span className="font-bold text-blue-400">{symbol} Analysis: </span>
                            {summary}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
