import { NextResponse } from 'next/server';
import {
    getAccount,
    getPositions,
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

// NOTE: this route duplicated app/api/auto-trade/route.ts's pre-fix logic (Alpha
// Hunter only, no quality gate, no sector cap, no earnings blackout, flat
// $250/-10%/+25% sizing). It is not currently registered in vercel.json's `crons`
// array, so nothing schedules it today — but it's still reachable by an
// authenticated request and would silently bypass every guardrail just added to
// the sibling route if left as-is. Brought in line with the same audit fixes
// (#1 and #2) for consistency; see CODE_AUDIT_AND_IMPROVEMENTS.md.

// Symbols to exclude (indices, futures, commodities, ETFs)
const EXCLUDED_SYMBOLS = [
    'SPY', 'QQQ', 'DIA', 'IWM', 'VTI', 'VOO',
    'GLD', 'SLV', 'USO', 'UNG', 'CORN', 'WEAT',
    'VXX', 'UVXY', 'SVXY', 'VIXY',
    'TLT', 'IEF', 'AGG', 'BND',
    'SQQQ', 'TQQQ', 'SPXU', 'SPXL', 'SOXL', 'SOXS'
];

// Trade parameters
const MAX_POSITIONS = 4; // Max 4 positions ($1000 total limit)
const EARNINGS_BLACKOUT_DAYS = 7; // Don't open a fresh position within 7 days of an earnings print

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

        // Portfolio-level sector cap (audit fix #2) against currently held positions.
        const sectorMap = await getSectorMap();
        const sectorPositionCounts: Record<string, number> = {};
        for (const p of currentPositions) {
            const sector = sectorMap[p.symbol] || 'Other';
            sectorPositionCounts[sector] = (sectorPositionCounts[sector] || 0) + 1;
        }

        // Fetch BOTH scanners' full ungated universes and merge, then apply ONE
        // consistent quality gate + sector cap regardless of source scanner
        // (audit fix #1 — matches app/api/auto-trade/route.ts).
        console.log('[Cron Auto-Trade] Scanning Top Picks + Alpha Hunter (merged, gated)...');
        const [rawConviction, rawAlpha] = await Promise.all([
            scanConviction(false, true),
            scanAlphaHunter(false, true)
        ]);

        const mergedBySymbol = new Map<string, ConvictionStock>();
        for (const pick of rawAlpha) mergedBySymbol.set(pick.symbol, pick);
        for (const pick of rawConviction) mergedBySymbol.set(pick.symbol, pick);

        const qualityGated = Array.from(mergedBySymbol.values())
            .filter(p => p.technicalScore >= MIN_TECHNICAL_SCORE && p.analystScore >= MIN_ANALYST_SCORE)
            .sort((a, b) => b.score - a.score);

        const candidateSectorCounts: Record<string, number> = {};
        const gatedAndCapped = qualityGated.filter(p => {
            const sector = p.sector || 'Other';
            candidateSectorCounts[sector] = (candidateSectorCounts[sector] || 0) + 1;
            return candidateSectorCounts[sector] <= MAX_STOCKS_PER_SECTOR;
        });

        const convictionData: ConvictionStock[] = gatedAndCapped.filter(p => p.score >= CONVICTION_SCORE_THRESHOLD);
        console.log(`[Cron Auto-Trade] Merged universe: ${rawConviction.length} Top Picks + ${rawAlpha.length} Alpha Hunter → ${mergedBySymbol.size} unique → ${convictionData.length} pass gate+cap+threshold`);

        // Filter and sort picks
        const candidatePicks = convictionData
            .filter(pick => {
                if (EXCLUDED_SYMBOLS.includes(pick.symbol)) return false;
                if (currentSymbols.includes(pick.symbol)) return false;
                if (pick.metrics?.trend !== 'BULLISH') return false;
                return true;
            })
            .sort((a, b) => b.score - a.score);

        // Earnings-date blackout (audit fix #1).
        const eligiblePicks: ConvictionStock[] = [];
        const earningsBlackoutSkips: { symbol: string; daysUntilEarnings: number }[] = [];
        const slotsAvailable = MAX_POSITIONS - openPositionCount;
        for (const pick of candidatePicks) {
            if (eligiblePicks.length >= slotsAvailable) break;
            const { daysUntilEarnings } = await getEarningsInfo(pick.symbol);
            if (daysUntilEarnings >= 0 && daysUntilEarnings <= EARNINGS_BLACKOUT_DAYS) {
                console.log(`[Cron Auto-Trade] Skipping ${pick.symbol}: earnings in ${daysUntilEarnings}d (within ${EARNINGS_BLACKOUT_DAYS}d blackout)`);
                earningsBlackoutSkips.push({ symbol: pick.symbol, daysUntilEarnings });
                continue;
            }
            eligiblePicks.push(pick);
        }

        console.log(`[Cron Auto-Trade] Eligible picks: ${eligiblePicks.map(p => p.symbol).join(', ')}`);

        if (eligiblePicks.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No eligible picks found',
                earningsBlackoutSkips,
                timestamp: new Date().toISOString()
            });
        }

        // Execute trades
        const tradeResults = [];

        for (const pick of eligiblePicks) {
            // Portfolio-level sector cap against held positions + fills earlier in this loop.
            const pickSector = pick.sector || sectorMap[pick.symbol] || 'Other';
            const sectorCount = sectorPositionCounts[pickSector] || 0;
            if (sectorCount >= LIVE_PORTFOLIO_SECTOR_CAP) {
                console.log(`[Cron Auto-Trade] Skipping ${pick.symbol}: sector cap reached (${pickSector}: ${sectorCount}/${LIVE_PORTFOLIO_SECTOR_CAP})`);
                tradeResults.push({
                    symbol: pick.symbol,
                    status: 'skipped',
                    reason: `Sector cap reached (${pickSector}: ${sectorCount}/${LIVE_PORTFOLIO_SECTOR_CAP})`
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

            // ATR-anchored risk-based sizing (audit fix #2) — see
            // app/api/auto-trade/route.ts for the full rationale.
            const atr = pick.metrics?.atr14 || price * 0.02;
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
            const maxQtyByNotional = Math.floor(LIVE_TRADE_MAX_NOTIONAL / price);
            qty = Math.min(qty, maxQtyByNotional);

            if (qty <= 0) {
                tradeResults.push({
                    symbol: pick.symbol,
                    status: 'skipped',
                    reason: qty === 0 && maxQtyByNotional === 0 ? `Price too high ($${price})` : 'Stop distance too wide for risk budget'
                });
                continue;
            }

            const estimatedCost = qty * price;
            if (buyingPower < estimatedCost) {
                tradeResults.push({
                    symbol: pick.symbol,
                    status: 'skipped',
                    reason: 'Insufficient buying power'
                });
                continue;
            }

            const stopLossPercent = riskPerShare / price;
            const takeProfitPercent = (takeProfit - price) / price;

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
            earningsBlackoutSkips,
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
