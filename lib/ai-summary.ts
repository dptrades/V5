import { IndicatorData } from '../types/financial';

export const generateTechnicalSummary = (data: IndicatorData[], symbol: string): string => {
    if (!data || data.length < 50) return "Insufficient data to generate analysis.";

    const latest = data[data.length - 1];
    const prev = data[data.length - 2];

    // 1. Trend Analysis (EMA)
    let trend = "neutral";
    let trendStrength = "weak";

    // Check if EMA200 exists and is valid
    if (latest.ema200 && latest.close > latest.ema200) {
        trend = "bullish";
        if (latest.ema50 && latest.close > latest.ema50 && latest.ema21 && latest.close > latest.ema21) {
            trendStrength = "strong";
        }
    } else if (latest.ema200 && latest.close < latest.ema200) {
        trend = "bearish";
        if (latest.ema50 && latest.close < latest.ema50) {
            trendStrength = "strong";
        }
    }

    // 2. Momentum (RSI)
    let rsiSignal = "neutral";
    const rsi = latest.rsi14 || 50;
    if (rsi > 70) rsiSignal = "overbought";
    else if (rsi < 30) rsiSignal = "oversold";
    else if (rsi > 60) rsiSignal = "bullish momentum";
    else if (rsi < 40) rsiSignal = "bearish momentum";

    // 3. MACD
    let macdSignal = "neutral";
    if (latest.macd && prev.macd && latest.macd.MACD && latest.macd.signal && prev.macd.MACD && prev.macd.signal) {
        const macdLine = latest.macd.MACD;
        const signalLine = latest.macd.signal;
        const prevMacd = prev.macd.MACD;
        const prevSignal = prev.macd.signal;

        if (macdLine > signalLine && prevMacd <= prevSignal) macdSignal = "just crossed bullish";
        else if (macdLine < signalLine && prevMacd >= prevSignal) macdSignal = "just crossed bearish";
        else if (macdLine > signalLine) macdSignal = "bullish";
        else if (macdLine < signalLine) macdSignal = "bearish";
    }

    // 4. Construct Natural Language Paragraph
    const priceStr = `$${latest.close.toFixed(2)}`;

    let summary = `${symbol} is currently trading at ${priceStr} in a ${trendStrength} ${trend} trend. `;

    // RSI Context
    if (rsiSignal === "overbought") {
        summary += `However, momentum is extremely stretched (RSI ${rsi.toFixed(0)}), suggesting a potential pullback. `;
    } else if (rsiSignal === "oversold") {
        summary += `The asset is currently oversold (RSI ${rsi.toFixed(0)}), which often precedes a relief rally. `;
    } else {
        summary += `Momentum indicators are showing ${rsiSignal} (RSI ${rsi.toFixed(0)}). `;
    }

    // MACD Context
    if (macdSignal.includes("just crossed")) {
        summary += `Crucially, the MACD has ${macdSignal}, a significant signal for trend reversal. `;
    }

    // Support/Resistance (EMA Dynamic)
    if (trend === "bullish" && latest.ema50) {
        summary += `Key support lies near the EMA50 at $${latest.ema50.toFixed(2)}. `;
    } else if (trend === "bearish" && latest.ema50) {
        summary += `Key resistance reflects the EMA50 at $${latest.ema50.toFixed(2)}. `;
    }

    return summary;
};
