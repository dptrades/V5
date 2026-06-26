"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

export interface NotificationItem {
    id: string;
    type: 'PRICE_MOVE' | 'VOLUME_SURGE' | 'RSI_EXTREME' | 'EMA_CROSS' | 'TERMINAL_CROSS' | 'VIX_SPIKE' | 'POSITION_CHANGE';
    title: string;
    message: string;
    symbol?: string;
    timestamp: string;
    read: boolean;
    severity: 'NORMAL' | 'HIGH';
}

interface NotificationContextProps {
    notifications: NotificationItem[];
    unreadCount: number;
    addNotification: (type: NotificationItem['type'], title: string, message: string, symbol?: string, severity?: 'NORMAL' | 'HIGH') => void;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    clearAll: () => void;
    requestPermission: () => void;
    permissionStatus: NotificationPermission;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

// Web Audio API double-chime sound synthesis
export function playNotificationSound(severity: 'NORMAL' | 'HIGH' = 'NORMAL') {
    if (typeof window === 'undefined') return;
    try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const now = audioCtx.currentTime;

        const playChime = (time: number, freq: number, duration: number, vol: number) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, time);

            gain.gain.setValueAtTime(vol, time);
            gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

            osc.connect(gain);
            gain.connect(audioCtx.destination);

            osc.start(time);
            osc.stop(time + duration);
        };

        if (severity === 'HIGH') {
            // Urgently chime: High-pitch alert (A5 -> C6)
            playChime(now, 880, 0.3, 0.15); // A5
            playChime(now + 0.1, 1046.50, 0.4, 0.15); // C6
        } else {
            // Calm double chime (D5 -> A5)
            playChime(now, 587.33, 0.3, 0.1); // D5
            playChime(now + 0.12, 880, 0.4, 0.12); // A5
        }
    } catch (e) {
        console.warn('Failed to play notification sound:', e);
    }
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');

    // Polling and state refs to prevent race conditions or duplicate alerts
    const prevTerminalScore = useRef<number | null>(null);
    const prevVix = useRef<number | null>(null);
    const prevPositions = useRef<string[]>([]);
    const lastAlertedTimes = useRef<Record<string, number>>({}); // Key: alertKey -> timestamp

    // Load initial state and notifications from localStorage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('trader_notifications');
            if (saved) {
                try {
                    setNotifications(JSON.parse(saved));
                } catch (e) {
                    console.error('Failed to parse notifications from localStorage', e);
                }
            }

            if ('Notification' in window) {
                setPermissionStatus(Notification.permission);
                // Proactively request permission if default
                if (Notification.permission === 'default') {
                    Notification.requestPermission().then(status => {
                        setPermissionStatus(status);
                    });
                }
            }
        }
    }, []);

    // Save notifications to localStorage whenever it changes
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('trader_notifications', JSON.stringify(notifications));
        }
    }, [notifications]);

    const requestPermission = () => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            Notification.requestPermission().then(status => {
                setPermissionStatus(status);
            });
        }
    };

    const addNotification = (
        type: NotificationItem['type'],
        title: string,
        message: string,
        symbol?: string,
        severity: 'NORMAL' | 'HIGH' = 'NORMAL'
    ) => {
        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newNotif: NotificationItem = {
            id,
            type,
            title,
            message,
            symbol,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            read: false,
            severity
        };

        setNotifications(prev => [newNotif, ...prev].slice(0, 100)); // Cap history at 100 items

        // Cooldown notification logic (15 minutes limit for duplicates)
        const cooldownKey = `${type}-${symbol || 'global'}-${title}`;
        const lastAlertTime = lastAlertedTimes.current[cooldownKey] || 0;
        const now = Date.now();

        if (now - lastAlertTime > 15 * 60 * 1000) {
            lastAlertedTimes.current[cooldownKey] = now;

            // Play sound
            playNotificationSound(severity);

            // Show native browser notification
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                try {
                    new Notification(title, {
                        body: message,
                        icon: '/favicon.ico'
                    });
                } catch (e) {
                    console.warn('Failed to show native browser notification:', e);
                }
            }
        }
    };

    const markAsRead = (id: string) => {
        setNotifications(prev =>
            prev.map(n => (n.id === id ? { ...n, read: true } : n))
        );
    };

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const clearAll = () => {
        setNotifications([]);
    };

    // Unread count
    const unreadCount = notifications.filter(n => !n.read).length;

    // --- Background Polling Services ---
    useEffect(() => {
        let active = true;

        const pollIntradayPulse = async () => {
            if (!active) return;
            try {
                const res = await fetch('/api/intraday-pulse');
                if (res.ok) {
                    const data = await res.json();
                    if (data.success && Array.isArray(data.alerts)) {
                        for (const alert of data.alerts) {
                            addNotification(
                                alert.type,
                                `Pulse: ${alert.symbol}`,
                                alert.message,
                                alert.symbol,
                                alert.severity
                            );
                        }
                    }
                }
            } catch (e) {
                console.error('[Notification Poller] Failed to fetch intraday pulse:', e);
            }
        };

        const pollTerminalState = async () => {
            if (!active) return;
            try {
                // Fetch terminal internal score
                const res = await fetch('/api/terminal?benchmark=SPY&mode=POSITIONAL');
                if (res.ok) {
                    const data = await res.json();
                    const score = data.totalScore;
                    const vixItem = data.scoringWeights?.find((w: any) => w.label === 'Volatility');
                    // Find VIX from top bar if exists
                    const vixPriceItem = data.topBar?.find((tb: any) => tb.symbol === 'VIX');
                    const vixVal = vixPriceItem ? vixPriceItem.price : (vixItem ? 20 : 20);

                    // 1. Check Terminal Score Crossings (above/below 55, 40)
                    if (score !== undefined && prevTerminalScore.current !== null) {
                        const prev = prevTerminalScore.current;
                        if (prev >= 55 && score < 55) {
                            addNotification(
                                'TERMINAL_CROSS',
                                '⚠️ Market Regime: RISK-OFF',
                                `Terminal Score dropped below 55 (Score: ${score}). Position sizes should be reduced.`,
                                undefined,
                                'HIGH'
                            );
                        } else if (prev < 55 && score >= 55) {
                            addNotification(
                                'TERMINAL_CROSS',
                                '🟢 Market Regime: RISK-ON',
                                `Terminal Score rose above 55 (Score: ${score}). Sizing normalized.`,
                                undefined,
                                'NORMAL'
                            );
                        }

                        if (prev >= 40 && score < 40) {
                            addNotification(
                                'TERMINAL_CROSS',
                                '🚨 Market Regime: EXTREME REGIME RISK',
                                `Terminal Score crashed below 40 (Score: ${score}). Capital preservation recommended. Avoid trades.`,
                                undefined,
                                'HIGH'
                            );
                        } else if (prev < 40 && score >= 40) {
                            addNotification(
                                'TERMINAL_CROSS',
                                '⚡ Market Regime: Recovering',
                                `Terminal Score returned above 40 (Score: ${score}).`,
                                undefined,
                                'NORMAL'
                            );
                        }
                    }
                    if (score !== undefined) {
                        prevTerminalScore.current = score;
                    }

                    // 2. Check VIX crossings (> 20 threshold)
                    if (vixVal !== undefined && prevVix.current !== null) {
                        const prev = prevVix.current;
                        if (prev <= 20 && vixVal > 20) {
                            addNotification(
                                'VIX_SPIKE',
                                '🔥 VIX Elevated',
                                `VIX volatility index spiked above 20 (VIX: ${vixVal.toFixed(2)}). Volatility expanding.`,
                                undefined,
                                'HIGH'
                            );
                        } else if (prev > 20 && vixVal <= 20) {
                            addNotification(
                                'VIX_SPIKE',
                                '🌊 VIX Subdued',
                                `VIX volatility index dropped below 20 (VIX: ${vixVal.toFixed(2)}). Volatility calm.`,
                                undefined,
                                'NORMAL'
                            );
                        }
                    }
                    if (vixVal !== undefined) {
                        prevVix.current = vixVal;
                    }
                }
            } catch (e) {
                console.error('[Notification Poller] Failed to fetch terminal status:', e);
            }
        };

        const pollPositionsState = async () => {
            if (!active) return;
            try {
                const res = await fetch('/api/auto-trade');
                if (res.ok) {
                    const data = await res.json();
                    if (data.positions && Array.isArray(data.positions)) {
                        const currentSymbols = data.positions.map((p: any) => p.symbol);

                        // Detect closed positions (exits)
                        for (const prevSym of prevPositions.current) {
                            if (!currentSymbols.includes(prevSym)) {
                                addNotification(
                                    'POSITION_CHANGE',
                                    `📉 Position Closed: ${prevSym}`,
                                    `Alpaca bracket order exit. Position in ${prevSym} is now closed.`,
                                    prevSym,
                                    'HIGH'
                                );
                            }
                        }

                        // Detect opened positions (entries)
                        for (const currSym of currentSymbols) {
                            if (!prevPositions.current.includes(currSym)) {
                                const posDetails = data.positions.find((p: any) => p.symbol === currSym);
                                const avgPrice = posDetails ? posDetails.avgPrice : 0;
                                addNotification(
                                    'POSITION_CHANGE',
                                    `📈 Position Entered: ${currSym}`,
                                    `Alpaca order filled. New position in ${currSym} at average entry $${avgPrice.toFixed(2)}.`,
                                    currSym,
                                    'NORMAL'
                                );
                            }
                        }

                        prevPositions.current = currentSymbols;
                    }
                }
            } catch (e) {
                console.error('[Notification Poller] Failed to fetch positions:', e);
            }
        };

        // Standard market timing helper to avoid polling when closed
        const isMarketHours = () => {
            const now = new Date();
            const estTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
            const hours = estTime.getHours();
            const minutes = estTime.getMinutes();
            const timeVal = hours + minutes / 60;
            const day = estTime.getDay();

            // Pre-market starts at 4:00 AM, Post-market ends at 8:00 PM EST
            if (day === 0 || day === 6) return false;
            return timeVal >= 4.0 && timeVal < 20.0;
        };

        // Run initial checks on load
        pollIntradayPulse();
        pollTerminalState();
        pollPositionsState();

        // 60-second Intraday and Terminal poller
        const checkInterval60s = setInterval(() => {
            if (isMarketHours() && active && !document.hidden) {
                pollIntradayPulse();
                pollTerminalState();
            }
        }, 60000);

        // 30-second Auto-trade position poller
        const checkInterval30s = setInterval(() => {
            if (isMarketHours() && active && !document.hidden) {
                pollPositionsState();
            }
        }, 30000);

        return () => {
            active = false;
            clearInterval(checkInterval60s);
            clearInterval(checkInterval30s);
        };
    }, []);

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            addNotification,
            markAsRead,
            markAllAsRead,
            clearAll,
            requestPermission,
            permissionStatus
        }}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
}
