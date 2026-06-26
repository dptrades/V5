import fs from 'fs';
import path from 'path';
import YahooFinance from 'yahoo-finance2';
import { scanConviction, scanAlphaHunter } from './conviction';
import { getEarningsInfo } from './options';
import { getLatestPrice } from './alpaca-trading';
import { getSectorMap } from './constants';
import { sendEmailAlert } from './notifications';
import { saveToBlob, getFromBlob } from './blob-storage';

const yahooFinance = new YahooFinance();

const RELATIVE_DATA_PATH = 'data/paper_trading.json';

export interface PaperPosition {
    symbol: string;
    qty: number;
    entryPrice: number;
    entryTime: string;
    stopLoss: number;
    targetProfit: number;
    currentPrice: number;
    sector: string;
}

export interface PaperHistoryEntry {
    id: string;
    symbol: string;
    side: 'buy' | 'sell';
    qty: number;
    entryPrice: number;
    entryTime: string;
    exitPrice: number | null;
    exitTime: string | null;
    stopLoss: number;
    targetProfit: number;
    status: 'filled' | 'open' | 'closed_stop' | 'closed_target' | 'closed_manual';
    pnl: number | null;
    pnlPercent: number | null;
    createdAt: string;
}

export interface PaperDailyLog {
    date: string;
    equity: number;
    cash: number;
    pnl: number;
    pnlPercent: number;
    openPositionsCount: number;
    closedTradesCount: number;
}

export interface PaperPortfolio {
    account: {
        cash: number;
        equity: number;
        initialBalance: number;
        lastUpdated: string;
    };
    positions: PaperPosition[];
    history: PaperHistoryEntry[];
    dailyLog: PaperDailyLog[];
}

// Initialize paper portfolio JSON file
export async function loadPaperPortfolio(): Promise<PaperPortfolio> {
    const initial: PaperPortfolio = {
        account: {
            cash: 1000.0,
            equity: 1000.0,
            initialBalance: 1000.0,
            lastUpdated: new Date().toISOString()
        },
        positions: [],
        history: [],
        dailyLog: []
    };

    const portfolio = await getFromBlob<PaperPortfolio>(RELATIVE_DATA_PATH, initial);
    return portfolio;
}

export async function savePaperPortfolio(portfolio: PaperPortfolio) {
    try {
        portfolio.account.lastUpdated = new Date().toISOString();
        await saveToBlob(RELATIVE_DATA_PATH, portfolio);
    } catch (e) {
        console.error('[Paper-Trading] Failed to save paper portfolio:', e);
    }
}

/**
 * Checks open positions for Stop Loss or Take Profit hits
 */
export async function updatePositionsAndExits(): Promise<{ closedTrades: PaperHistoryEntry[] }> {
    const portfolio = await loadPaperPortfolio();
    const closedTrades: PaperHistoryEntry[] = [];
    const remainingPositions: PaperPosition[] = [];
    let updatedCash = portfolio.account.cash;

    console.log(`[Paper-Trading] Updating prices for ${portfolio.positions.length} open positions...`);

    for (const pos of portfolio.positions) {
        try {
            // Get today's range to check SL/TP triggers
            const summary = await yahooFinance.quoteSummary(pos.symbol, { modules: ['price'] }).catch(() => null);
            const priceModule = (summary as any)?.price;
            
            if (!priceModule) {
                console.warn(`[Paper-Trading] Could not fetch price for ${pos.symbol}, keeping current settings`);
                remainingPositions.push(pos);
                continue;
            }

            const currentPrice = priceModule.regularMarketPrice || pos.currentPrice;
            const high = priceModule.regularMarketDayHigh || currentPrice;
            const low = priceModule.regularMarketDayLow || currentPrice;

            pos.currentPrice = currentPrice;

            // Check triggers: Stop Loss first (conservative)
            if (low <= pos.stopLoss) {
                // Stop Loss Hit
                const pnl = pos.qty * (pos.stopLoss - pos.entryPrice);
                const pnlPercent = ((pos.stopLoss - pos.entryPrice) / pos.entryPrice) * 100;
                updatedCash += pos.qty * pos.stopLoss;

                const historyEntry: PaperHistoryEntry = {
                    id: `sim-exit-${pos.symbol}-${Date.now()}`,
                    symbol: pos.symbol,
                    side: 'sell',
                    qty: pos.qty,
                    entryPrice: pos.entryPrice,
                    entryTime: pos.entryTime,
                    exitPrice: pos.stopLoss,
                    exitTime: new Date().toISOString(),
                    stopLoss: pos.stopLoss,
                    targetProfit: pos.targetProfit,
                    status: 'closed_stop',
                    pnl,
                    pnlPercent,
                    createdAt: new Date().toISOString()
                };

                portfolio.history.push(historyEntry);
                closedTrades.push(historyEntry);
                console.log(`[Paper-Trading] ❌ STOP LOSS Hit for ${pos.symbol}. Closed @ $${pos.stopLoss}. PnL: $${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)`);
            } else if (high >= pos.targetProfit) {
                // Target Profit Hit
                const pnl = pos.qty * (pos.targetProfit - pos.entryPrice);
                const pnlPercent = ((pos.targetProfit - pos.entryPrice) / pos.entryPrice) * 100;
                updatedCash += pos.qty * pos.targetProfit;

                const historyEntry: PaperHistoryEntry = {
                    id: `sim-exit-${pos.symbol}-${Date.now()}`,
                    symbol: pos.symbol,
                    side: 'sell',
                    qty: pos.qty,
                    entryPrice: pos.entryPrice,
                    entryTime: pos.entryTime,
                    exitPrice: pos.targetProfit,
                    exitTime: new Date().toISOString(),
                    stopLoss: pos.stopLoss,
                    targetProfit: pos.targetProfit,
                    status: 'closed_target',
                    pnl,
                    pnlPercent,
                    createdAt: new Date().toISOString()
                };

                portfolio.history.push(historyEntry);
                closedTrades.push(historyEntry);
                console.log(`[Paper-Trading] 🎯 TARGET PROFIT Hit for ${pos.symbol}. Closed @ $${pos.targetProfit}. PnL: $${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)`);
            } else {
                // Keep Position
                remainingPositions.push(pos);
            }
        } catch (e) {
            console.error(`[Paper-Trading] Error updating position ${pos.symbol}:`, e);
            remainingPositions.push(pos);
        }
    }

    // Calculate final equity
    let positionsValue = 0;
    for (const pos of remainingPositions) {
        positionsValue += pos.qty * pos.currentPrice;
    }

    portfolio.positions = remainingPositions;
    portfolio.account.cash = updatedCash;
    portfolio.account.equity = updatedCash + positionsValue;

    await savePaperPortfolio(portfolio);
    return { closedTrades };
}

/**
 * Execute automated morning scan after 9:45 AM
 */
export async function runSimulatedMorningScan(): Promise<{ enteredTrades: PaperHistoryEntry[] }> {
    const portfolio = await loadPaperPortfolio();
    const enteredTrades: PaperHistoryEntry[] = [];

    // Max 4 concurrent positions
    const MAX_POSITIONS = 4;
    const EARNINGS_BLACKOUT_DAYS = 7;
    const SECTOR_LIMIT = 2; // Sector cap from high-priority recommendations

    const currentPositionsCount = portfolio.positions.length;
    if (currentPositionsCount >= MAX_POSITIONS) {
        console.log('[Paper-Trading] Maximum position limit (4) reached. Skipping morning entries.');
        return { enteredTrades };
    }

    const availableSlots = MAX_POSITIONS - currentPositionsCount;
    const currentSymbols = portfolio.positions.map(p => p.symbol);

    // Count sector distribution of currently held positions
    const sectorPositionCounts: Record<string, number> = {};
    const sectorMap = await getSectorMap();
    for (const p of portfolio.positions) {
        const sector = sectorMap[p.symbol] || 'Other';
        sectorPositionCounts[sector] = (sectorPositionCounts[sector] || 0) + 1;
    }

    console.log('[Paper-Trading] Scanning candidates for morning entries...');
    // Scan Top Picks & Alpha Hunter
    const [rawConviction, rawAlpha] = await Promise.all([
        scanConviction(false, true), // returnAll=true
        scanAlphaHunter(false, true)
    ]);

    // Merge by symbol (Top Picks wins on conflict)
    const mergedCandidates = new Map<string, any>();
    for (const pick of rawAlpha) mergedCandidates.set(pick.symbol, pick);
    for (const pick of rawConviction) mergedCandidates.set(pick.symbol, pick);

    const sortedCandidates = Array.from(mergedCandidates.values())
        // Quality Gate: techScore >= 50 and analystScore >= 50
        .filter(c => c.technicalScore >= 50 && c.analystScore >= 50)
        .sort((a, b) => b.score - a.score);

    for (const candidate of sortedCandidates) {
        if (enteredTrades.length >= availableSlots) break;
        if (currentSymbols.includes(candidate.symbol)) continue;

        const symbol = candidate.symbol;
        const sector = candidate.sector || sectorMap[symbol] || 'Other';

        // 1. Sector Cap Filter
        const sectorCount = sectorPositionCounts[sector] || 0;
        if (sectorCount >= SECTOR_LIMIT) {
            console.log(`[Paper-Trading] Skipping ${symbol}: Sector cap of ${SECTOR_LIMIT} reached for ${sector}`);
            continue;
        }

        // 2. Earnings Blackout Filter
        const { daysUntilEarnings } = await getEarningsInfo(symbol);
        if (daysUntilEarnings >= 0 && daysUntilEarnings <= EARNINGS_BLACKOUT_DAYS) {
            console.log(`[Paper-Trading] Skipping ${symbol}: Earnings in ${daysUntilEarnings}d (earnings blackout)`);
            continue;
        }

        // 3. VWAP Filter (Medium Priority: Confirm price is above Daily VWAP)
        const price = await getLatestPrice(symbol);
        if (!price) continue;

        const dailyVWAP = candidate.metrics?.vwap;
        if (dailyVWAP && price < dailyVWAP) {
            console.log(`[Paper-Trading] Skipping ${symbol}: Price ($${price}) is below daily VWAP ($${dailyVWAP})`);
            continue;
        }

        // 4. Sizing Calculations (High Priority: Dynamic Portfolio Risk Sizing - Risk 2% of total equity)
        const atr = candidate.metrics?.atr14 || (price * 0.02);
        const ema50 = candidate.metrics?.ema50;
        
        // Stop Loss: 1.5 * ATR below price or EMA50 floor
        const ema50Floor = (ema50 && ema50 < price && ema50 > price * 0.90) ? ema50 * 0.99 : price - atr;
        const stopLoss = Math.max(ema50Floor, price - atr * 1.5);
        const targetProfit = price + atr * 2.0;

        const riskPerShare = price - stopLoss;
        if (riskPerShare <= 0) continue;

        // Risk 2% of total account equity per trade
        const riskBudget = portfolio.account.equity * 0.02; 
        let qty = Math.floor(riskBudget / riskPerShare);

        // Ceiling: Max 25% of account equity per position ($250 on a $1000 account)
        const maxNotional = portfolio.account.equity * 0.25;
        const maxQtyByNotional = Math.floor(maxNotional / price);
        qty = Math.min(qty, maxQtyByNotional);

        if (qty <= 0) continue;

        const estimatedCost = qty * price;
        if (portfolio.account.cash < estimatedCost) {
            console.log(`[Paper-Trading] Skipping ${symbol}: Insufficient cash ($${portfolio.account.cash.toFixed(2)} vs $${estimatedCost.toFixed(2)})`);
            continue;
        }

        // Execute Simulated Buy
        portfolio.account.cash -= estimatedCost;
        const position: PaperPosition = {
            symbol,
            qty,
            entryPrice: price,
            entryTime: new Date().toISOString(),
            stopLoss,
            targetProfit,
            currentPrice: price,
            sector
        };

        portfolio.positions.push(position);
        sectorPositionCounts[sector] = sectorCount + 1;

        const historyEntry: PaperHistoryEntry = {
            id: `sim-enter-${symbol}-${Date.now()}`,
            symbol,
            side: 'buy',
            qty,
            entryPrice: price,
            entryTime: position.entryTime,
            exitPrice: null,
            exitTime: null,
            stopLoss,
            targetProfit,
            status: 'filled',
            pnl: null,
            pnlPercent: null,
            createdAt: position.entryTime
        };

        portfolio.history.push(historyEntry);
        enteredTrades.push(historyEntry);

        console.log(`[Paper-Trading] 🚀 ENTERED simulated position: Buy ${qty} shares of ${symbol} @ $${price.toFixed(2)}. Stop: $${stopLoss.toFixed(2)}, Target: $${targetProfit.toFixed(2)} (Cost: $${estimatedCost.toFixed(2)}, Risk: $${riskBudget.toFixed(2)})`);
    }

    // Recalculate equity
    let positionsValue = 0;
    for (const pos of portfolio.positions) {
        positionsValue += pos.qty * pos.currentPrice;
    }
    portfolio.account.equity = portfolio.account.cash + positionsValue;

    await savePaperPortfolio(portfolio);
    return { enteredTrades };
}

/**
 * Execute simulated manual trade (Interactive Execution Routing)
 */
export async function executeSimulatedManualTrade(params: {
    symbol: string;
    qty: number;
    stopLoss?: number;
    targetProfit?: number;
}): Promise<{ success: boolean; error?: string; order?: PaperHistoryEntry }> {
    const portfolio = await loadPaperPortfolio();
    const symbol = params.symbol.toUpperCase();

    const price = await getLatestPrice(symbol);
    if (!price) {
        return { success: false, error: `Could not retrieve live price for ${symbol}` };
    }

    const estimatedCost = params.qty * price;
    if (portfolio.account.cash < estimatedCost) {
        return { success: false, error: `Insufficient cash ($${portfolio.account.cash.toFixed(2)} vs $${estimatedCost.toFixed(2)})` };
    }

    const sectorMap = await getSectorMap();
    const sector = sectorMap[symbol] || 'Other';

    // Auto-calculate stops if not provided
    const summary = await yahooFinance.quoteSummary(symbol, { modules: ['price'] }).catch(() => null);
    const priceModule = (summary as any)?.price;
    const atr = (priceModule?.regularMarketDayHigh && priceModule?.regularMarketDayLow)
        ? (priceModule.regularMarketDayHigh - priceModule.regularMarketDayLow)
        : (price * 0.02);

    const stopLoss = params.stopLoss || (price - atr * 1.5);
    const targetProfit = params.targetProfit || (price + atr * 2.0);

    portfolio.account.cash -= estimatedCost;

    const position: PaperPosition = {
        symbol,
        qty: params.qty,
        entryPrice: price,
        entryTime: new Date().toISOString(),
        stopLoss,
        targetProfit,
        currentPrice: price,
        sector
    };

    portfolio.positions.push(position);

    const historyEntry: PaperHistoryEntry = {
        id: `sim-enter-${symbol}-${Date.now()}`,
        symbol,
        side: 'buy',
        qty: params.qty,
        entryPrice: price,
        entryTime: position.entryTime,
        exitPrice: null,
        exitTime: null,
        stopLoss,
        targetProfit,
        status: 'filled',
        pnl: null,
        pnlPercent: null,
        createdAt: position.entryTime
    };

    portfolio.history.push(historyEntry);

    // Recalculate equity
    let positionsValue = 0;
    for (const pos of portfolio.positions) {
        positionsValue += pos.qty * pos.currentPrice;
    }
    portfolio.account.equity = portfolio.account.cash + positionsValue;

    await savePaperPortfolio(portfolio);
    console.log(`[Paper-Trading] 🚀 ENTERED simulated MANUAL position: Buy ${params.qty} shares of ${symbol} @ $${price.toFixed(2)}. Stop: $${stopLoss.toFixed(2)}, Target: $${targetProfit.toFixed(2)}`);

    return { success: true, order: historyEntry };
}

/**
 * Reset simulated paper portfolio
 */
export async function resetPaperPortfolio() {
    const initial: PaperPortfolio = {
        account: {
            cash: 1000.0,
            equity: 1000.0,
            initialBalance: 1000.0,
            lastUpdated: new Date().toISOString()
        },
        positions: [],
        history: [],
        dailyLog: []
    };
    await savePaperPortfolio(initial);
    console.log('[Paper-Trading] Reset virtual portfolio back to $1,000 cash.');
}

/**
 * Log daily performance at market close
 */
export async function logDailyPerformance(): Promise<PaperDailyLog> {
    const portfolio = await loadPaperPortfolio();
    
    // Update prices & check exits first
    const { closedTrades } = await updatePositionsAndExits();
    
    const today = new Date().toISOString().split('T')[0];
    const initialBalance = portfolio.account.initialBalance;
    const currentEquity = portfolio.account.equity;
    const totalPnl = currentEquity - initialBalance;
    const totalPnlPercent = (totalPnl / initialBalance) * 100;

    // Check if we already logged today
    const existingIndex = portfolio.dailyLog.findIndex(l => l.date === today);
    const dailyLogEntry: PaperDailyLog = {
        date: today,
        equity: currentEquity,
        cash: portfolio.account.cash,
        pnl: totalPnl,
        pnlPercent: totalPnlPercent,
        openPositionsCount: portfolio.positions.length,
        closedTradesCount: closedTrades.length
    };

    if (existingIndex >= 0) {
        portfolio.dailyLog[existingIndex] = dailyLogEntry;
    } else {
        portfolio.dailyLog.push(dailyLogEntry);
    }

    await savePaperPortfolio(portfolio);
    console.log(`[Paper-Trading] Daily log recorded for ${today}. Equity: $${currentEquity.toFixed(2)}, PnL: $${totalPnl.toFixed(2)} (${totalPnlPercent.toFixed(2)}%)`);
    
    return dailyLogEntry;
}

/**
 * Send email or log summary
 */
export async function sendDailySummary(timePeriod: 'morning' | 'close', details: any) {
    const portfolio = await loadPaperPortfolio();
    const today = new Date().toLocaleDateString();

    let subject = '';
    let message = '';

    if (timePeriod === 'morning') {
        const entered = details.enteredTrades || [];
        subject = `☀️ AntiGravity Simulated Morning Scan: ${today}`;
        message = `Simulated automated trading run updated at 9:45 AM ET.\n\n` +
                  `Account Value: $${portfolio.account.equity.toFixed(2)} (Cash: $${portfolio.account.cash.toFixed(2)})\n` +
                  `Positions entered today: ${entered.length}\n` +
                  (entered.length > 0 ? entered.map((t: any) => `- Buy ${t.qty} shares of ${t.symbol} @ $${t.entryPrice.toFixed(2)} (Stop: $${t.stopLoss.toFixed(2)}, Target: $${t.targetProfit.toFixed(2)})`).join('\n') : '- No new entries (maximum slots or no conditions met).') +
                  `\n\nActive Open Positions: ${portfolio.positions.length}\n` +
                  portfolio.positions.map(p => `- ${p.symbol}: ${p.qty} shares @ $${p.entryPrice.toFixed(2)} (Current: $${p.currentPrice.toFixed(2)}, PnL: $${(p.qty * (p.currentPrice - p.entryPrice)).toFixed(2)})`).join('\n');
    } else {
        const closed = details.closedTrades || [];
        const dailyLog = details.dailyLog || {};
        subject = `🔔 AntiGravity Simulated Market Close Summary: ${today}`;
        message = `Simulated automated trading run updated at Market Close.\n\n` +
                  `Account Value: $${portfolio.account.equity.toFixed(2)} (Cash: $${portfolio.account.cash.toFixed(2)})\n` +
                  `Total Return: $${dailyLog.pnl?.toFixed(2)} (${dailyLog.pnlPercent?.toFixed(2)}% since start)\n\n` +
                  `Exits hit today: ${closed.length}\n` +
                  (closed.length > 0 ? closed.map((t: any) => `- Closed ${t.symbol} @ $${t.exitPrice?.toFixed(2)} due to ${t.status} (PnL: $${t.pnl?.toFixed(2)})`).join('\n') : '- No positions exited today.') +
                  `\n\nRemaining Open Positions: ${portfolio.positions.length}\n` +
                  portfolio.positions.map(p => `- ${p.symbol}: ${p.qty} shares @ $${p.entryPrice.toFixed(2)} (Current: $${p.currentPrice.toFixed(2)}, PnL: $${(p.qty * (p.currentPrice - p.entryPrice)).toFixed(2)})`).join('\n');
    }

    console.log(`[Summary Email Alert]\nSubject: ${subject}\n${message}`);

    // If Resend configured, send email alert
    await sendEmailAlert({
        subject,
        message: message.replace(/\n/g, '<br/>'),
        stocks: portfolio.positions.map(p => ({
            symbol: p.symbol,
            signal: 'HOLD',
            strength: Math.round(((p.currentPrice - p.entryPrice) / p.entryPrice) * 100)
        }))
    }).catch(e => console.error('[Paper-Trading] Email fail:', e));
}
