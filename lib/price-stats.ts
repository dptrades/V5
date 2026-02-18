import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

export interface PeriodStats {
    label: string;
    open: number;
    high: number;
    low: number;
    close: number;
    change: number;       // absolute change
    changePct: number;    // percentage change
    volume?: number;
}

export interface PriceStatsData {
    currentDay: PeriodStats | null;
    previousDay: PeriodStats | null;
    currentWeek: PeriodStats | null;
    previousWeek: PeriodStats | null;
    currentMonth: PeriodStats | null;
    previousMonth: PeriodStats | null;
    currentYear: PeriodStats | null;
    previousYear: PeriodStats | null;
    fiftyTwoWeek: PeriodStats | null;
    allTime: PeriodStats | null;
}

export async function fetchPriceStats(symbol: string): Promise<PriceStatsData> {
    const result: PriceStatsData = {
        currentDay: null, previousDay: null,
        currentWeek: null, previousWeek: null,
        currentMonth: null, previousMonth: null,
        currentYear: null, previousYear: null,
        fiftyTwoWeek: null,
        allTime: null
    };

    try {
        // Fetch 2 years of daily data for all period calculations
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

        const chartResult = await yahooFinance.chart(symbol, {
            period1: twoYearsAgo,
            interval: '1d' as any
        });

        if (!chartResult || !chartResult.quotes || chartResult.quotes.length < 2) {
            return result;
        }

        const bars = (chartResult.quotes as any[])
            .filter((q: any) => q.close !== null && q.open !== null)
            .map((q: any) => ({
                date: new Date(q.date),
                open: q.open,
                high: q.high,
                low: q.low,
                close: q.close,
                volume: q.volume || 0
            }));

        if (bars.length < 2) return result;

        const now = new Date();

        // --- CURRENT DAY & PREVIOUS DAY ---
        const lastBar = bars[bars.length - 1];
        const prevBar = bars[bars.length - 2];

        result.currentDay = makePeriodStats('Today', lastBar.open, lastBar.high, lastBar.low, lastBar.close, lastBar.volume);
        result.previousDay = makePeriodStats('Previous Day', prevBar.open, prevBar.high, prevBar.low, prevBar.close, prevBar.volume);

        // --- CURRENT WEEK & PREVIOUS WEEK ---
        const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)); // Monday
        startOfWeek.setHours(0, 0, 0, 0);

        const startOfPrevWeek = new Date(startOfWeek);
        startOfPrevWeek.setDate(startOfPrevWeek.getDate() - 7);

        const thisWeekBars = bars.filter(b => b.date >= startOfWeek);
        const prevWeekBars = bars.filter(b => b.date >= startOfPrevWeek && b.date < startOfWeek);

        if (thisWeekBars.length > 0) {
            result.currentWeek = aggregateBars('This Week', thisWeekBars);
        }
        if (prevWeekBars.length > 0) {
            result.previousWeek = aggregateBars('Previous Week', prevWeekBars);
        }

        // --- CURRENT MONTH & PREVIOUS MONTH ---
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        const thisMonthBars = bars.filter(b => b.date >= startOfMonth);
        const prevMonthBars = bars.filter(b => b.date >= startOfPrevMonth && b.date < startOfMonth);

        if (thisMonthBars.length > 0) {
            result.currentMonth = aggregateBars('This Month', thisMonthBars);
        }
        if (prevMonthBars.length > 0) {
            result.previousMonth = aggregateBars('Previous Month', prevMonthBars);
        }

        // --- CURRENT YEAR & PREVIOUS YEAR ---
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const startOfPrevYear = new Date(now.getFullYear() - 1, 0, 1);

        const thisYearBars = bars.filter(b => b.date >= startOfYear);
        const prevYearBars = bars.filter(b => b.date >= startOfPrevYear && b.date < startOfYear);

        if (thisYearBars.length > 0) {
            result.currentYear = aggregateBars('YTD', thisYearBars);
        }
        if (prevYearBars.length > 0) {
            result.previousYear = aggregateBars('Previous Year', prevYearBars);
        }

        // --- 52 WEEK ---
        const startOfFiftyTwoWeek = new Date(now);
        startOfFiftyTwoWeek.setDate(now.getDate() - 365);
        const fiftyTwoWeekBars = bars.filter(b => b.date >= startOfFiftyTwoWeek);
        if (fiftyTwoWeekBars.length > 0) {
            result.fiftyTwoWeek = aggregateBars('52 Week', fiftyTwoWeekBars);
        }

        // --- ALL TIME ---
        result.allTime = aggregateBars('All Time', bars);

    } catch (e) {
        console.error(`Price stats fetch failed for ${symbol}`, e);
    }

    return result;
}

function makePeriodStats(label: string, open: number, high: number, low: number, close: number, volume?: number): PeriodStats {
    const change = close - open;
    const changePct = open !== 0 ? (change / open) * 100 : 0;
    return { label, open, high, low, close, change, changePct, volume };
}

function aggregateBars(label: string, bars: { open: number; high: number; low: number; close: number; volume: number }[]): PeriodStats {
    const open = bars[0].open;
    const close = bars[bars.length - 1].close;
    const high = Math.max(...bars.map(b => b.high));
    const low = Math.min(...bars.map(b => b.low));
    const volume = bars.reduce((sum, b) => sum + b.volume, 0);
    return makePeriodStats(label, open, high, low, close, volume);
}
