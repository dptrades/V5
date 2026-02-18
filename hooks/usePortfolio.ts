'use client';

import { useState, useEffect, useCallback } from 'react';

interface PortfolioAccount {
    equity: number;
    buyingPower: number;
    cash: number;
    portfolioValue: number;
}

interface Position {
    symbol: string;
    qty: number;
    avgPrice: number;
    currentPrice: number;
    marketValue: number;
    unrealizedPL: number;
    unrealizedPLPercent: number;
}

interface Order {
    id: string;
    symbol: string;
    side: 'buy' | 'sell';
    qty: number;
    status: string;
    filledPrice: number | null;
    createdAt: string;
}

export interface PortfolioData {
    account: PortfolioAccount;
    positions: Position[];
    recentOrders: Order[];
}

interface UsePortfolioOptions {
    autoFetch?: boolean;
    refreshInterval?: number | null;
}

interface UsePortfolioReturn {
    portfolio: PortfolioData | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

/**
 * Hook for fetching portfolio data from Alpaca
 */
export function usePortfolio(options: UsePortfolioOptions = {}): UsePortfolioReturn {
    const { autoFetch = true, refreshInterval = null } = options;

    const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
    const [loading, setLoading] = useState(autoFetch);
    const [error, setError] = useState<string | null>(null);

    const refetch = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/auto-trade');
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || `API error: ${res.status}`);
            }
            const data: PortfolioData = await res.json();
            setPortfolio(data);
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Failed to fetch portfolio';
            setError(message);
            console.error('[usePortfolio]', message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (autoFetch) {
            refetch();
        }
    }, [autoFetch, refetch]);

    useEffect(() => {
        if (!refreshInterval) return;

        const interval = setInterval(refetch, refreshInterval);
        return () => clearInterval(interval);
    }, [refreshInterval, refetch]);

    return { portfolio, loading, error, refetch };
}
