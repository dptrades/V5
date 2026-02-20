import fs from 'fs';
import path from 'path';
import { OptionRecommendation } from '../types/options';

const DATA_DIR = path.join(process.cwd(), 'data');
const TRACKING_FILE = path.join(DATA_DIR, 'tracked_options.json');

export interface PerformanceEntry {
    date: string;
    optionPremium: number;
    stockPrice: number;
}

export interface TrackedOption {
    id: string;
    ticker: string;
    companyName: string;
    strike: number;
    expiry: string;
    type: 'CALL' | 'PUT';
    entryPremium: number;
    entryStockPrice: number;
    entryDate: string;
    reasoning: string[];
    history: PerformanceEntry[];
    status: 'ACTIVE' | 'EXPIRED' | 'CLOSED' | 'PROFIT' | 'LOSS';
}

export function getTrackedOptions(): TrackedOption[] {
    if (!fs.existsSync(TRACKING_FILE)) {
        return [];
    }
    try {
        const content = fs.readFileSync(TRACKING_FILE, 'utf-8');
        return JSON.parse(content);
    } catch (e) {
        console.error('Error reading tracked options:', e);
        return [];
    }
}

export function saveTrackedOptions(options: TrackedOption[]) {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(TRACKING_FILE, JSON.stringify(options, null, 2), 'utf-8');
}

export function trackOption(option: OptionRecommendation, companyName: string, underlyingPrice: number) {
    if (!option.symbol || !option.strike || !option.expiry) {
        throw new Error('Incomplete option data for tracking');
    }

    const tracked = getTrackedOptions();

    // Check if already tracked
    if (tracked.some(o => o.id === option.symbol)) {
        return;
    }

    const newTracked: TrackedOption = {
        id: option.symbol,
        ticker: (option.symbol.split(/[0-9]/)[0] || companyName).trim(), // Clean ticker extraction
        companyName,
        strike: option.strike,
        expiry: option.expiry,
        type: option.type as 'CALL' | 'PUT',
        entryPremium: option.contractPrice || 0,
        entryStockPrice: underlyingPrice,
        entryDate: new Date().toISOString().split('T')[0],
        reasoning: option.technicalDetails || [option.reason],
        history: [{
            date: new Date().toISOString().split('T')[0],
            optionPremium: option.contractPrice || 0,
            stockPrice: underlyingPrice
        }],
        status: 'ACTIVE'
    };

    tracked.push(newTracked);
    saveTrackedOptions(tracked);
    return newTracked;
}

export async function updateTrackedOptions(getLatestData: (option: TrackedOption) => Promise<{ premium: number, stockPrice: number } | null>) {
    const tracked = getTrackedOptions();
    const today = new Date().toISOString().split('T')[0];
    let hasChanges = false;

    for (const option of tracked) {
        if (option.status !== 'ACTIVE') continue;

        // Check if expiry has passed
        if (new Date(option.expiry) < new Date(today)) {
            option.status = 'EXPIRED';
            hasChanges = true;
            continue;
        }

        try {
            const latest = await getLatestData(option);
            if (latest) {
                const todayEntryIndex = option.history.findIndex(h => h.date === today);

                // If it's the day of entry, we want to KEEP the entry price in history
                // and not overwrite it with the EOD price, to honor the user's 
                // "price at click time" preference.
                if (option.entryDate === today) {
                    // Do nothing for history today if it's already there
                    if (todayEntryIndex === -1) {
                        option.history.push({
                            date: today,
                            optionPremium: latest.premium,
                            stockPrice: latest.stockPrice
                        });
                        hasChanges = true;
                    }
                } else {
                    // For non-entry days, we can overwrite the today entry with the latest EOD data
                    if (todayEntryIndex !== -1) {
                        option.history[todayEntryIndex] = {
                            date: today,
                            optionPremium: latest.premium,
                            stockPrice: latest.stockPrice
                        };
                    } else {
                        option.history.push({
                            date: today,
                            optionPremium: latest.premium,
                            stockPrice: latest.stockPrice
                        });
                    }

                    // Evaluate Profit/Loss (only if entryPremium is valid)
                    if (option.entryPremium > 0) {
                        const gainLossPct = ((latest.premium - option.entryPremium) / option.entryPremium) * 100;
                        if (gainLossPct >= 25) {
                            option.status = 'PROFIT';
                        } else if (gainLossPct <= -25) {
                            option.status = 'LOSS';
                        }
                    }

                    hasChanges = true;
                }
            }
        } catch (e) {
            console.error(`Failed to update performance for ${option.id}:`, e);
        }
    }

    if (hasChanges) {
        saveTrackedOptions(tracked);
    }
}

export function deleteTrackedOption(id: string) {
    const tracked = getTrackedOptions();
    const updated = tracked.filter(o => o.id !== id);
    if (tracked.length !== updated.length) {
        saveTrackedOptions(updated);
        return true;
    }
    return false;
}
