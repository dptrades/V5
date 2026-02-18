/**
 * Options Types
 * Types for options trading recommendations and signals
 */

export interface OptionRecommendation {
    type: 'CALL' | 'PUT' | 'WAIT';
    strike: number;
    expiry: string;
    confidence: number;
    reason: string;
    // Trade plan
    entryPrice?: number;       // Stock price to enter at
    entryCondition?: string;   // When to enter (e.g., "on pullback to $X")
    stopLoss?: number;         // Stock price stop-loss
    takeProfit1?: number;      // Conservative target
    takeProfit2?: number;      // Aggressive target
    riskReward?: string;       // Risk:Reward ratio
    maxLoss?: string;          // Estimated max loss description
    strategy?: string;         // Strategy name
    volume?: number;           // Trading volume
    openInterest?: number;     // Open interest
    iv?: number;               // Implied Volatility (0.0 to 1.0+)
    contractPrice?: number;    // Current market price of the option contract
    isUnusual?: boolean;       // True if Volume > Open Interest
    rsi?: number;              // RSI level of the underlying stock
    technicalConfirmations?: number;
    fundamentalConfirmations?: number;
    socialConfirmations?: number;
    technicalDetails?: string[];
    fundamentalDetails?: string[];
    socialDetails?: string[];
    symbol?: string;           // OSI Symbol (e.g. AAPL260320C00185000)
    putCallRatio?: number;     // Put/Call ratio based on volume
    probabilityITM?: number;    // Estimated probability of expiring ITM (0.0 to 1.0)
    dte?: number;              // Days To Expiration
}

export interface OptionsChain {
    symbol: string;
    expirationDate: string;
    calls: OptionContract[];
    puts: OptionContract[];
}

export interface OptionContract {
    strike: number;
    lastPrice: number;
    bid: number;
    ask: number;
    volume: number;
    openInterest: number;
    impliedVolatility: number;
    inTheMoney: boolean;
}
