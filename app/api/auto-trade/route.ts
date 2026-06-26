import { NextResponse } from 'next/server';
import {
    getAccount,
    getPositions,
    getOrders,
    submitBracketOrder,
    getLatestPrice,
    isMarketOpen
} from '@/lib/alpaca-trading';
import { scanConviction, scanAlphaHunter } from '@/lib/conviction';
import { getEarningsInfo } from '@/lib/options';
import {
    MIN_TECHNICAL_SCORE,
    MIN_ANALYST_SCORE,
    MAX_STOCKS_PER_SECTOR,
    CONVICTION_SCORE_THRESHOLD,
    LIVE_TRADE_RISK_PER_TRADE,
    LIVE_TRADE_MAX_NOTIONAL,
    LIVE_PORTFOLIO_SECTOR_CAP,
    getSectorMap
} from '@/lib/constants';
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
const MAX_POSITIONS = 4; // Max 4 positions ($1000 total limit)
const EARNINGS_BLACKOUT_DAYS = 7; // Don't open a fresh position within 7 days of an earnings print

// Sizing/stop/sector-cap constants (LIVE_TRADE_RISK_PER_TRADE, LIVE_TRADE_MAX_NOTIONAL,
// LIVE_PORTFOLIO_SECTOR_CAP) now live in lib/constants.ts — audit fix #2 replaced the
// old flat $250/-10%/+25% sizing with ATR-anchored risk-based sizing (see the trade
// loop below) and added a held-position sector cap on top of the candidate-pool cap.

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

        // Portfolio-level sector cap (audit fix #2): count sectors of CURRENTLY
        // HELD positions, not just the candidate pool. scanConviction/scanAlphaHunter
        // already cap the candidate pool at MAX_STOCKS_PER_SECTOR (6) — this is a
        // tighter cap (LIVE_PORTFOLIO_SECTOR_CAP, default 2) on the actual live book,
        // so 4 positions can't legally end up 3-4 deep in one sector.
        const sectorMap = await getSectorMap();
        const sectorPositionCounts: Record<string, number> = {};
        for (const p of currentPositions) {
            const sector = sectorMap[p.symbol] || 'Other';
            sectorPositionCounts[sector] = (sectorPositionCounts[sector] || 0) + 1;
        }

        // Check if we have room for more positions
        if (openPositionCount >= MAX_POSITIONS) {
            return NextResponse.json({
                message: 'Maximum positions reached',
                currentPositions: openPositionCount,
                maxPositions: MAX_POSITIONS
            });
        }

        // Fetch BOTH scanners' full ungated universes and merge. Audit fix #1
        // (CODE_AUDIT_AND_IMPROVEMENTS.md) flagged that scanAlphaHunter() has no
        // quality gate and no sector cap, unlike scanConviction() ("Top Picks",
        // technicalScore>=50 AND analystScore>=50, max per-sector cap). Per
        // follow-up direction, auto-trade now draws candidates from both
        // scanners' watchlists/discoveries, but applies ONE consistent gate and
        // sector cap to every candidate regardless of which scanner surfaced
        // it — so Alpha Hunter's broader net widens the opportunity set without
        // bypassing the safety gate Top Picks enforces.
        console.log('[Auto-Trade] Scanning Top Picks + Alpha Hunter (merged, gated)...');
        const [rawConviction, rawAlpha] = await Promise.all([
            scanConviction(false, true),  // returnAll=true: full ungated universe
            scanAlphaHunter(false, true)
        ]);

        // Merge by symbol. Top Picks' record wins on collision — Alpha Hunter's
        // Yahoo request omits the earningsTrend module (audit finding #6/#4
        // area), so its analyst score is less complete when the same symbol is
        // covered by both.
        const mergedBySymbol = new Map<string, ConvictionStock>();
        for (const pick of rawAlpha) mergedBySymbol.set(pick.symbol, pick);
        for (const pick of rawConviction) mergedBySymbol.set(pick.symbol, pick);

        // One consistent quality gate, applied regardless of source scanner.
        const qualityGated = Array.from(mergedBySymbol.values())
            .filter(p => p.technicalScore >= MIN_TECHNICAL_SCORE && p.analystScore >= MIN_ANALYST_SCORE)
            .sort((a, b) => b.score - a.score);

        // One consistent sector cap, applied regardless of source scanner.
        const sectorCounts: Record<string, number> = {};
        const gatedAndCapped = qualityGated.filter(p => {
            const sector = p.sector || 'Other';
            sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
            return sectorCounts[sector] <= MAX_STOCKS_PER_SECTOR;
        });

        const convictionData: ConvictionStock[] = gatedAndCapped.filter(p => p.score >= CONVICTION_SCORE_THRESHOLD);
        console.log(`[Auto-Trade] Merged universe: ${rawConviction.length} Top Picks + ${rawAlpha.length} Alpha Hunter → ${mergedBySymbol.size} unique → ${convictionData.length} pass gate+cap+threshold`);

        // Cheap synchronous filters next
        const candidatePicks = convictionData
            .filter(pick => {
                // Exclude indices, futures, commodities
                if (EXCLUDED_SYMBOLS.includes(pick.symbol)) return false;
                // Exclude already held positions
                if (currentSymbols.includes(pick.symbol)) return false;
                // Only bullish trend signals
                if (pick.metrics?.trend !== 'BULLISH') return false;
                return true;
            })
            .sort((a, b) => b.score - a.score);

        // Earnings-date blackout (audit fix #1): port the options engine's
        // 7-day earnings deferral (lib/options.ts, getEarningsInfo()) to the
        // equity path so auto-trade can't open a fresh position right before
        // an earnings print.
        const eligiblePicks: ConvictionStock[] = [];
        const earningsBlackoutSkips: { symbol: string; daysUntilEarnings: number }[] = [];
        const slotsAvailable = MAX_POSITIONS - openPositionCount;
        for (const pick of candidatePicks) {
            if (eligiblePicks.length >= slotsAvailable) break;
            const { daysUntilEarnings } = await getEarningsInfo(pick.symbol);
            if (daysUntilEarnings >= 0 && daysUntilEarnings <= EARNINGS_BLACKOUT_DAYS) {
                console.log(`[Auto-Trade] Skipping ${pick.symbol}: earnings in ${daysUntilEarnings}d (within ${EARNINGS_BLACKOUT_DAYS}d blackout)`);
                earningsBlackoutSkips.push({ symbol: pick.symbol, daysUntilEarnings });
                continue;
            }
            eligiblePicks.push(pick);
        }

        console.log(`[Auto-Trade] Eligible picks: ${eligiblePicks.map(p => p.symbol).join(', ')}`);

        if (eligiblePicks.length === 0) {
            return NextResponse.json({
                message: 'No eligible picks found',
                filters: 'Excluded indices, commodities, existing positions, non-bullish trends, and earnings-blackout window',
                earningsBlackoutSkips
            });
        }

        // Execute trades
        const tradeResults = [];

        for (const pick of eligiblePicks) {
            // Portfolio-level sector cap (audit fix #2) — checked against currently
            // held positions PLUS picks already filled earlier in this same loop.
            const pickSector = pick.sector || sectorMap[pick.symbol] || 'Other';
            const sectorCount = sectorPositionCounts[pickSector] || 0;
            if (sectorCount >= LIVE_PORTFOLIO_SECTOR_CAP) {
                console.log(`[Auto-Trade] Skipping ${pick.symbol}: sector cap reached (${pickSector}: ${sectorCount}/${LIVE_PORTFOLIO_SECTOR_CAP})`);
                tradeResults.push({
                    symbol: pick.symbol,
                    status: 'skipped',
                    reason: `Sector cap reached (${pickSector}: ${sectorCount}/${LIVE_PORTFOLIO_SECTOR_CAP})`
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

            // ATR-anchored risk-based sizing (audit fix #2): fix a $ risk budget per
            // trade, then size shares so the distance to an ATR/EMA50-anchored stop
            // equals that budget. Mirrors the options engine's stop logic
            // (lib/options.ts "EMA-anchored stop loss", ~line 480) instead of the old
            // flat $250 / -10% / +25%. Volatile names get fewer shares, calm names get
            // more, but max dollar loss per trade stays constant at LIVE_TRADE_RISK_PER_TRADE.
            const atr = pick.metrics?.atr14 || price * 0.02; // 2% proxy if ATR unavailable, same convention as lib/conviction.ts
            const ema50 = pick.metrics?.ema50;
            const ema50Floor = (ema50 && ema50 < price && ema50 > price * 0.90)
                ? ema50 * 0.99
                : price - atr;
            const stopLoss = Math.max(ema50Floor, price - atr * 1.5);
            const takeProfit = price + atr * 2;
            const riskPerShare = price - stopLoss;

            if (!(riskPerShare > 0)) {
                tradeResults.push({
                    symbol: pick.symbol,
                    status: 'skipped',
                    reason: 'Invalid ATR-anchored stop distance'
                });
                continue;
            }

            let qty = Math.floor(LIVE_TRADE_RISK_PER_TRADE / riskPerShare);
            // Notional safety ceiling — a very tight stop (low-ATR name) shouldn't be
            // able to size a position up without bound.
            const maxQtyByNotional = Math.floor(LIVE_TRADE_MAX_NOTIONAL / price);
            qty = Math.min(qty, maxQtyByNotional);

            if (qty <= 0) {
                tradeResults.push({
                    symbol: pick.symbol,
                    status: 'skipped',
                    reason: qty === 0 && maxQtyByNotional === 0 ? 'Price too high' : 'Stop distance too wide for risk budget'
                });
                continue;
            }

            const estimatedCost = qty * price;
            if (buyingPower < estimatedCost) {
                console.log(`[Auto-Trade] Insufficient buying power for ${pick.symbol}`);
                tradeResults.push({
                    symbol: pick.symbol,
                    status: 'skipped',
                    reason: 'Insufficient buying power'
                });
                continue;
            }

            const stopLossPercent = riskPerShare / price;
            const takeProfitPercent = (takeProfit - price) / price;

            // Submit bracket order
            const order = await submitBracketOrder({
                symbol: pick.symbol,
                qty: qty,
                stopLossPercent,
                takeProfitPercent
            });

            if (order) {
                sectorPositionCounts[pickSector] = sectorCount + 1;
                tradeResults.push({
                    symbol: pick.symbol,
                    status: 'submitted',
                    orderId: order.id,
                    qty: qty,
                    estimatedCost,
                    riskBudget: LIVE_TRADE_RISK_PER_TRADE,
                    stopLoss: `$${stopLoss.toFixed(2)} (-${(stopLossPercent * 100).toFixed(1)}%)`,
                    takeProfit: `$${takeProfit.toFixed(2)} (+${(takeProfitPercent * 100).toFixed(1)}%)`,
                    sector: pickSector
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
            earningsBlackoutSkips,
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
