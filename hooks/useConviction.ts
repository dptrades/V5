'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ConvictionStock } from '@/types/stock';

interface UseConvictionOptions {
    autoFetch?: boolean;
    refreshInterval?: number | null; // ms, null to disable
}

interface UseConvictionReturn {
    data: ConvictionStock[];
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    lastFetched: Date | null;
}

/**
 * Hook for fetching conviction scanner data
 * Provides caching, auto-refresh, and error handling
 */
export function useConviction(options: UseConvictionOptions = {}): UseConvictionReturn {
    const { autoFetch = true, refreshInterval = null } = options;

    const [data, setData] = useState<ConvictionStock[]>([]);
    const [loading, setLoading] = useState(autoFetch);
    const [error, setError] = useState<string | null>(null);
    const [lastFetched, setLastFetched] = useState<Date | null>(null);

    const refetch = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/conviction');
            if (!res.ok) {
                throw new Error(`API error: ${res.status}`);
            }
            const results: ConvictionStock[] = await res.json();
            setData(results);
            setLastFetched(new Date());
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Failed to fetch conviction data';
            setError(message);
            console.error('[useConviction]', message);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        if (autoFetch) {
            refetch();
        }
    }, [autoFetch, refetch]);

    // Auto-refresh interval
    useEffect(() => {
        if (!refreshInterval) return;

        const interval = setInterval(refetch, refreshInterval);
        return () => clearInterval(interval);
    }, [refreshInterval, refetch]);

    return { data, loading, error, refetch, lastFetched };
}
