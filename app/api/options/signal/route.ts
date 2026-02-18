import { NextResponse } from 'next/server';
import { generateOptionSignal } from '@/lib/options';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            currentPrice, atr, trend, rsi, ema50, indicators, symbol,
            fundamentalConfirmations, socialConfirmations, refresh
        } = body;

        if (currentPrice === undefined || atr === undefined || !trend) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const skipCache = refresh === true;

        const signal = await generateOptionSignal(
            currentPrice,
            atr,
            trend,
            rsi || 50,
            ema50,
            indicators,
            symbol,
            fundamentalConfirmations,
            socialConfirmations,
            skipCache
        );

        return NextResponse.json(signal, {
            headers: {
                'Cache-Control': 'no-store, max-age=0'
            }
        });
    } catch (error) {
        console.error('Options Signal Error:', error);
        return NextResponse.json({ error: 'Failed to generate option signal' }, { status: 500 });
    }
}
