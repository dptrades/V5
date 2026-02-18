import { NextRequest, NextResponse } from 'next/server';
import { trackOption } from '@/lib/tracking';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { option, companyName, underlyingPrice } = body;

        if (!option) {
            return NextResponse.json({ error: 'Option data required' }, { status: 400 });
        }

        const tracked = trackOption(option, companyName, underlyingPrice);
        return NextResponse.json({ success: true, tracked });
    } catch (e: any) {
        console.error('[API Tracking] Error:', e);
        return NextResponse.json({ error: e.message || 'Failed to track option' }, { status: 500 });
    }
}
