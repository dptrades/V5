import { IndicatorData } from "@/types/financial";

export type PatternName = 'Doji' | 'Hammer' | 'Shooting Star' | 'Bullish Engulfing' | 'Bearish Engulfing' | 'None';

interface PatternResult {
    name: PatternName;
    signal: 'bullish' | 'bearish' | 'neutral';
}

export const detectPatterns = (data: IndicatorData[]): IndicatorData[] => {
    if (!data || data.length < 2) return data;

    return data.map((candle, index, array) => {
        // We need at least 1 previous candle for some patterns
        if (index === 0) return { ...candle, pattern: { name: 'None', signal: 'neutral' } };

        const prev = array[index - 1];

        const open = candle.open;
        const close = candle.close;
        const high = candle.high;
        const low = candle.low;

        const bodySize = Math.abs(close - open);
        const upperWick = high - Math.max(open, close);
        const lowerWick = Math.min(open, close) - low;
        const totalRange = high - low;

        let pattern: PatternResult = { name: 'None', signal: 'neutral' };

        // 1. Doji (Indecision)
        // Body is very small relative to total range (< 10%)
        if (totalRange > 0 && bodySize <= totalRange * 0.1) {
            pattern = { name: 'Doji', signal: 'neutral' };
        }

        // 2. Hammer (Bullish Reversal)
        // Small body at top, long lower wick (> 2x body), short upper wick
        // Usually found in downtrend (checking if close < prev.close is a simple proxy)
        else if (
            lowerWick > bodySize * 2 &&
            upperWick < bodySize * 0.5 &&
            close < prev.close // Simple check for downtrend context
        ) {
            pattern = { name: 'Hammer', signal: 'bullish' };
        }

        // 3. Shooting Star (Bearish Reversal)
        // Small body at bottom, long upper wick (> 2x body), short lower wick
        // Usually found in uptrend
        else if (
            upperWick > bodySize * 2 &&
            lowerWick < bodySize * 0.5 &&
            close > prev.close // Simple check for uptrend context
        ) {
            pattern = { name: 'Shooting Star', signal: 'bearish' };
        }

        // 4. Bullish Engulfing
        // Current is Green, Previous was Red.
        // Current Body fully engulfs Previous Body.
        else if (
            close > open && // Green
            prev.close < prev.open && // Red
            open < prev.close &&
            close > prev.open
        ) {
            pattern = { name: 'Bullish Engulfing', signal: 'bullish' };
        }

        // 5. Bearish Engulfing
        // Current is Red, Previous was Green.
        // Current Body fully engulfs Previous Body.
        else if (
            close < open && // Red
            prev.close > prev.open && // Green
            open > prev.close &&
            close < prev.open
        ) {
            pattern = { name: 'Bearish Engulfing', signal: 'bearish' };
        }

        return { ...candle, pattern };
    });
};
