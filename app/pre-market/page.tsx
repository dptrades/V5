"use client";

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import PreMarketMovers from '@/components/PreMarketMovers';

export default function PreMarketPage() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Persistence: Load sidebar state on mount
    useEffect(() => {
        const saved = localStorage.getItem('sidebarExpanded');
        if (saved !== null) {
            setIsSidebarOpen(saved === 'true');
        }
    }, []);

    return (
        <div className="flex h-screen overflow-hidden bg-[#0a0a0a] text-white selection:bg-yellow-500/30">
            {/* Sidebar Toggle Overlay for Mobile */}
            <div
                className={`fixed inset-0 z-[100] transition-opacity duration-300 lg:hidden ${isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setIsSidebarOpen(false)}
            >
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            </div>

            <div className={`
                fixed inset-y-0 left-0 z-[110] transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                ${isSidebarOpen ? 'w-[20vw] lg:w-[18vw] min-w-[200px]' : 'w-0'} 
                h-full overflow-hidden flex-shrink-0 border-r border-gray-800
            `}>
                <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
            </div>

            <main className="flex-1 overflow-y-auto relative h-full flex flex-col min-w-0">
                {/* Toggle Button for Sidebar when closed */}
                {!isSidebarOpen && (
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-[70] bg-blue-600/90 hover:bg-blue-500 p-2 pr-3 rounded-r-xl border-y border-r border-blue-400/50 text-white transition-all hover:pl-4 group shadow-[0_0_20px_rgba(37,99,235,0.4)] flex items-center gap-1 overflow-hidden"
                        title="Open Sidebar"
                    >
                        <svg className="w-6 h-6 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                )}

                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-yellow-500/5 rounded-full blur-[120px] pointer-events-none" />

                <div className="p-8 max-w-7xl mx-auto space-y-8 relative z-10 pt-16">
                    <div>
                        <h1 className="text-4xl font-black tracking-tight mb-2">Pre-Market Intelligence</h1>
                        <p className="text-gray-400">Real-time catalyst scoring for top pre-market movers.</p>
                    </div>

                    <PreMarketMovers />
                </div>
            </main>
        </div>
    );
}
