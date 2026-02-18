import { NextResponse } from 'next/server';
import {
    getAccount,
    getPositions,
    submitBracketOrder,
    getLatestPrice,
    isMarketOpen
} from '@/lib/alpaca-trading';
import { scanAlphaHunter } from '@/lib/conviction';
import type { ConvictionStock } from '@/types/stock';

// Symbols to exclude (indices, futures, commodities, ETFs)
const EXCLUDED_SYMBOLS = [
    'SPY', 'QQQ', 'DIA', 'IWM', 'VTI', 'VOO',
    'GLD', 'SLV', 'USO', 'UNG', 'CORN', 'WEAT',
    'VXX', 'UVXY', 'SVXY', 'VIXY',
    'TLT', 'IEF', 'AGG', 'BND',
    'SQQQ', 'TQQQ', 'SPXU', 'SPXL', 'SOXL', 'SOXS'
];

// Trade parameters
const TRADE_AMOUNT = 250; // $250 per trade
const STOP_LOSS_PERCENT = 0.10;
const TAKE_PROFIT_PERCENT = 0.25;
const MAX_POSITIONS = 4; // Max 4 positions ($1000 total limit)

/**
 * Cron endpoint for automated trading
 * Protected by Vercel cron secret
 */
export async function GET(request: Request) {
    // Verify cron secret (Vercel sends this header)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // In production, verify the secret
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        console.log('[Cron] Unauthorized request');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Cron Auto-Trade] Starting scheduled trade execution...');
    console.log('[Cron Auto-Trade] Time:', new Date().toISOString());

    if (process.env.DISABLE_AUTO_TRADE === 'true') {
        console.log('[Cron Auto-Trade] Auto-trade is disabled via environment variable');
        return NextResponse.json({
            success: false,
            message: 'Auto-trade is currently disabled',
            timestamp: new Date().toISOString()
        });
    }

    try {
        // Check if market is open
        const marketOpen = await isMarketOpen();
        if (!marketOpen) {
            console.log('[Cron Auto-Trade] Market is closed, skipping');
            return NextResponse.json({
                success: false,
                message: 'Market is closed',
                timestamp: new Date().toISOString()
            });
        }

        // Get account and positions
        const [account, currentPositions] = await Promise.all([
            getAccount(),
            getPositions()
        ]);

        if (!account) {
            console.error('[Cron Auto-Trade] Failed to get account');
            return NextResponse.json({ error: 'Failed to connect to Alpaca' }, { status: 500 });
        }

        const buyingPower = parseFloat(account.buying_power);
        const currentSymbols = currentPositions.map(p => p.symbol);
        const openPositionCount = currentPositions.length;

        console.log(`[Cron Auto-Trade] Current positions: ${openPositionCount}/${MAX_POSITIONS}`);
        console.log(`[Cron Auto-Trade] Buying power: $${buyingPower.toFixed(2)}`);

        if (openPositionCount >= MAX_POSITIONS) {
            return NextResponse.json({
                success: true,
                message: 'Maximum positions reached',
                currentPositions: openPositionCount
            });
        }

        // Fetch Alpha Hunter scanner results directly
        console.log('[Cron Auto-Trade] Scanning for Alpha Hunter picks...');
        const convictionData: ConvictionStock[] = await scanAlphaHunter();

        // Filter and sort picks
        const eligiblePicks = convictionData
            .filter(pick => {
                if (EXCLUDED_SYMBOLS.includes(pick.symbol)) return false;
                if (currentSymbols.includes(pick.symbol)) return false;
                // Only bullish trend signals
                if (pick.metrics?.trend !== 'BULLISH') return false;
                // Prefer high score picks
                if (pick.score < 50) return false;
                return true;
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, MAX_POSITIONS - openPositionCount);

        console.log(`[Cron Auto-Trade] Eligible picks: ${eligiblePicks.map(p => p.symbol).join(', ')}`);

        if (eligiblePicks.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No eligible picks found',
                timestamp: new Date().toISOString()
            });
        }

        // Execute trades
        const tradeResults = [];

        for (const pick of eligiblePicks) {
            if (buyingPower < TRADE_AMOUNT) {
                tradeResults.push({
                    symbol: pick.symbol,
                    status: 'skipped',
                    reason: 'Insufficient buying power'
                });
                continue;
            }

            const price = await getLatestPrice(pick.symbol);
            if (!price) {
                tradeResults.push({
                    symbol: pick.symbol,
                    status: 'skipped',
                    reason: 'Could not get price'
                });
                continue;
            }

            const qty = Math.floor(TRADE_AMOUNT / price);
            if (qty <= 0) {
                tradeResults.push({
                    symbol: pick.symbol,
                    status: 'skipped',
                    reason: `Price too high ($${price})`
                });
                continue;
            }

            const order = await submitBracketOrder({
                symbol: pick.symbol,
                qty: qty,
                stopLossPercent: STOP_LOSS_PERCENT,
                takeProfitPercent: TAKE_PROFIT_PERCENT
            });

            if (order) {
                tradeResults.push({
                    symbol: pick.symbol,
                    status: 'submitted',
                    orderId: order.id,
                    qty: qty,
                    estimatedCost: qty * price
                });
            } else {
                tradeResults.push({
                    symbol: pick.symbol,
                    status: 'failed',
                    reason: 'Order submission failed'
                });
            }
        }

        // Send email notification for executed trades
        if (tradeResults.length > 0) {
            const executedTrades = tradeResults.filter(t => t.status === 'submitted');

            if (executedTrades.length > 0) {
                const { sendEmailAlert } = await import('@/lib/notifications');

                await sendEmailAlert({
                    subject: `🤖 Auto-Trade: Executed ${executedTrades.length} Trades`,
                    message: `Daily auto-trade cycle completed. Executed ${executedTrades.length} trades based on conviction scan.`,
                    stocks: executedTrades.map(t => ({
                        symbol: t.symbol,
                        signal: 'BUY',
                        strength: 100
                    }))
                });
            }
        }

        console.log('[Cron Auto-Trade] Completed:', tradeResults);

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            trades: tradeResults,
            summary: {
                attempted: eligiblePicks.length,
                submitted: tradeResults.filter(t => t.status === 'submitted').length,
                skipped: tradeResults.filter(t => t.status === 'skipped').length,
                failed: tradeResults.filter(t => t.status === 'failed').length
            }
        });

    } catch (error) {
        console.error('[Cron Auto-Trade] Error:', error);
        return NextResponse.json({
            error: 'Cron execution failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
