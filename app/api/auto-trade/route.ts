import { NextResponse } from 'next/server';
import {
    getAccount,
    getPositions,
    getOrders,
    submitBracketOrder,
    getLatestPrice,
    isMarketOpen
} from '@/lib/alpaca-trading';
import { scanAlphaHunter } from '@/lib/conviction';
import type { ConvictionStock } from '@/types/stock';

// Symbols to exclude (indices, futures, commodities, ETFs tracking these)
const EXCLUDED_SYMBOLS = [
    // Indices
    'SPY', 'QQQ', 'DIA', 'IWM', 'VTI', 'VOO',
    // Commodities
    'GLD', 'SLV', 'USO', 'UNG', 'CORN', 'WEAT',
    // Futures/Volatility
    'VXX', 'UVXY', 'SVXY', 'VIXY',
    // Bonds
    'TLT', 'IEF', 'AGG', 'BND',
    // Inverse/Leveraged
    'SQQQ', 'TQQQ', 'SPXU', 'SPXL', 'SOXL', 'SOXS'
];

// Trade parameters
const TRADE_AMOUNT = 250; // $250 per trade
const STOP_LOSS_PERCENT = 0.10; // 10% stop loss
const TAKE_PROFIT_PERCENT = 0.25; // 25% take profit
const MAX_POSITIONS = 4; // Max 4 positions ($1000 total limit)

/**
 * GET: Returns current portfolio status
 */
export async function GET() {
    try {
        const [account, positions, orders] = await Promise.all([
            getAccount(),
            getPositions(),
            getOrders('all', 20)
        ]);

        if (!account) {
            return NextResponse.json({
                error: 'Failed to connect to Alpaca. Check API keys.'
            }, { status: 500 });
        }

        return NextResponse.json({
            account: {
                equity: parseFloat(account.equity),
                buyingPower: parseFloat(account.buying_power),
                cash: parseFloat(account.cash),
                portfolioValue: parseFloat(account.portfolio_value)
            },
            positions: positions.map(p => ({
                symbol: p.symbol,
                qty: parseFloat(p.qty),
                avgPrice: parseFloat(p.avg_entry_price),
                currentPrice: parseFloat(p.current_price),
                marketValue: parseFloat(p.market_value),
                unrealizedPL: parseFloat(p.unrealized_pl),
                unrealizedPLPercent: parseFloat(p.unrealized_plpc) * 100
            })),
            recentOrders: orders.slice(0, 10).map(o => ({
                id: o.id,
                symbol: o.symbol,
                side: o.side,
                qty: parseFloat(o.qty),
                status: o.status,
                filledPrice: o.filled_avg_price ? parseFloat(o.filled_avg_price) : null,
                createdAt: o.created_at
            }))
        });
    } catch (error) {
        console.error('[Auto-Trade] GET Error:', error);
        return NextResponse.json({ error: 'Failed to fetch portfolio' }, { status: 500 });
    }
}

/**
 * POST: Execute trades for top picks
 */
export async function POST(request: Request) {
    if (process.env.DISABLE_AUTO_TRADE === 'true') {
        return NextResponse.json({
            error: 'Auto-trade is currently disabled',
            timestamp: new Date().toISOString()
        }, { status: 403 });
    }
    try {
        // Check if market is open
        const marketOpen = await isMarketOpen();
        if (!marketOpen) {
            return NextResponse.json({
                error: 'Market is closed. Trades can only execute during market hours.',
                marketOpen: false
            }, { status: 400 });
        }

        // Get account and current positions
        const [account, currentPositions] = await Promise.all([
            getAccount(),
            getPositions()
        ]);

        if (!account) {
            return NextResponse.json({
                error: 'Failed to connect to Alpaca'
            }, { status: 500 });
        }

        const buyingPower = parseFloat(account.buying_power);
        const currentSymbols = currentPositions.map(p => p.symbol);
        const openPositionCount = currentPositions.length;

        console.log(`[Auto-Trade] Current positions: ${openPositionCount}/${MAX_POSITIONS}`);
        console.log(`[Auto-Trade] Buying power: $${buyingPower.toFixed(2)}`);

        // Check if we have room for more positions
        if (openPositionCount >= MAX_POSITIONS) {
            return NextResponse.json({
                message: 'Maximum positions reached',
                currentPositions: openPositionCount,
                maxPositions: MAX_POSITIONS
            });
        }

        // Fetch Alpha Hunter scanner results directly
        console.log('[Auto-Trade] Scanning for Alpha Hunter picks...');
        const convictionData: ConvictionStock[] = await scanAlphaHunter();

        // Filter and sort picks
        const eligiblePicks = convictionData
            .filter(pick => {
                // Exclude indices, futures, commodities
                if (EXCLUDED_SYMBOLS.includes(pick.symbol)) return false;
                // Exclude already held positions
                if (currentSymbols.includes(pick.symbol)) return false;
                // Only bullish trend signals
                if (pick.metrics?.trend !== 'BULLISH') return false;
                // Prefer high score picks
                if (pick.score < 50) return false;
                return true;
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, MAX_POSITIONS - openPositionCount);

        console.log(`[Auto-Trade] Eligible picks: ${eligiblePicks.map(p => p.symbol).join(', ')}`);

        if (eligiblePicks.length === 0) {
            return NextResponse.json({
                message: 'No eligible picks found',
                filters: 'Excluded indices, commodities, existing positions, and non-bullish trends'
            });
        }

        // Execute trades
        const tradeResults = [];

        for (const pick of eligiblePicks) {
            // Check buying power
            if (buyingPower < TRADE_AMOUNT) {
                console.log(`[Auto-Trade] Insufficient buying power for ${pick.symbol}`);
                tradeResults.push({
                    symbol: pick.symbol,
                    status: 'skipped',
                    reason: 'Insufficient buying power'
                });
                continue;
            }

            // Get current price
            const price = await getLatestPrice(pick.symbol);
            if (!price) {
                tradeResults.push({
                    symbol: pick.symbol,
                    status: 'skipped',
                    reason: 'Could not get price'
                });
                continue;
            }

            // Calculate quantity (whole shares only)
            const qty = Math.floor(TRADE_AMOUNT / price);
            if (qty <= 0) {
                tradeResults.push({
                    symbol: pick.symbol,
                    status: 'skipped',
                    reason: 'Price too high'
                });
                continue;
            }

            // Submit bracket order
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
                    estimatedCost: qty * price,
                    stopLoss: `${STOP_LOSS_PERCENT * 100}%`,
                    takeProfit: `${TAKE_PROFIT_PERCENT * 100}%`
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
                    subject: `🚀 Executed ${executedTrades.length} Trades (Manual Trigger)`,
                    message: `Successfully executed ${executedTrades.length} trades based on conviction scan.`,
                    stocks: executedTrades.map(t => ({
                        symbol: t.symbol,
                        signal: 'BUY',
                        strength: 100
                    }))
                });
            }
        }

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
        console.error('[Auto-Trade] POST Error:', error);
        return NextResponse.json({
            error: 'Failed to execute trades',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
