
// Plain JS to avoid TS issues
const isMarketHoliday = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed
    const day = date.getDate();

    // Helper: get Nth weekday of a month (e.g., 3rd Monday)
    const nthWeekday = (y, m, weekday, n) => {
        const first = new Date(y, m, 1).getDay();
        let d = 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
        return d;
    };

    // Helper: compute Easter Sunday (Butcher's algorithm)
    const easterSunday = (y) => {
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

    // Observed holidays
    const weekDay = date.getDay();
    if (month === 0 && day === 2 && weekDay === 1) return true;
    if (month === 6 && day === 3 && weekDay === 5) return true;
    if (month === 6 && day === 5 && weekDay === 1) return true;
    if (month === 5 && day === 18 && weekDay === 5) return true;
    if (month === 5 && day === 20 && weekDay === 1) return true;
    if (month === 11 && day === 24 && weekDay === 5) return true;
    if (month === 11 && day === 26 && weekDay === 1) return true;

    // Dynamic holidays
    if (month === 0 && day === nthWeekday(year, 0, 1, 3)) return true; // MLK
    if (month === 1 && day === nthWeekday(year, 1, 1, 3)) return true; // Presidents
    if (month === 4 && day === nthWeekday(year, 4, 1, 4)) return true; // Memorial
    if (month === 8 && day === nthWeekday(year, 8, 1, 1)) return true; // Labor
    if (month === 10 && day === nthWeekday(year, 10, 4, 4)) return true; // Thanksgiving

    // Memorial Day correction for last Monday
    const lastMay = new Date(year, 5, 0);
    const lastMayMonday = lastMay.getDate() - ((lastMay.getDay() + 6) % 7);
    if (month === 4 && day === lastMayMonday) return true;

    // Good Friday
    const easter = easterSunday(year);
    const goodFriday = new Date(easter);
    goodFriday.setDate(goodFriday.getDate() - 2);
    if (month === goodFriday.getMonth() && day === goodFriday.getDate()) return true;

    return false;
};

const getMarketSession = () => {
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

console.log("--- Debugging Market Session ---");
const now = new Date();
console.log("System Time (UTC?):", now.toISOString());
console.log("System Time (Local):", now.toString());

const estDateString = now.toLocaleString("en-US", { timeZone: "America/New_York" });
console.log("EST String:", estDateString);

const estTime = new Date(estDateString);
console.log("Parsed EST Time Object:", estTime.toString());
console.log("EST Hours:", estTime.getHours());
console.log("EST Minutes:", estTime.getMinutes());
console.log("EST Day:", estTime.getDay());

const timeVal = estTime.getHours() + estTime.getMinutes() / 60;
console.log("TimeVal:", timeVal);

console.log("Is Holiday?", isMarketHoliday(estTime));
console.log("Market Session:", getMarketSession());
