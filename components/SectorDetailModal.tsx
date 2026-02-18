"use client";

import React from 'react';
import { X, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import type { ConvictionStock } from '@/types/stock';
import ConvictionCard from './ConvictionCard';

interface SectorGroup {
    name: string;
    avgChange: number;
    stocks: ConvictionStock[];
}

interface Props {
    sector: SectorGroup | null;
    onClose: () => void;
    onSelectStock: (symbol: string) => void;
}

export default function SectorDetailModal({ sector, onClose, onSelectStock }: Props) {
    if (!sector) return null;

    // Filter gainers and losers
    const gainers = [...sector.stocks]
        .filter(s => s.change24h > 0)
        .sort((a, b) => b.change24h - a.change24h)
        .slice(0, 5);

    const losers = [...sector.stocks]
        .filter(s => s.change24h < 0)
        .sort((a, b) => a.change24h - b.change24h)
        .slice(0, 5);

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative bg-gray-900 border border-gray-700 w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl custom-scrollbar flex flex-col">
                {/* Header */}
                <div className="sticky top-0 z-10 p-6 border-b border-gray-800 bg-gray-900/95 backdrop-blur-md flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-3xl font-bold text-white tracking-tight">{sector.name}</h2>
                            <div className={`px-3 py-1 rounded-full text-sm font-bold ${sector.avgChange >= 0 ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                                {sector.avgChange > 0 ? '+' : ''}{sector.avgChange.toFixed(2)}%
                            </div>
                        </div>
                        <p className="text-gray-200 text-sm mt-1">Sector Overview • {sector.stocks.length} Assets Tracked</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-100 hover:text-white"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 space-y-12 pb-12">
                    {/* Gainers Section */}
                    <div>
                        <div className="flex items-center gap-2 mb-6">
                            <div className="bg-green-500/10 p-2 rounded-lg">
                                <TrendingUp className="w-5 h-5 text-green-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white">Top Gainers</h3>
                            <span className="text-xs text-gray-200 bg-gray-800 px-2 py-0.5 rounded ml-2">Relative Strength</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {gainers.map(stock => (
                                <ConvictionCard
                                    key={stock.symbol}
                                    stock={stock}
                                    onSelect={(s) => {
                                        onSelectStock(s);
                                        onClose();
                                    }}
                                />
                            ))}
                            {gainers.length === 0 && (
                                <div className="col-span-full py-12 text-center text-gray-100 border border-dashed border-gray-800 rounded-xl">
                                    No significant gainers found in this sector today.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Losers Section */}
                    <div>
                        <div className="flex items-center gap-2 mb-6">
                            <div className="bg-red-500/10 p-2 rounded-lg">
                                <TrendingDown className="w-5 h-5 text-red-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white">Top Losers</h3>
                            <span className="text-xs text-gray-200 bg-gray-800 px-2 py-0.5 rounded ml-2">Potential Value / Oversold</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {losers.map(stock => (
                                <ConvictionCard
                                    key={stock.symbol}
                                    stock={stock}
                                    onSelect={(s) => {
                                        onSelectStock(s);
                                        onClose();
                                    }}
                                />
                            ))}
                            {losers.length === 0 && (
                                <div className="col-span-full py-12 text-center text-gray-100 border border-dashed border-gray-800 rounded-xl">
                                    No significant losers found in this sector today.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer / CTA */}
                <div className="p-6 border-t border-gray-800 bg-gray-900/50 flex justify-center">
                    <button
                        onClick={onClose}
                        className="text-gray-100 hover:text-white transition-colors flex items-center gap-2 font-medium"
                    >
                        Close Exploration <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
