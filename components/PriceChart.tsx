import {
    ResponsiveContainer,
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    Cell,
    Area,
    Scatter
} from 'recharts';
import { useState, useEffect } from 'react';
import { IndicatorData } from '../types/financial';

interface PriceChartProps {
    data: IndicatorData[];
}

export default function PriceChart({ data }: PriceChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-gray-200">
                No data to display
            </div>
        );
    }

    // State for Dynamic Legend (defaults to latest data point)
    const [activeData, setActiveData] = useState<IndicatorData | null>(null);

    useEffect(() => {
        if (data && data.length > 0) {
            setActiveData(data[data.length - 1]);
        }
    }, [data]);

    const handleMouseMove = (e: any) => {
        if (e.activePayload && e.activePayload.length > 0) {
            setActiveData(e.activePayload[0].payload);
        }
    };

    const handleMouseLeave = () => {
        if (data && data.length > 0) {
            setActiveData(data[data.length - 1]);
        }
    };

    // Calculate min/max for Y-axis domain
    const prices = data.map((d) => d.close);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const buffer = (maxPrice - minPrice) * 0.1;

    // Custom Tooltip (Detailed)
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            const date = new Date(data.time).toLocaleString();
            return (
                <div className="bg-gray-900/95 border border-gray-600 p-3 rounded-lg shadow-xl text-xs z-50 min-w-[180px] backdrop-blur-md">
                    <p className="font-bold text-gray-100 border-b border-gray-700 pb-1 mb-2">{date}</p>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <span className="text-gray-100">Open:</span> <span className="text-right text-white font-mono">{data.open.toFixed(2)}</span>
                        <span className="text-gray-100">High:</span> <span className="text-right text-white font-mono">{data.high.toFixed(2)}</span>
                        <span className="text-gray-100">Low:</span> <span className="text-right text-white font-mono">{data.low.toFixed(2)}</span>
                        <span className="text-gray-100">Close:</span> <span className="text-right text-white font-mono">{data.close.toFixed(2)}</span>

                        <div className="col-span-2 h-1 border-b border-gray-800 my-1"></div>

                        {data.ema9 && <><span className="text-[#FBBF24]">EMA 9:</span> <span className="text-right text-[#FBBF24] font-mono">{data.ema9.toFixed(2)}</span></>}
                        {data.ema21 && <><span className="text-[#F87171]">EMA 21:</span> <span className="text-right text-[#F87171] font-mono">{data.ema21.toFixed(2)}</span></>}
                        {data.ema50 && <><span className="text-[#818CF8]">EMA 50:</span> <span className="text-right text-[#818CF8] font-mono">{data.ema50.toFixed(2)}</span></>}
                        {data.ema200 && <><span className="text-[#34D399]">EMA 200:</span> <span className="text-right text-[#34D399] font-mono">{data.ema200.toFixed(2)}</span></>}

                        {data.vwap && <><span className="text-[#EC4899]">VWAP:</span> <span className="text-right text-[#EC4899] font-mono">{data.vwap.toFixed(2)}</span></>}

                        <div className="col-span-2 h-1 border-b border-gray-800 my-1"></div>

                        <span className="text-[#60A5FA]">RSI:</span> <span className="text-right text-[#60A5FA] font-mono">{data.rsi14?.toFixed(1)}</span>

                        {data.macd && (
                            <>
                                <span className="text-[#3B82F6]">MACD:</span> <span className="text-right text-[#3B82F6] font-mono">{data.macd.MACD?.toFixed(2)}</span>
                                <span className="text-[#F97316]">Signal:</span> <span className="text-right text-[#F97316] font-mono">{data.macd.signal?.toFixed(2)}</span>
                            </>
                        )}
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="flex flex-col h-full space-y-2 relative">
            {/* Dynamic Legend Overlay */}
            <div className="absolute top-2 left-16 z-10 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-mono pointer-events-none bg-gray-900/80 p-1 rounded backdrop-blur-sm border border-gray-800/50">
                {activeData && (
                    <>
                        {/* OHLC */}
                        <div className="text-gray-100 font-bold">
                            O: <span className="text-white">{activeData.open.toFixed(2)}</span>{' '}
                            H: <span className="text-white">{activeData.high.toFixed(2)}</span>{' '}
                            L: <span className="text-white">{activeData.low.toFixed(2)}</span>{' '}
                            C: <span className="text-white">{activeData.close.toFixed(2)}</span>
                        </div>

                        {/* Indicators */}
                        {activeData.ema9 && <div className="text-[#FBBF24]">EMA9: {activeData.ema9.toFixed(2)}</div>}
                        {activeData.ema21 && <div className="text-[#F87171]">EMA21: {activeData.ema21.toFixed(2)}</div>}
                        {activeData.ema50 && <div className="text-[#818CF8]">EMA50: {activeData.ema50.toFixed(2)}</div>}
                        {activeData.ema200 && <div className="text-[#34D399]">EMA200: {activeData.ema200.toFixed(2)}</div>}

                        {activeData.vwap && <div className="text-[#EC4899]">VWAP: {activeData.vwap.toFixed(2)}</div>}

                        {activeData.bollinger && (
                            <div className="text-blue-300 opacity-80">
                                BB: {activeData.bollinger.upper?.toFixed(2)} / {activeData.bollinger.lower?.toFixed(2)}
                            </div>
                        )}

                        {/* RSI & MACD Values in Legend as well */}
                        <div className="text-gray-200">|</div>
                        <div className="text-[#60A5FA]">RSI: {activeData.rsi14?.toFixed(1)}</div>
                        {activeData.macd && (
                            <div className="text-gray-100">
                                MACD: <span className="text-[#3B82F6]">{activeData.macd.MACD?.toFixed(2)}</span>
                                <span className="text-gray-100">/</span>
                                <span className="text-[#F97316]">{activeData.macd.signal?.toFixed(2)}</span>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Price + EMA Chart */}
            <div className="flex-1 min-h-0 pt-8">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={data}
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                        syncId="financial-dashboard"
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
                        <XAxis
                            dataKey="time"
                            tickFormatter={(tick) => new Date(tick).toLocaleDateString()}
                            stroke="#9CA3AF"
                            fontSize={10}
                            minTickGap={30}
                        />
                        <YAxis
                            domain={[minPrice - buffer, maxPrice + buffer]}
                            stroke="#9CA3AF"
                            fontSize={10}
                            tickFormatter={(number) => `$${number.toFixed(0)}`}
                            allowDecimals={false}
                            orientation="right"
                        />
                        <Tooltip
                            content={<CustomTooltip />}
                            position={{ y: 0 }}
                            cursor={{ stroke: '#9CA3AF', strokeWidth: 1, strokeDasharray: '4 4' }}
                            isAnimationActive={false}
                        />
                        {/* Legend Removed */}

                        <defs>
                            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <Area
                            type="monotone"
                            dataKey="close"
                            stroke="#3B82F6"
                            strokeWidth={2}
                            fill="url(#colorPrice)"
                        />

                        {/* Indicators */}
                        <Line
                            type="monotone"
                            dataKey="ema9"
                            stroke="#FBBF24" // Amber
                            dot={false}
                            strokeWidth={1}
                            name="EMA 9"
                            connectNulls
                        />
                        <Line
                            type="monotone"
                            dataKey="ema21"
                            stroke="#F87171" // Red
                            dot={false}
                            strokeWidth={1}
                            name="EMA 21"
                            connectNulls
                        />
                        <Line
                            type="monotone"
                            dataKey="ema50"
                            stroke="#818CF8" // Indigo
                            dot={false}
                            strokeWidth={2}
                            name="EMA 50"
                            connectNulls
                        />
                        <Line
                            type="monotone"
                            dataKey="ema200"
                            stroke="#34D399" // Emerald
                            dot={false}
                            strokeWidth={2}
                            name="EMA 200"
                            connectNulls
                        />

                        {/* Keep VWAP as reference */}
                        <Line
                            type="monotone"
                            dataKey="vwap"
                            stroke="#EC4899" // Pink
                            dot={false}
                            strokeWidth={1}
                            strokeDasharray="5 5"
                            name="VWAP"
                            connectNulls
                        />

                        {/* Bollinger Bands */}
                        <Area
                            type="monotone"
                            dataKey="bollinger.upper"
                            stroke="rgba(147, 197, 253, 0.3)"
                            fill="rgba(147, 197, 253, 0.1)"
                            strokeWidth={1}
                            dot={false}
                            name="BB Upper"
                            connectNulls
                        />
                        <Area
                            type="monotone"
                            dataKey="bollinger.lower"
                            stroke="rgba(147, 197, 253, 0.3)"
                            fill="rgba(147, 197, 253, 0.1)"
                            strokeWidth={1}
                            dot={false}
                            name="BB Lower"
                            connectNulls
                        />
                        {/* Middle Band (SMA 20) */}
                        <Line
                            type="monotone"
                            dataKey="bollinger.middle"
                            stroke="rgba(147, 197, 253, 0.5)"
                            strokeWidth={1}
                            strokeDasharray="3 3"
                            dot={false}
                            name="BB Middle"
                            connectNulls
                        />


                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* RSI Chart (Separate Pane) */}
            <div className="h-[15%] min-h-[80px] border-t border-gray-700 pt-1">
                <h4 className="text-[10px] uppercase text-gray-200 ml-2">RSI (14)</h4>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={data}
                        syncId="financial-dashboard"
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                    >
                        <XAxis dataKey="time" hide />
                        <YAxis domain={[0, 100]} orientation="right" tick={{ fontSize: 10 }} stroke="#6B7280" />
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#9CA3AF', strokeWidth: 1 }} />
                        <line x1="0" y1="70" x2="100%" y2="70" stroke="rgba(239, 68, 68, 0.5)" strokeDasharray="3 3" />
                        <line x1="0" y1="30" x2="100%" y2="30" stroke="rgba(34, 197, 94, 0.5)" strokeDasharray="3 3" />
                        <Line type="monotone" dataKey="rsi14" stroke="#60A5FA" dot={false} strokeWidth={1.5} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* MACD Chart (Separate Pane) */}
            <div className="h-[15%] min-h-[80px] border-t border-gray-700 pt-1">
                <h4 className="text-[10px] uppercase text-gray-200 ml-2">MACD (12, 26, 9)</h4>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={data}
                        syncId="financial-dashboard"
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                    >
                        <XAxis dataKey="time" hide />
                        <YAxis orientation="right" tick={{ fontSize: 10 }} stroke="#6B7280" />
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#9CA3AF', strokeWidth: 1 }} />
                        <Bar dataKey="macd.histogram" fill="#4B5563" barSize={4} />
                        <Line type="monotone" dataKey="macd.MACD" stroke="#3B82F6" dot={false} strokeWidth={1.5} />
                        <Line type="monotone" dataKey="macd.signal" stroke="#F97316" dot={false} strokeWidth={1.5} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
