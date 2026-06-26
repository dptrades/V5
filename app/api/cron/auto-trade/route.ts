import { NextResponse } from 'next/server';
import {
    updatePositionsAndExits,
    runSimulatedMorningScan,
    logDailyPerformance,
    sendDailySummary
} from '@/lib/paper-trading';

export const dynamic = 'force-dynamic';

/**
 * Cron endpoint for automated paper trading
 * Protected by Vercel cron secret
 */
export async function GET(request: Request) {
    if (process.env.VERCEL === '1') {
        return NextResponse.json({ error: 'Auto-trade is disabled in the Vercel production app' }, { status: 403 });
    }
    // Verify cron secret (Vercel sends this header)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // In production, verify the secret
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        if (process.env.NODE_ENV === 'production') {
            console.log('[Cron Paper-Trade] Unauthorized request');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'morning';

    console.log(`[Cron Paper-Trade] Starting scheduled action: ${action}...`);
    console.log('[Cron Paper-Trade] Time:', new Date().toISOString());

    try {
        if (action === 'morning') {
            // 1. First, check exits for any moves before scanning
            const { closedTrades } = await updatePositionsAndExits();
            
            // 2. Run morning scan to enter new positions
            const { enteredTrades } = await runSimulatedMorningScan();

            // 3. Send Daily Summary (Morning)
            await sendDailySummary('morning', { enteredTrades, closedTrades });

            return NextResponse.json({
                success: true,
                action: 'morning',
                enteredCount: enteredTrades.length,
                exitedCount: closedTrades.length,
                timestamp: new Date().toISOString()
            });

        } else if (action === 'close') {
            // 1. Process exits and update prices
            const { closedTrades } = await updatePositionsAndExits();

            // 2. Log daily snapshot of equity and cash
            const dailyLog = await logDailyPerformance();

            // 3. Send Close Summary
            await sendDailySummary('close', { closedTrades, dailyLog });

            return NextResponse.json({
                success: true,
                action: 'close',
                exitedCount: closedTrades.length,
                dailyLog,
                timestamp: new Date().toISOString()
            });
        } else {
            return NextResponse.json({ error: 'Invalid action. Use morning or close.' }, { status: 400 });
        }

    } catch (error) {
        console.error('[Cron Paper-Trade] Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}
