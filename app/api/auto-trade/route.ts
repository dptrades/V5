import { NextResponse, NextRequest } from 'next/server';
import {
    loadPaperPortfolio,
    updatePositionsAndExits,
    runSimulatedMorningScan,
    executeSimulatedManualTrade,
    PaperPortfolio
} from '@/lib/paper-trading';

export const dynamic = 'force-dynamic';

/**
 * GET: Returns simulated portfolio status
 */
export async function GET() {
    try {
        // Automatically check if stop-loss or profit-target is hit on reload/fetch
        await updatePositionsAndExits();
        
        const portfolio = loadPaperPortfolio();

        return NextResponse.json({
            account: {
                equity: portfolio.account.equity,
                buyingPower: portfolio.account.cash,
                cash: portfolio.account.cash,
                portfolioValue: portfolio.account.equity
            },
            positions: portfolio.positions.map(p => ({
                symbol: p.symbol,
                qty: p.qty,
                avgPrice: p.entryPrice,
                currentPrice: p.currentPrice,
                marketValue: p.qty * p.currentPrice,
                unrealizedPL: p.qty * (p.currentPrice - p.entryPrice),
                unrealizedPLPercent: ((p.currentPrice - p.entryPrice) / p.entryPrice) * 100
            })),
            recentOrders: portfolio.history.map(h => ({
                id: h.id,
                symbol: h.symbol,
                side: h.side,
                qty: h.qty,
                status: h.status === 'filled' ? 'filled' : h.status.startsWith('closed') ? 'filled' : 'submitted',
                filledPrice: h.status.startsWith('closed') ? h.exitPrice : h.entryPrice,
                createdAt: h.createdAt
            })).reverse() // Show newest orders first
        });
    } catch (error) {
        console.error('[Auto-Trade API] GET Error:', error);
        return NextResponse.json({ error: 'Failed to fetch simulated portfolio' }, { status: 500 });
    }
}

/**
 * POST: Triggers automated simulated trades OR manual override orders
 */
export async function POST(request: Request) {
    try {
        let body: any = {};
        try {
            body = await request.json();
        } catch (e) {
            // No body provided, default to automated scan
        }

        // Action routing
        if (body.action === 'manual') {
            const { symbol, qty, stopLoss, targetProfit } = body;
            if (!symbol || !qty || qty <= 0) {
                return NextResponse.json({ error: 'Invalid manual order parameters' }, { status: 400 });
            }

            const result = await executeSimulatedManualTrade({
                symbol,
                qty,
                stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
                targetProfit: targetProfit ? parseFloat(targetProfit) : undefined
            });

            if (!result.success) {
                return NextResponse.json({ error: result.error || 'Manual execution failed' }, { status: 400 });
            }

            return NextResponse.json({
                success: true,
                message: `Simulated order placed for ${symbol}`,
                order: result.order
            });
        }

        // Default: Automated daily/morning execution
        console.log('[Auto-Trade API] Running simulated morning scan and execution...');
        await updatePositionsAndExits();
        const { enteredTrades } = await runSimulatedMorningScan();

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            trades: enteredTrades.map(t => ({
                symbol: t.symbol,
                status: 'submitted',
                qty: t.qty,
                estimatedCost: t.qty * t.entryPrice,
                stopLoss: `$${t.stopLoss.toFixed(2)}`,
                takeProfit: `$${t.targetProfit.toFixed(2)}`
            })),
            summary: {
                attempted: enteredTrades.length,
                submitted: enteredTrades.length,
                skipped: 0,
                failed: 0
            }
        });

    } catch (error) {
        console.error('[Auto-Trade API] POST Error:', error);
        return NextResponse.json({
            error: 'Failed to execute simulated trades',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
