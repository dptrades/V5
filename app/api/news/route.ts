import { NextResponse } from 'next/server';
import { getNewsData } from '@/lib/news-service';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const type = (searchParams.get('type') || 'news') as 'news' | 'social' | 'analyst';

    if (!symbol) {
        return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    const data = await getNewsData(symbol, type);
    return NextResponse.json(data);
}
