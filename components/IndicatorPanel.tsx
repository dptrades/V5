import { IndicatorData } from "@/types/financial";

interface IndicatorPanelProps {
    onToggleIndicator?: (indicator: string) => void;
    activeIndicators?: string[];
    latestData?: IndicatorData | null;
}

export default function IndicatorPanel({
    onToggleIndicator,
    activeIndicators = [],
    latestData
}: IndicatorPanelProps) {

    // Determine Trend
    let trend = "NEUTRAL";
    let trendColor = "text-gray-100";
    let trendReason = "Price consolidating";

    if (latestData) {
        const { close, ema50, ema200 } = latestData;

        if (ema50 && ema200) {
            if (close > ema50 && ema50 > ema200) {
                trend = "BULLISH";
                trendColor = "text-green-400";
                trendReason = "Price > EMA 50 > EMA 200";
            } else if (close < ema50 && ema50 < ema200) {
                trend = "BEARISH";
                trendColor = "text-red-400";
                trendReason = "Price < EMA 50 < EMA 200";
            } else if (close > ema200) {
                trend = "BULLISH (WEAK)";
                trendColor = "text-green-300";
                trendReason = "Price > EMA 200";
            } else if (close < ema200) {
                trend = "BEARISH (WEAK)";
                trendColor = "text-red-300";
                trendReason = "Price < EMA 200";
            }
        }
    }

    // Determine RSI
    let rsiStatus = "NEUTRAL";
    let rsiColor = "text-gray-100";
    if (latestData?.rsi14) {
        if (latestData.rsi14 > 70) {
            rsiStatus = "OVERBOUGHT";
            rsiColor = "text-red-400";
        } else if (latestData.rsi14 < 30) {
            rsiStatus = "OVERSOLD";
            rsiColor = "text-green-400";
        }
    }

    return (
        <div className="mt-8 text-sm">
            <h3 className="font-semibold text-gray-100 mb-3 uppercase tracking-wider">Signals</h3>

            <div className="space-y-4">
                {/* Trend Card */}
                <div className="p-4 bg-gray-900 rounded border border-gray-700">
                    <h4 className="font-medium text-xs text-gray-200 mb-2 uppercase">Trend Analysis</h4>
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-gray-200">Structure</span>
                        <span className={`${trendColor} font-bold`}>{trend}</span>
                    </div>
                    <div className="text-xs text-gray-200">
                        {latestData ? trendReason : "Loading..."}
                    </div>
                </div>

                {/* RSI Card */}
                <div className="p-4 bg-gray-900 rounded border border-gray-700">
                    <h4 className="font-medium text-xs text-gray-200 mb-2 uppercase">RSI Momentum</h4>
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-gray-200">Signal</span>
                        <span className={`${rsiColor} font-bold`}>{rsiStatus}</span>
                    </div>
                    <div className="text-xs text-gray-200">
                        Value: {latestData?.rsi14?.toFixed(2) ?? 'N/A'}
                    </div>
                </div>
            </div>
        </div>
    );
}
