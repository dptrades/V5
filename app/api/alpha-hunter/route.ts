import { NextResponse } from 'next/server';
import { scanAlphaHunter } from '@/lib/conviction';

// Force dynamic mode so it fetches live data
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const forceRefresh = searchParams.get('refresh') === 'true';

        const data = await scanAlphaHunter(forceRefresh);
        return NextResponse.json(data);
    } catch (error) {
        console.error("Error in Alpha Hunter API:", error);
        return NextResponse.json({ error: "Failed to fetch Alpha Hunter scores" }, { status: 500 });
    }
}
