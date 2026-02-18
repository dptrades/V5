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
    status: 'ACTIVE' | 'EXPIRED' | 'CLOSED';
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
        ticker: option.symbol.split(/[0-9]/)[0], // Simple ticker extraction from OSI
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

export async function updateTrackedOptions(getLatestData: (ticker: string, symbol: string) => Promise<{ premium: number, stockPrice: number } | null>) {
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

        // Avoid duplicate updates for the same day
        if (option.history.some(h => h.date === today)) continue;

        try {
            const latest = await getLatestData(option.ticker, option.id);
            if (latest) {
                option.history.push({
                    date: today,
                    optionPremium: latest.premium,
                    stockPrice: latest.stockPrice
                });
                hasChanges = true;
            }
        } catch (e) {
            console.error(`Failed to update performance for ${option.id}:`, e);
        }
    }

    if (hasChanges) {
        saveTrackedOptions(tracked);
    }
}
