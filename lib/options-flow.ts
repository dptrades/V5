import YahooFinance from 'yahoo-finance2';
import { OptionsChain, OptionContract } from '../types/options';
import { publicClient } from './public-api';
import { schwabClient } from './schwab';

const yahooFinance = new YahooFinance();

export interface UnusualOption {
    symbol: string;
    type: 'CALL' | 'PUT';
    strike: number;
    expiry: string;
    lastPrice: number;
    volume: number;
    openInterest: number;
    volToOiRatio: number;
    impliedVolatility: number;
    bias: 'BULLISH' | 'BEARISH';
}

export async function scanUnusualOptions(symbol: string): Promise<UnusualOption[]> {
    // 1. Try Schwab First (Primary, 10-min cache) → Public.com fallback
    try {
        console.log(`[OptionsFlow] Fetching unusual options for ${symbol}...`);
        let chain = schwabClient.isConfigured()
            ? await schwabClient.getOptionChainNormalized(symbol)
            : null;
        if (!chain && publicClient.isConfigured()) {
            chain = await publicClient.getOptionChain(symbol);
        }
        if (chain) {
            const unusual: UnusualOption[] = [];
            for (const exp in chain.options) {
                for (const strikeStr in chain.options[exp]) {
                    const strike = parseFloat(strikeStr);
                    const data = chain.options[exp][strike];

                    const process = (opt: any, type: 'CALL' | 'PUT') => {
                        if (opt && opt.volume > (opt.openInterest || 0) && opt.volume > 100) {
                            const ratio = opt.openInterest > 0 ? (opt.volume / opt.openInterest) : opt.volume;
                            unusual.push({
                                symbol: opt.symbol,
                                type,
                                strike: opt.strike,
                                expiry: opt.expiration,
                                lastPrice: opt.last,
                                volume: opt.volume,
                                openInterest: opt.openInterest,
                                volToOiRatio: parseFloat(ratio.toFixed(2)),
                                impliedVolatility: opt.greeks?.impliedVolatility ? parseFloat((opt.greeks.impliedVolatility * 100).toFixed(1)) : 0,
                                bias: type === 'CALL' ? 'BULLISH' : 'BEARISH'
                            });
                        }
                    };
                    process(data.call, 'CALL');
                    process(data.put, 'PUT');
                }
            }
            if (unusual.length > 0) {
                console.log(`[OptionsFlow] Found ${unusual.length} unusual options`);
                return unusual.sort((a, b) => b.volume - a.volume);
            }
        }
    } catch (e) {
        console.error(`Options Scan failed for ${symbol}`, e);
    }

    // 2. Fallback to Yahoo Finance
    try {
        console.log(`[OptionsFlow] Falling back to Yahoo Finance for ${symbol}...`);
        const queryOptions = { lang: 'en-US', region: 'US' };
        const result = await yahooFinance.options(symbol, queryOptions);

        if (!result || !result.options || result.options.length === 0) return [];

        const unusual: UnusualOption[] = [];
        const expirationDates = (result as any).meta?.expirationDates;

        if (!expirationDates || expirationDates.length === 0) return [];

        const targetDates = expirationDates.slice(0, 3);

        for (const date of targetDates) {
            result.options[0].calls.forEach((c: any) => {
                if (isUnusual(c)) {
                    unusual.push(mapToUnusual(symbol, c, 'CALL', new Date(date * 1000)));
                }
            });

            result.options[0].puts.forEach((p: any) => {
                if (isUnusual(p)) {
                    unusual.push(mapToUnusual(symbol, p, 'PUT', new Date(date * 1000)));
                }
            });
        }

        return unusual.sort((a, b) => b.volume - a.volume);

    } catch (e) {
        console.error(`Unusual Options Scan failed for ${symbol}`, e);
        return [];
    }
}

function isUnusual(option: any): boolean {
    if (option.volume < 200) return false;
    if (option.openInterest > 0 && option.volume > option.openInterest) {
        return true;
    }
    return false;
}

function mapToUnusual(symbol: string, opt: any, type: 'CALL' | 'PUT', expiryDate: Date): UnusualOption {
    const formattedDate = expiryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const ratio = opt.openInterest > 0 ? (opt.volume / opt.openInterest) : opt.volume;

    return {
        symbol,
        type,
        strike: opt.strike,
        expiry: formattedDate,
        lastPrice: opt.lastPrice,
        volume: opt.volume,
        openInterest: opt.openInterest,
        volToOiRatio: parseFloat(ratio.toFixed(2)),
        impliedVolatility: parseFloat((opt.impliedVolatility * 100).toFixed(1)),
        bias: type === 'CALL' ? 'BULLISH' : 'BEARISH'
    };
}
