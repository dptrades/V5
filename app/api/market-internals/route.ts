import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

// Force dynamic mode for fresh data
export const dynamic = 'force-dynamic';

// Market internals symbols
const INTERNALS = ['^VIX', '^GSPC', '^IXIC', '^NDX', '^DJI', '^RUT'];

export async function GET() {
    try {
        const results = await Promise.all(
            INTERNALS.map(async (symbol) => {
                try {
                    const quote: any = await yahooFinance.quote(symbol);
                    return {
                        symbol,
                        name: quote.shortName || quote.longName || symbol,
                        price: quote.regularMarketPrice || 0,
                        change: quote.regularMarketChange || 0,
                        changePercent: quote.regularMarketChangePercent || 0,
                        previousClose: quote.regularMarketPreviousClose || 0,
                    };
                } catch (e) {
                    console.error(`Failed to fetch ${symbol}:`, e);
                    return {
                        symbol,
                        name: symbol,
                        price: 0,
                        change: 0,
                        changePercent: 0,
                        previousClose: 0,
                    };
                }
            })
        );

        // Extract VIX specifically
        const vix = results.find(r => r.symbol === '^VIX');
        const sp500 = results.find(r => r.symbol === '^GSPC');
        const nasdaq = results.find(r => r.symbol === '^IXIC');
        const ndx = results.find(r => r.symbol === '^NDX');
        const dow = results.find(r => r.symbol === '^DJI');
        const russell = results.find(r => r.symbol === '^RUT');

        return NextResponse.json({
            vix,
            sp500,
            nasdaq,
            ndx,
            dow,
            russell,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[Market Internals API] Error:', error);
        return NextResponse.json({ error: 'Failed to fetch market internals' }, { status: 500 });
    }
}
