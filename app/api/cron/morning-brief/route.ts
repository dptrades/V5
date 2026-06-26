import { NextResponse } from 'next/server';
import { scanConviction, scanAlphaHunter } from '@/lib/conviction';
import { sendMorningBriefAlert } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        // Allow local testing if bypassing secret
        if (process.env.NODE_ENV === 'production') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    console.log('[Morning Brief] Starting compilation of morning scan...');

    try {
        const startTime = Date.now();

        // 1. Run all three scans concurrently, forcing a refresh to get the absolute newest data
        const [topPicks, alphaHunter] = await Promise.all([
            scanConviction(true),
            scanAlphaHunter(true)
        ]);

        // 2. Extract Top 5 from each strategy
        const curatedTopPicks = topPicks.slice(0, 5).map(s => ({
            symbol: s.symbol,
            signal: s.reasons.find(r => r.startsWith('🎯 Option Setup')) || s.metrics.trend || 'Buy',
            score: s.score,
            change: s.change24h || 0
        }));

        const curatedAlphaHunter = alphaHunter.slice(0, 5).map(s => ({
            symbol: s.symbol,
            signal: s.reasons.find(r => r.startsWith('🔍')) || s.metrics.trend || 'Momentum Buy',
            score: s.score,
            change: s.change24h || 0
        }));

        // 3. Send email!
        const emailSuccess = await sendMorningBriefAlert({
            topPicks: curatedTopPicks,
            alphaHunter: curatedAlphaHunter
        });

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[Morning Brief] Complete in ${elapsed}s. Email Sent: ${emailSuccess}`);

        return NextResponse.json({
            success: true,
            emailSent: emailSuccess,
            topPicksCount: curatedTopPicks.length,
            alphaHunterCount: curatedAlphaHunter.length,
            elapsed: `${elapsed}s`
        });

    } catch (e) {
        console.error('[Morning Brief] Error:', e);
        return NextResponse.json({ error: 'Morning brief failed' }, { status: 500 });
    }
}
