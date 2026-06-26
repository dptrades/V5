import { NextRequest, NextResponse } from 'next/server';
import { updateTrackedOptions, getTrackedOptions } from '@/lib/tracking';
import { publicClient } from '@/lib/public-api';
import { schwabClient } from '@/lib/schwab';
import { isMarketActive } from '@/lib/refresh-utils';

export async function GET(req: NextRequest) {
    try {
        const marketActive = isMarketActive();
        
        let quotesMap: Record<string, number> = {};
        let greeksMap: Record<string, any> = {};

        if (marketActive) {
            const tracked = getTrackedOptions();
            const activeOptions = tracked.filter(option => {
                const today = new Date().toISOString().split('T')[0];
                return option.status !== 'EXPIRED' && option.status !== 'CLOSED' && new Date(option.expiry) >= new Date(today);
            });

            if (activeOptions.length > 0) {
                // Collect unique tickers and option symbols
                const tickers = Array.from(new Set(activeOptions.map(o => o.ticker.trim())));
                const optionSymbols = Array.from(new Set(activeOptions.map(o => o.id.trim())));

                // 1. Batch fetch stock prices
                try {
                    const quotes = await publicClient.getQuotes(tickers);
                    quotes.forEach(q => {
                        if (q && q.symbol) {
                            quotesMap[q.symbol] = q.price;
                        }
                    });
                } catch (e) {
                    console.error('[API Update] Error batch fetching stock quotes:', e);
                }

                // 2. Batch fetch option premiums from Schwab
                if (schwabClient.isConfigured()) {
                    try {
                        greeksMap = await schwabClient.getGreeksBatch(optionSymbols);
                    } catch (e) {
                        console.error('[API Update] Error batch fetching Schwab Greeks:', e);
                    }
                }
            }
        }

        await updateTrackedOptions(async (option) => {
            // Bypass API fetches completely if market is closed
            if (!marketActive) {
                return null;
            }

            let premium = 0;
            let stockPrice = 0;

            const ticker = option.ticker.trim();
            const optionSymbol = option.id.trim();

            // 1. Resolve Stock Price
            stockPrice = quotesMap[ticker] || 0;
            if (stockPrice === 0) {
                // Fallback to single quote fetch if batch missed it
                const quote = await publicClient.getQuote(ticker);
                if (quote) stockPrice = quote.price;
            }

            // 2. Resolve Option Premium
            // Tier 1: Try pre-fetched Schwab Greeks
            if (greeksMap[optionSymbol] && greeksMap[optionSymbol].lastPrice > 0) {
                premium = greeksMap[optionSymbol].lastPrice;
            }

            // Tier 2: Single Schwab request fallback
            if (premium === 0 && schwabClient.isConfigured()) {
                try {
                    const greeks = await schwabClient.getGreeks(optionSymbol);
                    if (greeks && greeks.lastPrice > 0) {
                        premium = greeks.lastPrice;
                    }
                } catch (e) {
                    console.error(`Error falling back to Schwab single quotes for ${option.id}:`, e);
                }
            }

            // Tier 3: Public.com Chain Fallback
            if (premium === 0) {
                try {
                    const chain = await publicClient.getOptionChain(ticker, option.expiry);
                    if (chain && chain.options[option.expiry]) {
                        const strikeData = chain.options[option.expiry][option.strike];
                        if (strikeData) {
                            const opt = option.type === 'CALL' ? strikeData.call : strikeData.put;
                            if (opt) {
                                premium = (opt.bid + opt.ask) / 2 || opt.last;
                            }
                        }
                    }
                } catch (e) {
                    console.error(`Error fetching fallback premium for ${option.id}:`, e);
                }
            }

            if (premium > 0 && stockPrice > 0) {
                return { premium, stockPrice };
            }
            return null;
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error('[API Update] Error:', e);
        return NextResponse.json({ error: e.message || 'Failed to update tracking' }, { status: 500 });
    }
}
