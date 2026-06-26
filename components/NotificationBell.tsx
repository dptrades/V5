"use client";

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useNotifications, NotificationItem } from '../context/NotificationContext';
import { Bell, Trash2, CheckCheck, Volume2, ShieldAlert, Sparkles, X } from 'lucide-react';

export default function NotificationBell() {
    const router = useRouter();
    const {
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        clearAll,
        permissionStatus,
        requestPermission,
        addNotification
    } = useNotifications();

    const [isOpen, setIsOpen] = useState(false);
    const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
    
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Calculate dropdown viewport-relative position
    const updatePosition = () => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
            const dropdownWidth = isMobile ? Math.min(320, window.innerWidth - 32) : 384;
            
            // Default align left edge of dropdown with left edge of button
            let left = rect.left;
            
            // If button is in the right half of the screen, align right edge of dropdown with right edge of button
            if (typeof window !== 'undefined' && rect.left > window.innerWidth / 2) {
                left = rect.right - dropdownWidth;
            }
            
            // Bound checking: Clamp within the viewport margins
            if (typeof window !== 'undefined') {
                const minLeft = 16;
                const maxLeft = window.innerWidth - dropdownWidth - 16;
                left = Math.max(minLeft, Math.min(maxLeft, left));
            }

            setCoords({
                top: rect.bottom + 8,
                left: left
            });
        }
    };

    useEffect(() => {
        if (isOpen) {
            updatePosition();
            window.addEventListener('resize', updatePosition);
            window.addEventListener('scroll', updatePosition, true);
        }
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen]);

    // Close dropdown on clicking outside either button or dropdown portal
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const targetNode = event.target as Node;
            if (
                dropdownRef.current && !dropdownRef.current.contains(targetNode) &&
                buttonRef.current && !buttonRef.current.contains(targetNode)
            ) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleTestAlert = () => {
        addNotification(
            'TERMINAL_CROSS',
            '🔔 Test Alert Triggered',
            'DP TradeDesk real-time audio and desktop notifications are active.',
            'TEST',
            'NORMAL'
        );
    };

    const handleItemClick = (item: NotificationItem) => {
        markAsRead(item.id);
        if (item.symbol && item.symbol !== 'TEST') {
            router.push(`/?symbol=${item.symbol}`);
            setIsOpen(false);
        }
    };

    const getSeverityStyles = (item: NotificationItem) => {
        if (item.severity === 'HIGH') {
            return {
                bg: 'bg-red-500/10 border-red-500/30 hover:bg-red-500/15',
                dot: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]',
                title: 'text-red-400'
            };
        }
        return {
            bg: 'bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/15',
            dot: 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]',
            title: 'text-blue-400'
        };
    };

    return (
        <div className="relative inline-block">
            {/* Bell Trigger Button */}
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className={`p-2 bg-gray-800/80 hover:bg-gray-700/80 rounded-xl border border-gray-700 text-gray-300 hover:text-white transition-all duration-200 relative group active:scale-95 shadow-md flex items-center justify-center`}
                title="Notifications"
            >
                <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'animate-wiggle text-blue-400' : ''}`} />
                {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white ring-2 ring-gray-900 animate-pulse-fast shadow-[0_0_10px_rgba(37,99,235,0.6)]">
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Menu (rendered in portal at the body level to prevent overflow clipping) */}
            {isOpen && createPortal(
                <div 
                    ref={dropdownRef}
                    style={{
                        position: 'fixed',
                        top: `${coords.top}px`,
                        left: `${coords.left}px`,
                        zIndex: 999999
                    }}
                    className="w-80 sm:w-[384px] rounded-2xl bg-gray-900/95 backdrop-blur-xl border border-gray-800 shadow-[0_10px_50px_rgba(0,0,0,0.85)] overflow-hidden animate-in fade-in slide-in-from-top-3 duration-200"
                >
                    {/* Header */}
                    <div className="p-4 bg-gray-950/60 border-b border-gray-800/80 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-blue-400" />
                            <h3 className="text-sm font-bold text-white tracking-wider uppercase">Activity Feed</h3>
                        </div>
                        <div className="flex items-center gap-1">
                            {notifications.length > 0 && (
                                <>
                                    <button
                                        onClick={markAllAsRead}
                                        className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-green-400 transition-colors"
                                        title="Mark all as read"
                                    >
                                        <CheckCheck className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={clearAll}
                                        className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                                        title="Clear all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </>
                            )}
                            <button
                                onClick={handleTestAlert}
                                className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-blue-400 transition-colors"
                                title="Test Notification Sound & Pop-up"
                            >
                                <Volume2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Permission Status Box (If not granted) */}
                    {permissionStatus !== 'granted' && (
                        <div className="p-3 bg-yellow-500/10 border-b border-yellow-500/20 flex items-center justify-between text-xs text-yellow-300">
                            <span className="flex items-center gap-1.5 font-medium">
                                <ShieldAlert className="w-3.5 h-3.5" />
                                Enable desktop alerts
                            </span>
                            <button
                                onClick={requestPermission}
                                className="px-2 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 font-bold rounded border border-yellow-500/30 transition-all text-[10px]"
                            >
                                Enable
                            </button>
                        </div>
                    )}

                    {/* Notification List */}
                    <div className="max-h-[360px] overflow-y-auto custom-scrollbar divide-y divide-gray-800/40">
                        {notifications.length === 0 ? (
                            <div className="py-12 px-4 text-center flex flex-col items-center justify-center">
                                <Bell className="w-8 h-8 text-gray-600 mb-3 opacity-40" />
                                <p className="text-xs text-gray-200">No recent alerts</p>
                                <p className="text-[10px] text-gray-400 mt-1 max-w-[200px]">
                                    Intraday price scans and regime shifts will stream here.
                                </p>
                            </div>
                        ) : (
                            notifications.map((item) => {
                                const styles = getSeverityStyles(item);
                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => handleItemClick(item)}
                                        className={`p-4 border-l-2 transition-all cursor-pointer relative ${
                                            item.read ? 'border-l-transparent bg-transparent hover:bg-gray-800/20' : `border-l-blue-500 ${styles.bg}`
                                        }`}
                                    >
                                        <div className="flex justify-between items-start gap-2 mb-1">
                                            <div className="flex items-center gap-1.5">
                                                <div className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
                                                <span className={`text-xs font-bold ${styles.title}`}>
                                                    {item.title}
                                                </span>
                                            </div>
                                            <span className="text-[9px] text-gray-400 font-mono">
                                                {item.timestamp}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-100 leading-relaxed pr-6">
                                            {item.message}
                                        </p>
                                        {!item.read && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    markAsRead(item.id);
                                                }}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-blue-400 transition-colors"
                                                title="Mark as read"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-2.5 bg-gray-950/60 border-t border-gray-800/80 text-center">
                        <span className="text-[9px] text-gray-400 font-mono uppercase tracking-wider">
                            Intraday Pulse Polling: Active
                        </span>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
