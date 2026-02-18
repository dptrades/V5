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
            currentAnchorKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
        } else if (anchor === 'weekly') {
            // Get Monday of the week
            const day = date.getDay();
            const diff = date.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(date).setDate(diff); // Use temporary date for calc
            currentAnchorKey = new Date(monday).toISOString().split('T')[0];
        } else if (anchor === 'monthly') {
            currentAnchorKey = `${date.getFullYear()}-${date.getMonth()}`;
        } else if (anchor === 'yearly') {
            currentAnchorKey = `${date.getFullYear()}`;
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
