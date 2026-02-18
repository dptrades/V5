import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { fetchLivePrice } from '@/lib/market-data';
import { publicClient } from '@/lib/public-api';

const yahooFinance = new YahooFinance();

// Force dynamic mode for fresh data
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
        return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    try {
        const ticker = symbol.toUpperCase();
        const marketSession = publicClient.getMarketSession();


        // 1. Use centralized waterfall (returns null if all sources fail)
        const liveResult = await fetchLivePrice(ticker);
        const price = liveResult?.price || 0;
        const source = liveResult?.source || 'unavailable';

        let regularMarketPrice = 0;
        let regularMarketChange = 0;
        let regularMarketChangePercent = 0;
        let postMarketPrice = 0;
        let postMarketChange = 0;
        let postMarketChangePercent = 0;
        let previousClose = 0;

        // 2. Metadata from Yahoo Finance
        try {
            const quote: any = await yahooFinance.quote(ticker);
            if (quote) {
                regularMarketPrice = quote.regularMarketPrice || 0;
                regularMarketChange = quote.regularMarketChange || 0;
                regularMarketChangePercent = quote.regularMarketChangePercent || 0;

                postMarketPrice = quote.postMarketPrice || quote.regularMarketPrice || 0;
                postMarketChange = quote.postMarketChange || 0;
                postMarketChangePercent = quote.postMarketChangePercent || 0;
                previousClose = quote.regularMarketPreviousClose || 0;
            }
        } catch (yahooError) {
            console.warn('[Live Price] Yahoo quote error:', yahooError);
        }

        // Final Calculations for Change
        const currentPrice = price || postMarketPrice || regularMarketPrice;
        const change = currentPrice - previousClose;
        const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

        if (!currentPrice) {
            return NextResponse.json({
                price: null,
                change: 0,
                changePercent: 0,
                source: 'unavailable',
                message: 'Data unavailable'
            });
        }

        return NextResponse.json({
            price: currentPrice,
            regularMarketPrice,
            postMarketPrice,
            change,
            changePercent,
            regularMarketChange,
            regularMarketChangePercent,
            postMarketChange,
            postMarketChangePercent,
            previousClose,
            marketSession,
            source,
            timestamp: new Date().toISOString()
        }, {
            headers: {
                'Cache-Control': 'no-store, max-age=0, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
    } catch (error) {
        console.error('[Live Price API] Error:', error);
        return NextResponse.json({
            error: 'Failed to fetch live price',
            price: null,
            change: 0,
            changePercent: 0
        }, { status: 500 });
    }
}
