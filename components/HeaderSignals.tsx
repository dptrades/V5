import React from 'react';
import { IndicatorData } from '../types/financial';
import { TrendingUp, Activity } from 'lucide-react';
import DataSourceIndicator from './ui/DataSourceIndicator';

interface HeaderSignalsProps {
    latestData: IndicatorData | null;
    showRSI?: boolean;
}

export default function HeaderSignals({ latestData, showRSI = true }: HeaderSignalsProps) {
    if (!latestData) return null;

    // Determine Trends
    const { close, ema50, ema200 } = latestData;

    // Short Term: Price vs 20 EMA / 50 EMA
    let stTrend = "NEUTRAL";
    let stColor = "text-gray-100";
    if (ema50) {
        if (close > ema50) {
            stTrend = "BULLISH";
            stColor = "text-green-400";
        } else {
            stTrend = "BEARISH";
            stColor = "text-red-400";
        }
    }

    // Long Term: Price vs 200 EMA
    let ltTrend = "NEUTRAL";
    let ltColor = "text-gray-100";
    if (ema200) {
        if (close > ema200) {
            ltTrend = "BULLISH";
            ltColor = "text-green-400";
        } else {
            ltTrend = "BEARISH";
            ltColor = "text-red-400";
        }
    }

    // Golden/Death Cross status for extra signal
    const isGoldenCross = ema50 && ema200 && ema50 > ema200;

    // MACD Signal
    let macdStatus = "ALT";
    let macdColor = "text-gray-200";
    if (latestData.macd?.MACD !== undefined && latestData.macd?.signal !== undefined) {
        if (latestData.macd.MACD > latestData.macd.signal) {
            macdStatus = "BULL";
            macdColor = "text-green-400";
        } else {
            macdStatus = "BEAR";
            macdColor = "text-red-400";
        }
    }

    // BB Status
    let bbStatus = "MID";
    let bbColor = "text-gray-200";
    if (latestData.bollinger?.upper && latestData.bollinger?.lower) {
        if (close > latestData.bollinger.upper) {
            bbStatus = "OB";
            bbColor = "text-red-400";
        } else if (close < latestData.bollinger.lower) {
            bbStatus = "OS";
            bbColor = "text-green-400";
        }
    }

    // VWAP Status
    let vwapStatus = "NEU";
    let vwapColor = "text-gray-200";
    if (latestData.vwap) {
        if (close > latestData.vwap) {
            vwapStatus = "ABV";
            vwapColor = "text-green-400";
        } else {
            vwapStatus = "BEL";
            vwapColor = "text-red-400";
        }
    }

    // ADX Trend Strength
    let adxStatus = "WEAK";
    let adxColor = "text-gray-200";
    if (latestData.adx14) {
        if (latestData.adx14 > 25) {
            adxStatus = "STR";
            adxColor = "text-blue-400";
        }
        if (latestData.adx14 > 40) {
            adxStatus = "EXT";
            adxColor = "text-purple-400";
        }
    }

    // Determine RSI
    let rsiStatus = "NEU";
    let rsiColor = "text-gray-100";
    if (latestData?.rsi14) {
        if (latestData.rsi14 > 70) {
            rsiStatus = "OB";
            rsiColor = "text-red-400";
        } else if (latestData.rsi14 < 30) {
            rsiStatus = "OS";
            rsiColor = "text-green-400";
        }
    }

    // Determine Widget Styling based on ST Trend
    let widgetBg = "bg-gray-900/80 border-gray-800";
    if (stTrend === "BULLISH") {
        widgetBg = "bg-green-950/40 border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.1)]";
    } else if (stTrend === "BEARISH") {
        widgetBg = "bg-red-950/40 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.1)]";
    }

    return (
        <div className={`flex items-center gap-6 px-4 py-2 rounded-xl border shadow-xl transition-all duration-500 ${widgetBg}`}>
            {/* 1. Trends Section */}
            <div className={`flex items-center gap-3 border-r pr-6 ${stTrend === 'BULLISH' ? 'border-green-500/20' : stTrend === 'BEARISH' ? 'border-red-500/20' : 'border-gray-800'}`}>
                <TrendingUp className={`w-4 h-4 ${isGoldenCross ? 'text-yellow-400' : 'text-blue-400'}`} />
                <div className="flex gap-4">
                    <div className="flex flex-col gap-1">
                        <span className="text-[8px] text-gray-200 font-bold uppercase tracking-widest leading-none">ST Trend</span>
                        <span className={`text-[10px] font-bold ${stColor} leading-none`}>{stTrend}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[8px] text-gray-200 font-bold uppercase tracking-widest leading-none">LT Trend</span>
                        <span className={`text-[10px] font-bold ${ltColor} leading-none`}>{ltTrend}</span>
                    </div>
                </div>
            </div>

            {/* 2. Technical Matrix */}
            <div className="flex items-center gap-5 uppercase font-bold text-[10px]">
                <div className="flex flex-col gap-1">
                    <span className="text-[8px] text-gray-200 tracking-widest leading-none">RSI</span>
                    <span className={`${rsiColor} leading-none`}>{rsiStatus} <span className="text-[8px] opacity-40">({latestData.rsi14?.toFixed(0)})</span></span>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-[8px] text-gray-200 tracking-widest leading-none">MACD</span>
                    <span className={`${macdColor} leading-none`}>{macdStatus}</span>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-[8px] text-gray-200 tracking-widest leading-none">BB</span>
                    <span className={`${bbColor} leading-none`}>{bbStatus}</span>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-[8px] text-gray-200 tracking-widest leading-none">VWAP</span>
                    <span className={`${vwapColor} leading-none`}>{vwapStatus}</span>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-[8px] text-gray-200 tracking-widest leading-none">ADX</span>
                    <span className={`${adxColor} leading-none`}>{adxStatus}</span>
                </div>
                <div className="border-l border-gray-700/50 pl-3 ml-1 self-stretch flex items-center">
                    <DataSourceIndicator source="Schwab Prof." />
                </div>
            </div>
        </div>
    );
}
