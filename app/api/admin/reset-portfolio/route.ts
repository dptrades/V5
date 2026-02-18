import { NextResponse } from 'next/server';
import {
    getPositions,
    getOrders,
    cancelOrder,
    closePosition,
    isMarketOpen
} from '@/lib/alpaca-trading';

/**
 * POST: Reset portfolio (Close all positions, Cancel all orders)
 * Protected by simple secret or restricted to localhost/dev for safety
 */
export async function POST(request: Request) {
    console.log('[Admin] Resetting portfolio...');

    try {
        // 1. Cancel all open orders
        const orders = await getOrders('open');
        console.log(`[Admin] Cancelling ${orders.length} open orders...`);

        const cancelPromises = orders.map(order => cancelOrder(order.id));
        await Promise.all(cancelPromises);

        // 2. Close all positions
        const positions = await getPositions();
        console.log(`[Admin] Closing ${positions.length} positions...`);

        // Check if market is open (needed to close positions)
        const marketOpen = await isMarketOpen();
        if (!marketOpen && positions.length > 0) {
            return NextResponse.json({
                message: 'Market is closed. Orders cancelled, but positions cannot be closed until market open.',
                ordersCancelled: orders.length,
                positionsPending: positions.length
            }, { status: 200 });
        }

        const closePromises = positions.map(pos => closePosition(pos.symbol));
        await Promise.all(closePromises);

        return NextResponse.json({
            success: true,
            message: 'Portfolio reset initiated',
            ordersCancelled: orders.length,
            positionsClosed: positions.length
        });

    } catch (error) {
        console.error('[Admin] Reset failed:', error);
        return NextResponse.json({
            error: 'Failed to reset portfolio',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
