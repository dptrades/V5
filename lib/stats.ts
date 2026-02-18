import { OHLCVData } from '@/types/financial';

export interface TimeFrameStats {
    high: number;
    low: number;
}

export interface PriceStats {
    currentPrice: number;
    previousDay: TimeFrameStats;
    currentWeek: TimeFrameStats;
    previousWeek: TimeFrameStats;
    currentMonth: TimeFrameStats;
    currentYear: TimeFrameStats;
    fiftyTwoWeek: TimeFrameStats;
    allTime: TimeFrameStats;
}

export const calculatePriceStats = (data: OHLCVData[]): PriceStats => {
    if (!data || data.length === 0) {
        const empty = { high: 0, low: 0 };
        return {
            currentPrice: 0,
            previousDay: empty,
            currentWeek: empty,
            previousWeek: empty,
            currentMonth: empty,
            currentYear: empty,
            fiftyTwoWeek: empty,
            allTime: empty
        };
    }

    // Ensure sorted by time ascending
    const sortedData = [...data].sort((a, b) => a.time - b.time);
    const lastCandle = sortedData[sortedData.length - 1];
    const currentPrice = lastCandle.close;

    // Helper to get High/Low for a time range
    const getHighLow = (startDate: Date, endDate: Date): TimeFrameStats => {
        const rangeData = sortedData.filter(d => d.time >= startDate.getTime() && d.time < endDate.getTime());
        if (rangeData.length === 0) return { high: 0, low: 0 };

        // Calculate max high and min low in the range
        const highs = rangeData.map(d => d.high);
        const lows = rangeData.map(d => d.low);

        return {
            high: Math.max(...highs),
            low: Math.min(...lows)
        };
    };

    // Dates
    const now = new Date();

    // Previous Day (Previous Trading Session)
    // Works for both Daily (single candle) and Intraday (aggregated candles)
    // Also handles weekends for stocks automatically by finding the previous distinct date in data
    const lastDateStr = new Date(lastCandle.time).toDateString();
    let previousDayStats = { high: 0, low: 0 };

    // Find the last candle that belongs to a different day than the current last candle
    let prevDayRefCandle = null;
    for (let i = sortedData.length - 1; i >= 0; i--) {
        if (new Date(sortedData[i].time).toDateString() !== lastDateStr) {
            prevDayRefCandle = sortedData[i];
            break;
        }
    }

    if (prevDayRefCandle) {
        const prevDateStr = new Date(prevDayRefCandle.time).toDateString();
        // Aggregate all candles from that day
        const prevDayData = sortedData.filter(d => new Date(d.time).toDateString() === prevDateStr);
        if (prevDayData.length > 0) {
            const highs = prevDayData.map(d => d.high);
            const lows = prevDayData.map(d => d.low);
            previousDayStats = { high: Math.max(...highs), low: Math.min(...lows) };
        }
    }

    // Current Week (Start Monday)
    const currentWeekStart = new Date(now);
    const day = currentWeekStart.getDay();
    const diff = currentWeekStart.getDate() - day + (day === 0 ? -6 : 1);
    currentWeekStart.setDate(diff);
    currentWeekStart.setHours(0, 0, 0, 0);

    // Previous Week
    const prevWeekStart = new Date(currentWeekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekEnd = new Date(currentWeekStart); // End of prev week is start of current

    // Current Month
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Current Year
    const currentYearStart = new Date(now.getFullYear(), 0, 1);

    // 52 Week
    const fiftyTwoWeekStart = new Date(now);
    fiftyTwoWeekStart.setDate(now.getDate() - 365);

    // All Time (from available data)
    const allHighs = sortedData.map(d => d.high);
    const allLows = sortedData.map(d => d.low);

    return {
        currentPrice,
        previousDay: previousDayStats,
        currentWeek: getHighLow(currentWeekStart, now),
        previousWeek: getHighLow(prevWeekStart, prevWeekEnd),
        currentMonth: getHighLow(currentMonthStart, now),
        currentYear: getHighLow(currentYearStart, now),
        fiftyTwoWeek: getHighLow(fiftyTwoWeekStart, now),
        allTime: { high: Math.max(...allHighs), low: Math.min(...allLows) }
    };
};
