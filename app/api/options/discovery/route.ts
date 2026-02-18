import { NextResponse } from 'next/server';
import { findTopOptions } from '@/lib/options';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const price = parseFloat(searchParams.get('price') || '0');
    const trend = searchParams.get('trend') as 'bullish' | 'bearish' | 'neutral';
    const rsi = parseFloat(searchParams.get('rsi') || '50');
    const skipCache = searchParams.get('refresh') === 'true';

    if (!symbol) {
        return NextResponse.json({ error: 'Missing symbol parameter' }, { status: 400 });
    }

    // Default values if missing
    const finalPrice = price || 0;
    const finalTrend = (trend || 'neutral') as 'bullish' | 'bearish' | 'neutral';

    console.log(`[API Discovery] Symbol: ${symbol}, Price: ${finalPrice}, Trend: ${finalTrend}, RSI: ${rsi}, Refresh: ${skipCache}`);

    try {
        const topOptions = await findTopOptions(symbol, finalPrice, finalTrend, rsi, skipCache);
        console.log(`[API Discovery] Found ${topOptions.length} candidates`);
        return NextResponse.json(topOptions, {
            headers: {
                'Cache-Control': 'no-store, max-age=0'
            }
        });
    } catch (error) {
        console.error('Options Discovery Error:', error);
        return NextResponse.json({ error: 'Failed to fetch options discovery' }, { status: 500 });
    }
}
