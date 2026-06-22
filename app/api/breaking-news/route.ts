import { NextResponse } from 'next/server';
import { finnhubClient } from '@/lib/finnhub';

export const dynamic = 'force-dynamic';

interface NewsCache {
    data: any[];
    timestamp: number;
}

declare global {
    var _breakingNewsCache: NewsCache | null;
}

if (!global._breakingNewsCache) {
    global._breakingNewsCache = null;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

export async function GET(request: Request) {
    const now = Date.now();

    // Check memory cache
    if (global._breakingNewsCache && (now - global._breakingNewsCache.timestamp < CACHE_TTL)) {
        return NextResponse.json({
            timestamp: new Date(global._breakingNewsCache.timestamp).toISOString(),
            data: global._breakingNewsCache.data
        });
    }

    try {
        console.log("📥 [API/Breaking-News] Fetching fresh general news from Finnhub");
        const rawNews = await finnhubClient.getGeneralNews('general');
        
        // Map and clean raw news
        const formattedNews = (rawNews || [])
            .filter((n: any) => n.headline && n.url)
            .map((n: any) => ({
                id: n.id,
                headline: n.headline,
                source: n.source,
                datetime: n.datetime * 1000, // convert seconds to ms
                url: n.url,
                summary: n.summary
            }))
            .slice(0, 10); // Return top 10 breaking news headlines

        // Update memory cache
        global._breakingNewsCache = {
            data: formattedNews,
            timestamp: now
        };

        return NextResponse.json({
            timestamp: new Date(now).toISOString(),
            data: formattedNews
        });
    } catch (error) {
        console.error("Breaking news API error:", error);
        // Fallback: serve stale cache if available
        if (global._breakingNewsCache) {
            console.log("⚠️ Serving stale breaking news cache due to API error");
            return NextResponse.json({
                timestamp: new Date(global._breakingNewsCache.timestamp).toISOString(),
                data: global._breakingNewsCache.data,
                stale: true
            });
        }
        return NextResponse.json({ error: "Failed to fetch breaking news" }, { status: 500 });
    }
}
