import { NextRequest, NextResponse } from 'next/server';
import { getTrackedOptions } from '@/lib/tracking';

export async function GET(req: NextRequest) {
    try {
        const tracked = getTrackedOptions();
        return NextResponse.json(tracked);
    } catch (e: any) {
        console.error('[API Tracked] Error:', e);
        return NextResponse.json({ error: 'Failed to fetch tracked options' }, { status: 500 });
    }
}
