export type MarketSession = 'PRE' | 'REG' | 'POST' | 'OFF';

export interface MarketStatus {
    isOpen: boolean;
    session: MarketSession;
    description: string;
    nextOpen?: string;
}

// 2026 US Market Holiday List (YYYY-MM-DD)
const HOLIDAYS_2026 = [
    '2026-01-01', // New Year's Day
    '2026-01-19', // MLK Day
    '2026-02-16', // Presidents' Day
    '2026-04-03', // Good Friday
    '2026-05-25', // Memorial Day
    '2026-06-19', // Juneteenth
    '2026-07-03', // Independence Day (Observed)
    '2026-09-07', // Labor Day
    '2026-11-26', // Thanksgiving
    '2026-12-25', // Christmas
];

export function getMarketStatus(): MarketStatus {
    const now = new Date();
    const estDate = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const day = estDate.getDay();
    const hours = estDate.getHours();
    const minutes = estDate.getMinutes();
    const timeVal = hours + minutes / 60;
    const dateStr = estDate.toLocaleDateString('en-CA');

    // 1. Check for Weekends or Holidays
    const isWeekend = day === 0 || day === 6;
    const isHoliday = HOLIDAYS_2026.includes(dateStr);

    if (isWeekend || isHoliday) {
        return {
            isOpen: false,
            session: 'OFF',
            description: isHoliday ? "Market is closed for holiday." : "Market is closed for the weekend.",
            nextOpen: calculateNextOpen(estDate)
        };
    }

    // 2. Determine Session
    let session: MarketSession = 'OFF';
    let isOpen = false;
    let description = "Market is closed.";

    if (timeVal >= 9.5 && timeVal < 16) {
        session = 'REG';
        isOpen = true;
        description = "Market is open (Regular Hours).";
    } else if (timeVal >= 4 && timeVal < 9.5) {
        session = 'PRE';
        description = "Market is in Pre-Market session.";
    } else if (timeVal >= 16 && timeVal < 20) {
        session = 'POST';
        description = "Market is in After-Hours session.";
    }

    return {
        isOpen,
        session,
        description,
        nextOpen: isOpen ? undefined : calculateNextOpen(estDate)
    };
}

function calculateNextOpen(currentEst: Date): string {
    const next = new Date(currentEst);

    // Safety break to prevent infinite loop (max 10 days)
    for (let i = 0; i < 10; i++) {
        // Move to tomorrow
        next.setDate(next.getDate() + 1);

        const day = next.getDay();
        const dateStr = next.toLocaleDateString('en-CA'); // 'en-CA' gives YYYY-MM-DD
        const isWeekend = day === 0 || day === 6;
        const isHoliday = HOLIDAYS_2026.includes(dateStr);

        if (!isWeekend && !isHoliday) {
            // Found the next business day
            const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' };
            return next.toLocaleDateString('en-US', options);
        }
    }

    return "Next Business Day";
}
