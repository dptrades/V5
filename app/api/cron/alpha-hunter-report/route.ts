import { NextResponse } from 'next/server';
import { scanAlphaHunter } from '@/lib/conviction';
import { sendEmailAlert } from '@/lib/notifications';

/**
 * Alpha Hunter Daily Report Cron
 * Runs at 9:35 AM ET to send the top 25 picks to the configured email list.
 */
export async function GET(request: Request) {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        console.log('[Alpha Hunter Report] Unauthorized');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Alpha Hunter Report] Starting daily report generation...');
    console.log('[Alpha Hunter Report] Time:', new Date().toISOString());

    try {
        // Run full Alpha Hunter scan (force refresh to get latest data)
        const picks = await scanAlphaHunter(true);

        // Take top 25
        const top25 = picks.slice(0, 25);

        if (top25.length === 0) {
            console.log('[Alpha Hunter Report] No picks found, skipping email');
            return NextResponse.json({ success: true, message: 'No picks found' });
        }

        // Send Email
        const emailSuccess = await sendEmailAlert({
            subject: `🚀 Alpha Hunter: Top ${top25.length} Picks for Today`,
            message: `Good morning! Here are the high-conviction Alpha Hunter picks for ${new Date().toLocaleDateString()}. These stocks show the strongest technical and institutional signals.`,
            stocks: top25.map(p => ({
                symbol: p.symbol,
                signal: p.metrics?.trend || 'NEUTRAL',
                strength: p.score
            }))
        });

        console.log('[Alpha Hunter Report] Email status:', emailSuccess ? 'Sent' : 'Failed');

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            count: top25.length,
            emailSent: emailSuccess,
            picks: top25.map(p => ({
                symbol: p.symbol,
                score: p.score,
                trend: p.metrics?.trend
            }))
        });

    } catch (error) {
        console.error('[Alpha Hunter Report] Error:', error);
        return NextResponse.json({
            error: 'Report generation failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
