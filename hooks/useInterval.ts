'use client';

import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook for running a callback at a specified interval
 * Properly handles cleanup and dynamic interval changes
 */
export function useInterval(callback: () => void, delay: number | null) {
    const savedCallback = useRef(callback);

    // Remember the latest callback
    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    // Set up the interval
    useEffect(() => {
        if (delay === null) return;

        const tick = () => savedCallback.current();
        const id = setInterval(tick, delay);

        return () => clearInterval(id);
    }, [delay]);
}

/**
 * Hook for polling data at a specified interval
 * Returns controls for starting/stopping the poll
 */
export function usePolling(
    fetchFn: () => Promise<void>,
    intervalMs: number,
    options: { immediate?: boolean; enabled?: boolean } = {}
) {
    const { immediate = true, enabled = true } = options;
    const isMounted = useRef(true);

    const poll = useCallback(async () => {
        if (!isMounted.current) return;
        await fetchFn();
    }, [fetchFn]);

    useEffect(() => {
        isMounted.current = true;

        if (!enabled) return;

        if (immediate) {
            poll();
        }

        const id = setInterval(poll, intervalMs);

        return () => {
            isMounted.current = false;
            clearInterval(id);
        };
    }, [poll, intervalMs, immediate, enabled]);
}
