import { NextRequest, NextResponse } from 'next/server';
import { updateTrackedOptions } from '@/lib/tracking';
import { publicClient } from '@/lib/public-api';
import { schwabClient } from '@/lib/schwab';

export async function GET(req: NextRequest) {
    try {
        await updateTrackedOptions(async (ticker, optionSymbol) => {
            let premium = 0;
            let stockPrice = 0;

            // 1. Get Stock Price
            const quote = await publicClient.getQuote(ticker);
            if (quote) stockPrice = quote.price;

            // 2. Get Option Premium
            // We use the same priority as in options.ts: Schwab -> Public
            try {
                if (schwabClient.isConfigured()) {
                    const greeks = await schwabClient.getGreeks(optionSymbol);
                    if (greeks) {
                        // If we can't get bid/ask easily, we'll try to find it in the chain or use last
                        // For simplicity in update, we'll try to fetch the specific option quote if available
                        // But Schwab getGreeks doesn't give price. 
                        // Let's use publicClient.getOptionChain as a reliable way to get current mid price
                    }
                }

                // Fallback to Public.com chain to get the mid price
                const expiryMatch = optionSymbol.match(/[A-Z]+(\d{6})[CP]/);
                if (expiryMatch) {
                    const rawExp = expiryMatch[1];
                    const year = '20' + rawExp.substring(0, 2);
                    const month = rawExp.substring(2, 4);
                    const day = rawExp.substring(4, 6);
                    const expiry = `${year}-${month}-${day}`;

                    const chain = await publicClient.getOptionChain(ticker, expiry);
                    if (chain && chain.options[expiry]) {
                        for (const strike in chain.options[expiry]) {
                            const data = chain.options[expiry][strike];
                            const opt = data.call?.symbol === optionSymbol ? data.call : (data.put?.symbol === optionSymbol ? data.put : null);
                            if (opt) {
                                premium = (opt.bid + opt.ask) / 2 || opt.last;
                                break;
                            }
                        }
                    }
                }
            } catch (e) {
                console.error(`Error fetching latest premium for ${optionSymbol}:`, e);
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
