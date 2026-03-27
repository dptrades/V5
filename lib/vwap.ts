import { OHLCVData } from '../types/financial';

export type VWAPAnchor = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'none';

/**
 * Calculates anchored VWAP for a set of bars.
 * VWAP = Sum(Volume * Typical Price) / Sum(Volume)
 * Typical Price = (High + Low + Close) / 3
 */
export function calculateAnchoredVWAP(data: OHLCVData[], anchor: VWAPAnchor = 'none'): number[] {
    if (data.length === 0) return [];

    const results: number[] = [];
    let cumulativeVP = 0;
    let cumulativeVol = 0;
    let lastAnchorKey = '';

    for (const bar of data) {
        const date = new Date(bar.time);
        let currentAnchorKey = '';

        if (anchor === 'daily') {
            currentAnchorKey = date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // YYYY-MM-DD
        } else if (anchor === 'weekly') {
            // Get Monday of the week in ET
            const etDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
            const day = etDate.getDay();
            const diff = etDate.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(etDate).setDate(diff);
            currentAnchorKey = new Date(monday).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
        } else if (anchor === 'monthly') {
            const etTime = date.toLocaleString('en-US', { timeZone: 'America/New_York' });
            const etDate = new Date(etTime);
            currentAnchorKey = `${etDate.getFullYear()}-${etDate.getMonth()}`;
        } else if (anchor === 'yearly') {
            const etTime = date.toLocaleString('en-US', { timeZone: 'America/New_York' });
            const etDate = new Date(etTime);
            currentAnchorKey = `${etDate.getFullYear()}`;
        }

        // Reset if anchor changed
        if (anchor !== 'none' && currentAnchorKey !== lastAnchorKey) {
            cumulativeVP = 0;
            cumulativeVol = 0;
            lastAnchorKey = currentAnchorKey;
        }

        const typicalPrice = (bar.high + bar.low + bar.close) / 3;
        cumulativeVP += typicalPrice * bar.volume;
        cumulativeVol += bar.volume;

        results.push(cumulativeVol > 0 ? cumulativeVP / cumulativeVol : bar.close);
    }

    return results;
}
