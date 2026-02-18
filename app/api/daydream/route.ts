import { NextResponse } from 'next/server';
import { getDayDreamPicks, DayDreamPick } from '@/lib/daydream';
import { isMarketActive } from '@/lib/refresh-utils';

export const dynamic = 'force-dynamic';

// Server-side cache (5 min TTL) — prevents ~45 API calls per uncached request
interface DayDreamCache {
    data: DayDreamPick[];
    timestamp: number;
}

declare global {
    var _dayDreamCache: DayDreamCache | null;
}

if (!global._dayDreamCache) {
    global._dayDreamCache = null;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET() {
    console.log("🚀 [API/DayDream] GET request received");
    try {
        // Serve from cache if fresh
        if (global._dayDreamCache && (Date.now() - global._dayDreamCache.timestamp) < CACHE_TTL) {
            // During OFF hours, always serve cache (don't re-compute)
            if (!isMarketActive() || (Date.now() - global._dayDreamCache.timestamp) < CACHE_TTL) {
                console.log(`⚡ [API/DayDream] Serving ${global._dayDreamCache.data.length} picks from cache (age: ${Math.round((Date.now() - global._dayDreamCache.timestamp) / 1000)}s)`);
                return NextResponse.json(global._dayDreamCache.data);
            }
        }

        const picks = await getDayDreamPicks();
        console.log(`✅ [API/DayDream] Returning ${picks.length} picks (fresh)`);

        // Update cache
        global._dayDreamCache = { data: picks, timestamp: Date.now() };

        return NextResponse.json(picks);
    } catch (error: any) {
        console.error("❌ [API/DayDream] Error:", error.message || error);
        // If we have stale cache, serve it on error
        if (global._dayDreamCache) {
            console.warn("⚠️ [API/DayDream] Serving stale cache due to error");
            return NextResponse.json(global._dayDreamCache.data);
        }
        return NextResponse.json({ error: "Failed to fetch DayDream picks", details: error.message }, { status: 500 });
    }
}
