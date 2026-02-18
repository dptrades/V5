import { NextResponse } from 'next/server';
import { runSmartScan, DiscoveredStock } from '@/lib/smart-scanner';
import { sendAlerts } from '@/lib/notifications';

/**
 * Pre-Market Daily Scan
 * Runs at 9:00 AM ET to discover high-potential stocks before market open
 */

// In-memory cache for discoveries (refreshed daily)
let cachedDiscoveries: DiscoveredStock[] = [];
let lastScanTime: Date | null = null;

export async function GET(request: Request) {
    // Verify cron secret (Vercel sends this header)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // In production, verify the secret
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        console.log('[Daily Scan] Unauthorized request');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Daily Scan] Starting pre-market scan...');
    console.log('[Daily Scan] Time:', new Date().toISOString());

    try {
        const startTime = Date.now();

        // Run smart scanner
        const discoveries = await runSmartScan();

        // Cache results
        cachedDiscoveries = discoveries;
        lastScanTime = new Date();

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        // Summarize by source
        const bySource = {
            volume: discoveries.filter(d => d.source === 'volume').length,
            social: discoveries.filter(d => d.source === 'social').length,
            news: discoveries.filter(d => d.source === 'news').length,
            technical: discoveries.filter(d => d.source === 'technical').length,
            options: discoveries.filter(d => d.source === 'options').length
        };

        console.log('[Daily Scan] Complete!');
        console.log(`[Daily Scan] Found ${discoveries.length} stocks in ${elapsed}s`);
        console.log('[Daily Scan] By source:', bySource);

        // Send email and SMS alerts
        if (discoveries.length > 0) {
            const topDiscoveries = discoveries.slice(0, 10);
            const alertResult = await sendAlerts({
                subject: `🎯 ${discoveries.length} Stocks Found - Pre-Market Scan`,
                message: `Good morning! Today's pre-market scan discovered ${discoveries.length} high-potential stocks with unusual activity.`,
                stocks: topDiscoveries.map(d => ({
                    symbol: d.symbol,
                    signal: d.signal,
                    strength: d.strength
                }))
            });
            console.log('[Daily Scan] Notifications sent:', alertResult);
        }

        // Return top discoveries
        return NextResponse.json({
            success: true,
            timestamp: lastScanTime.toISOString(),
            elapsed: `${elapsed}s`,
            totalDiscovered: discoveries.length,
            bySource,
            topDiscoveries: discoveries.slice(0, 15).map(d => ({
                symbol: d.symbol,
                source: d.source,
                signal: d.signal,
                strength: d.strength
            }))
        });

    } catch (error) {
        console.error('[Daily Scan] Error:', error);
        return NextResponse.json({
            error: 'Daily scan failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

// Export cached data for other endpoints
export function getCachedDiscoveries(): { discoveries: DiscoveredStock[], lastScan: Date | null } {
    return {
        discoveries: cachedDiscoveries,
        lastScan: lastScanTime
    };
}
