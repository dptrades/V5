import React from 'react';

interface LoadingProps {
    message?: string;
    fullScreen?: boolean;
}

export function Loading({ message = "Loading...", fullScreen = false }: LoadingProps) {
    const content = (
        <div className="flex flex-col items-center justify-center space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="relative w-16 h-16">
                <div className="absolute w-full h-full border-4 border-blue-500/30 rounded-full"></div>
                <div className="absolute w-full h-full border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-gray-100 font-medium animate-pulse">{message}</p>
        </div>
    );

    if (fullScreen) {
        return (
            <div className="absolute inset-0 z-50 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center">
                {content}
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center p-8 h-full min-h-[200px]">
            {content}
        </div>
    );
}

export function LoadingCard() {
    return (
        <div className="animate-pulse bg-gray-800 rounded-xl p-4 w-full h-full min-h-[150px] border border-gray-700">
            <div className="h-4 bg-gray-700 rounded w-1/3 mb-4"></div>
            <div className="h-8 bg-gray-700 rounded w-2/3 mb-2"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2"></div>
        </div>
    );
}
