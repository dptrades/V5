/**
 * localdate.ts — Timezone-safe date helpers
 *
 * Always use these instead of `new Date().toISOString().split('T')[0]` on the server.
 * toISOString() returns UTC, which rolls to the next calendar day after ~7-8pm Eastern Time.
 */

const TZ = 'America/New_York';

/**
 * Returns today's date as YYYY-MM-DD in Eastern Time.
 * e.g. "2026-03-04" even at 11pm EST (which would be "2026-03-05" in UTC).
 */
export function localDateString(date: Date = new Date()): string {
    // en-CA locale natively formats dates as YYYY-MM-DD
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date);
}

/**
 * Returns a past date as YYYY-MM-DD in Eastern Time, offset by `daysAgo`.
 * e.g. localDateStringOffset(3) → 3 calendar days ago in Eastern Time
 */
export function localDateStringOffset(daysAgo: number): string {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}
