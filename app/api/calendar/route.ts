import { NextResponse } from 'next/server';
import { finnhubClient } from '@/lib/finnhub';

// ─── 2026 Known Major Event Schedules ────────────────────────────────────────

const FOMC_DATES_2026 = [
  { date: "2026-01-28", label: "FOMC Decision", type: "fomc" },
  { date: "2026-03-19", label: "FOMC Decision", type: "fomc" },
  { date: "2026-05-07", label: "FOMC Decision", type: "fomc" },
  { date: "2026-06-18", label: "FOMC Decision", type: "fomc" },
  { date: "2026-07-30", label: "FOMC Decision", type: "fomc" },
  { date: "2026-09-17", label: "FOMC Decision", type: "fomc" },
  { date: "2026-10-29", label: "FOMC Decision", type: "fomc" },
  { date: "2026-12-10", label: "FOMC Decision", type: "fomc" },
];

// Major economic reports approximate dates (updated for 2026)
const ECONOMIC_EVENTS_2026 = [
  // CPI — typically 2nd Wednesday/Thursday of month
  { date: "2026-01-14", label: "CPI Report", type: "macro" },
  { date: "2026-02-11", label: "CPI Report", type: "macro" },
  { date: "2026-03-11", label: "CPI Report", type: "macro" },
  { date: "2026-04-08", label: "CPI Report", type: "macro" },
  { date: "2026-05-13", label: "CPI Report", type: "macro" },
  { date: "2026-06-10", label: "CPI Report", type: "macro" },
  { date: "2026-07-09", label: "CPI Report", type: "macro" },
  { date: "2026-08-12", label: "CPI Report", type: "macro" },
  { date: "2026-09-09", label: "CPI Report", type: "macro" },
  { date: "2026-10-14", label: "CPI Report", type: "macro" },
  { date: "2026-11-11", label: "CPI Report", type: "macro" },
  { date: "2026-12-09", label: "CPI Report", type: "macro" },

  // NFP (Jobs) — typically first Friday of month
  { date: "2026-01-09", label: "NFP / Jobs Report", type: "macro" },
  { date: "2026-02-06", label: "NFP / Jobs Report", type: "macro" },
  { date: "2026-03-06", label: "NFP / Jobs Report", type: "macro" },
  { date: "2026-04-03", label: "NFP / Jobs Report", type: "macro" },
  { date: "2026-05-01", label: "NFP / Jobs Report", type: "macro" },
  { date: "2026-06-05", label: "NFP / Jobs Report", type: "macro" },
  { date: "2026-07-10", label: "NFP / Jobs Report", type: "macro" },
  { date: "2026-08-07", label: "NFP / Jobs Report", type: "macro" },
  { date: "2026-09-04", label: "NFP / Jobs Report", type: "macro" },
  { date: "2026-10-02", label: "NFP / Jobs Report", type: "macro" },
  { date: "2026-11-06", label: "NFP / Jobs Report", type: "macro" },
  { date: "2026-12-04", label: "NFP / Jobs Report", type: "macro" },

  // GDP
  { date: "2026-01-29", label: "GDP (Advance Q4)", type: "macro" },
  { date: "2026-04-29", label: "GDP (Advance Q1)", type: "macro" },
  { date: "2026-07-29", label: "GDP (Advance Q2)", type: "macro" },
  { date: "2026-10-29", label: "GDP (Advance Q3)", type: "macro" },
];

// ─── Compute OPEX and Triple Witching algorithmically ────────────────────────

function getNthWeekday(year: number, month: number, weekday: number, n: number): Date {
  // weekday: 0=Sun, 1=Mon, ..., 5=Fri
  const d = new Date(year, month, 1);
  let count = 0;
  while (d.getMonth() === month) {
    if (d.getDay() === weekday) {
      count++;
      if (count === n) return new Date(d);
    }
    d.setDate(d.getDate() + 1);
  }
  return new Date(year, month, 1); // fallback
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function buildOPEXEvents(year: number) {
  const events = [];
  const tripleMonths = new Set([2, 5, 8, 11]); // Mar, Jun, Sep, Dec (0-indexed)

  for (let month = 0; month < 12; month++) {
    const thirdFriday = getNthWeekday(year, month, 5, 3);
    const dateStr = toDateStr(thirdFriday);

    if (tripleMonths.has(month)) {
      events.push({ date: dateStr, label: "Triple Witching", type: "opex" });
    } else {
      events.push({ date: dateStr, label: "Monthly OPEX", type: "opex" });
    }

    // Quarterly FOMC week (Q-end month) note
    if (tripleMonths.has(month)) {
      const quadruple = new Date(thirdFriday);
      events.push({ date: dateStr, label: "Quarterly Rebalance", type: "opex" });
    }

    // Weekly OPEX — every Friday except monthly OPEX Friday
    const weeksInMonth = [1, 2, 4, 5];
    for (const w of weeksInMonth) {
      const friday = getNthWeekday(year, month, 5, w);
      if (friday.getMonth() === month && toDateStr(friday) !== dateStr) {
        events.push({ date: toDateStr(friday), label: "Weekly OPEX", type: "opex_weekly" });
      }
    }
  }

  return events;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const now = new Date();
    const year = now.getFullYear();

    // Determine "today" and "end of this week" (Sunday ET)
    const todayStr = toDateStr(now);

    // Get end of this week (upcoming Sunday)
    const dayOfWeek = now.getDay(); // 0=Sun
    const daysUntilSunday = 7 - dayOfWeek;
    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() + daysUntilSunday);
    const endOfWeekStr = toDateStr(endOfWeek);

    // Fetch real-time economic events from Finnhub
    const finnhubEvents = await finnhubClient.getEconomicCalendar(todayStr, endOfWeekStr);
    const mappedFinnhub = finnhubEvents
      .filter(e => e.country === 'United States')
      .map(e => ({
        date: e.time.split(' ')[0], // YYYY-MM-DD
        label: e.event,
        type: 'macro'
      }));

    // Build calendar of events
    const allEvents = [
      ...FOMC_DATES_2026,
      ...mappedFinnhub,
      ...buildOPEXEvents(year),
    ];

    // Filter: today + rest of this week
    const todayEvents = allEvents
      .filter(e => e.date === todayStr)
      .filter((v, i, a) => a.findIndex(t => t.label === v.label && t.date === v.date) === i);

    const weekEvents = allEvents
      .filter(e => e.date >= todayStr && e.date <= endOfWeekStr)
      .filter((v, i, a) => a.findIndex(t => t.label === v.label && t.date === v.date) === i)
      .sort((a, b) => a.date.localeCompare(b.date));

    // Risk rating for the week
    const fomcThisWeek = weekEvents.some(e => e.type === "fomc");
    const tripleThisWeek = weekEvents.some(e => e.label === "Triple Witching");
    const weekRisk = fomcThisWeek && tripleThisWeek ? "Extreme" : fomcThisWeek || tripleThisWeek ? "High" : weekEvents.some(e => e.type === "macro") ? "Moderate" : "Low";

    return NextResponse.json({
      today: todayStr,
      weekRisk,
      todayEvents,
      weekEvents,
    });
  } catch (error) {
    console.error("Calendar API Error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
