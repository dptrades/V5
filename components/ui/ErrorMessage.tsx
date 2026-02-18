'use client';

import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorProps {
    title?: string;
    message: string;
    onRetry?: () => void;
    fullScreen?: boolean;
}

export function ErrorMessage({
    title = "Something went wrong",
    message,
    onRetry,
    fullScreen = false
}: ErrorProps) {
    const content = (
        <div className="flex flex-col items-center justify-center text-center p-6 space-y-4 max-w-md mx-auto">
            <div className="bg-red-500/10 p-4 rounded-full border border-red-500/20">
                <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <div>
                <h3 className="text-xl font-bold text-gray-100">{title}</h3>
                <p className="text-gray-100 mt-2 text-sm leading-relaxed">{message}</p>
            </div>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="flex items-center space-x-2 px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors border border-gray-700 hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <RefreshCw className="w-4 h-4" />
                    <span>Try Again</span>
                </button>
            )}
        </div>
    );

    if (fullScreen) {
        return (
            <div className="absolute inset-0 z-50 bg-gray-900/95 flex items-center justify-center">
                {content}
            </div>
        );
    }

    return (
        <div className="bg-gray-800/50 border border-red-900/30 rounded-xl p-8 h-full flex items-center justify-center">
            {content}
        </div>
    );
}
