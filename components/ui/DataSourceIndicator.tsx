import React from 'react';
import { Database } from 'lucide-react';

interface DataSourceIndicatorProps {
    source: string;
    className?: string;
}

export default function DataSourceIndicator({ source, className = "" }: DataSourceIndicatorProps) {
    return (
        <div className={`flex items-center gap-1 opacity-40 hover:opacity-100 transition-opacity cursor-default ${className}`}>
            <Database className="w-2 h-2 text-blue-400" />
            <span className="text-[8px] uppercase font-bold tracking-tighter text-gray-200">
                via {source}
            </span>
        </div>
    );
}
