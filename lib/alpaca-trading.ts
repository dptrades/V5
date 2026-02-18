/**
 * Alpaca Paper Trading Client
 * Uses Alpaca's paper trading API for automated stock trades
 */

const PAPER_API_URL = 'https://paper-api.alpaca.markets';
const DATA_API_URL = 'https://data.alpaca.markets';

// Get API credentials at runtime
function getCredentials() {
    const apiKey = process.env.ALPACA_API_KEY || '';
    const apiSecret = process.env.ALPACA_API_SECRET || '';
    return { apiKey, apiSecret };
}

// Common headers for Alpaca API
function getHeaders() {
    const { apiKey, apiSecret } = getCredentials();
    return {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': apiSecret,
        'Content-Type': 'application/json'
    };
}

// Types
export interface AlpacaAccount {
    id: string;
    account_number: string;
    status: string;
    currency: string;
    buying_power: string;
    cash: string;
    portfolio_value: string;
    equity: string;
    last_equity: string;
    multiplier: string;
    initial_margin: string;
    maintenance_margin: string;
    daytrade_count: number;
    pattern_day_trader: boolean;
}

export interface AlpacaPosition {
    asset_id: string;
    symbol: string;
    exchange: string;
    asset_class: string;
    qty: string;
    avg_entry_price: string;
    side: string;
    market_value: string;
    cost_basis: string;
    unrealized_pl: string;
    unrealized_plpc: string;
    current_price: string;
    lastday_price: string;
    change_today: string;
}

export interface AlpacaOrder {
    id: string;
    client_order_id: string;
    symbol: string;
    qty: string;
    filled_qty: string;
    side: 'buy' | 'sell';
    type: string;
    status: string;
    created_at: string;
    filled_at: string | null;
    filled_avg_price: string | null;
    order_class: string;
    stop_price?: string;
    limit_price?: string;
}

export interface BracketOrderParams {
    symbol: string;
    qty: number;
    stopLossPercent: number;  // e.g., 0.10 for 10%
    takeProfitPercent: number; // e.g., 0.25 for 25%
}

/**
 * Get account information (buying power, equity, etc.)
 */
export async function getAccount(): Promise<AlpacaAccount | null> {
    try {
        const response = await fetch(`${PAPER_API_URL}/v2/account`, {
            headers: getHeaders(),
            cache: 'no-store'
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('[Alpaca Trading] Account error:', error);
            return null;
        }

        return await response.json();
    } catch (e) {
        console.error('[Alpaca Trading] Failed to get account:', e);
        return null;
    }
}

/**
 * Get all open positions
 */
export async function getPositions(): Promise<AlpacaPosition[]> {
    try {
        const response = await fetch(`${PAPER_API_URL}/v2/positions`, {
            headers: getHeaders(),
            cache: 'no-store'
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('[Alpaca Trading] Positions error:', error);
            return [];
        }

        return await response.json();
    } catch (e) {
        console.error('[Alpaca Trading] Failed to get positions:', e);
        return [];
    }
}

/**
 * Get current price for a symbol
 */
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

/**
 * Get current price for a symbol
 * Tries Alpaca first, falls back to Yahoo Finance
 */
export async function getLatestPrice(symbol: string): Promise<number | null> {
    // 1. Try Alpaca first
    try {
        const response = await fetch(`${DATA_API_URL}/v2/stocks/${symbol}/quotes/latest?feed=iex`, {
            headers: getHeaders(),
            cache: 'no-store'
        });

        if (response.ok) {
            const data = await response.json();
            if (data.quote && data.quote.ap && data.quote.bp) {
                return (data.quote.ap + data.quote.bp) / 2;
            }
        }
    } catch (e) {
        console.error(`[Alpaca Trading] Alpaca price fetch failed for ${symbol}:`, e);
    }

    // 2. Fallback to Yahoo Finance
    try {
        console.log(`[Alpaca Trading] Falling back to Yahoo Finance for ${symbol}`);
        const quote = await yahooFinance.quote(symbol);
        return quote.regularMarketPrice || null;
    } catch (e) {
        console.error(`[Alpaca Trading] Yahoo price fetch failed for ${symbol}:`, e);
        return null;
    }
}

/**
 * Submit a bracket order (market buy with stop loss and take profit)
 */
export async function submitBracketOrder(params: BracketOrderParams): Promise<AlpacaOrder | null> {
    const { symbol, qty, stopLossPercent, takeProfitPercent } = params;

    if (qty <= 0) {
        console.error('[Alpaca Trading] Invalid quantity:', qty);
        return null;
    }

    try {
        // Get current price for stop/limit calculations
        const currentPrice = await getLatestPrice(symbol);
        if (!currentPrice) {
            console.error('[Alpaca Trading] Could not get price for', symbol);
            return null;
        }

        const stopPrice = Math.round((currentPrice * (1 - stopLossPercent)) * 100) / 100;
        const limitPrice = Math.round((currentPrice * (1 + takeProfitPercent)) * 100) / 100;

        console.log(`[Alpaca Trading] Submitting bracket order for ${symbol}:`);
        console.log(`  - Qty: ${qty}`);
        console.log(`  - Current Price: $${currentPrice}`);
        console.log(`  - Stop Loss: $${stopPrice} (-${stopLossPercent * 100}%)`);
        console.log(`  - Take Profit: $${limitPrice} (+${takeProfitPercent * 100}%)`);

        const orderPayload = {
            symbol: symbol,
            qty: qty.toString(),
            side: 'buy',
            type: 'market',
            time_in_force: 'gtc',
            order_class: 'bracket',
            stop_loss: {
                stop_price: stopPrice.toString()
            },
            take_profit: {
                limit_price: limitPrice.toString()
            }
        };

        const response = await fetch(`${PAPER_API_URL}/v2/orders`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(orderPayload),
            cache: 'no-store'
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('[Alpaca Trading] Order error:', error);
            return null;
        }

        const order = await response.json();
        console.log(`[Alpaca Trading] Order submitted: ${order.id}`);
        return order;
    } catch (e) {
        console.error('[Alpaca Trading] Failed to submit order:', e);
        return null;
    }
}

/**
 * Get recent orders
 */
export async function getOrders(status: 'open' | 'closed' | 'all' = 'all', limit: number = 50): Promise<AlpacaOrder[]> {
    try {
        const response = await fetch(`${PAPER_API_URL}/v2/orders?status=${status}&limit=${limit}&direction=desc`, {
            headers: getHeaders(),
            cache: 'no-store'
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('[Alpaca Trading] Orders error:', error);
            return [];
        }

        return await response.json();
    } catch (e) {
        console.error('[Alpaca Trading] Failed to get orders:', e);
        return [];
    }
}

/**
 * Cancel an order
 */
export async function cancelOrder(orderId: string): Promise<boolean> {
    try {
        const response = await fetch(`${PAPER_API_URL}/v2/orders/${orderId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });

        return response.ok;
    } catch (e) {
        console.error('[Alpaca Trading] Failed to cancel order:', e);
        return false;
    }
}

/**
 * Close a position (sell all shares)
 */
export async function closePosition(symbol: string): Promise<boolean> {
    try {
        const response = await fetch(`${PAPER_API_URL}/v2/positions/${symbol}`, {
            method: 'DELETE',
            headers: getHeaders()
        });

        return response.ok;
    } catch (e) {
        console.error('[Alpaca Trading] Failed to close position:', e);
        return false;
    }
}

/**
 * Check if market is open
 */
export async function isMarketOpen(): Promise<boolean> {
    try {
        const response = await fetch(`${PAPER_API_URL}/v2/clock`, {
            headers: getHeaders(),
            cache: 'no-store'
        });

        if (!response.ok) return false;

        const data = await response.json();
        return data.is_open === true;
    } catch (e) {
        console.error('[Alpaca Trading] Failed to check market status:', e);
        return false;
    }
}
