export type MarketSession = 'PRE' | 'REG' | 'POST' | 'OFF';

export const REFRESH_INTERVALS = {
    PRICE: 60 * 1000,           // 1 Minute
    DAYDREAM: 5 * 60 * 1000,    // 5 Minutes
    DEEP_DIVE: 60 * 1000,  // 1 Minute
    WIDGETS: 15 * 60 * 1000,    // 15 Minutes
    NEWS: 2 * 60 * 60 * 1000,       // 2 Hours
    AUTO_REFRESH: 15 * 60 * 1000, // 15 Minutes (Universal for Alpha Hunter, Top Picks, etc)
};

export const isMarketHoliday = (date: Date): boolean => {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed
    const day = date.getDate();

    // Helper: get Nth weekday of a month (e.g., 3rd Monday)
    const nthWeekday = (y: number, m: number, weekday: number, n: number): number => {
        const first = new Date(y, m, 1).getDay();
        let d = 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
        return d;
    };

    // Helper: compute Easter Sunday (Butcher's algorithm)
    const easterSunday = (y: number): Date => {
        const a = y % 19;
        const b = Math.floor(y / 100);
        const c = y % 100;
        const d = Math.floor(b / 4);
        const e = b % 4;
        const f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4);
        const k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m2 = Math.floor((a + 11 * h + 22 * l) / 451);
        const em = Math.floor((h + l - 7 * m2 + 114) / 31);
        const ed = ((h + l - 7 * m2 + 114) % 31) + 1;
        return new Date(y, em - 1, ed);
    };

    // Fixed holidays
    if (month === 0 && day === 1) return true; // New Year's Day
    if (month === 6 && day === 4) return true; // Independence Day
    if (month === 5 && day === 19) return true; // Juneteenth
    if (month === 11 && day === 25) return true; // Christmas

    // Observed holidays (if falls on Sat → Fri, if Sun → Mon)
    const weekDay = date.getDay();
    if (month === 0 && day === 2 && weekDay === 1) return true; // New Year's observed (Sun→Mon)
    if (month === 6 && day === 3 && weekDay === 5) return true; // July 4th observed (Sat→Fri)
    if (month === 6 && day === 5 && weekDay === 1) return true; // July 4th observed (Sun→Mon)
    if (month === 5 && day === 18 && weekDay === 5) return true; // Juneteenth observed
    if (month === 5 && day === 20 && weekDay === 1) return true; // Juneteenth observed
    if (month === 11 && day === 24 && weekDay === 5) return true; // Christmas observed
    if (month === 11 && day === 26 && weekDay === 1) return true; // Christmas observed

    // Dynamic holidays (Nth weekday of month)
    if (month === 0 && day === nthWeekday(year, 0, 1, 3)) return true; // MLK Day: 3rd Monday of Jan
    if (month === 1 && day === nthWeekday(year, 1, 1, 3)) return true; // Presidents' Day: 3rd Monday of Feb
    if (month === 4 && day === nthWeekday(year, 4, 1, 4)) return true; // Memorial Day: last Monday of May (approx via 4th, adjust below)
    if (month === 8 && day === nthWeekday(year, 8, 1, 1)) return true; // Labor Day: 1st Monday of Sep
    if (month === 10 && day === nthWeekday(year, 10, 4, 4)) return true; // Thanksgiving: 4th Thursday of Nov

    // Memorial Day correction: last Monday of May
    const lastMay = new Date(year, 5, 0); // May 31
    const lastMayMonday = lastMay.getDate() - ((lastMay.getDay() + 6) % 7);
    if (month === 4 && day === lastMayMonday) return true;

    // Good Friday: 2 days before Easter Sunday
    const easter = easterSunday(year);
    const goodFriday = new Date(easter);
    goodFriday.setDate(goodFriday.getDate() - 2);
    if (month === goodFriday.getMonth() && day === goodFriday.getDate()) return true;

    return false;
};

export const getMarketSession = (): MarketSession => {
    const now = new Date();
    const estDateString = now.toLocaleString("en-US", { timeZone: "America/New_York" });
    const estTime = new Date(estDateString);
    const hours = estTime.getHours();
    const minutes = estTime.getMinutes();
    const timeVal = hours + minutes / 60;
    const day = estTime.getDay();

    if (day === 0 || day === 6 || isMarketHoliday(estTime)) return 'OFF';
    if (timeVal >= 9.5 && timeVal < 16) return 'REG';
    if (timeVal >= 4 && timeVal < 9.5) return 'PRE';
    if (timeVal >= 16 && timeVal < 20) return 'POST';
    return 'OFF';
};

export const isMarketActive = (): boolean => {
    return getMarketSession() !== 'OFF';
};

export const getNextMarketOpen = (): Date => {
    const now = new Date();
    const estDateString = now.toLocaleString("en-US", { timeZone: "America/New_York" });
    const estTime = new Date(estDateString);

    // Create a new date for "tomorrow" at 4:00 AM EST (Pre-market start)
    const nextOpen = new Date(estTime);
    nextOpen.setHours(4, 0, 0, 0);

    // If it's already past 4am today, or it's a weekend/holiday, move forward
    if (estTime.getHours() >= 4 || estTime.getDay() === 0 || estTime.getDay() === 6 || isMarketHoliday(estTime)) {
        nextOpen.setDate(nextOpen.getDate() + 1);
    }

    // Skip weekends AND holidays
    while (nextOpen.getDay() === 0 || nextOpen.getDay() === 6 || isMarketHoliday(nextOpen)) {
        nextOpen.setDate(nextOpen.getDate() + 1);
    }

    return nextOpen;
};

export const formatLastUpdated = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};
