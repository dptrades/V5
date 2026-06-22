"use client";

import React, { useEffect, useState } from 'react';
import { Flame, ExternalLink, Radio } from 'lucide-react';

interface BreakingNewsItem {
    id: string | number;
    headline: string;
    source: string;
    datetime: number;
    url: string;
}

export default function BreakingNewsTicker() {
    const [news, setNews] = useState<BreakingNewsItem[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchNews = async () => {
        try {
            const res = await fetch('/api/breaking-news');
            if (res.ok) {
                const json = await res.json();
                setNews(json.data || []);
            }
        } catch (e) {
            console.error("Failed to fetch breaking news", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNews();
        // Poll every 5 minutes
        const timer = setInterval(fetchNews, 5 * 60 * 1000);
        return () => clearInterval(timer);
    }, []);

    if (loading || news.length === 0) return null;

    // Double the array to make the infinite marquee loop seamlessly
    const marqueeItems = [...news, ...news];

    return (
        <div className="bg-[#180a0b] border-b border-red-500/20 text-red-200 text-xs h-9 flex items-center overflow-hidden z-40 relative select-none w-full">
            {/* Flashing Breaking Badge */}
            <div className="bg-red-600 text-white font-black px-3.5 h-full flex items-center gap-1.5 uppercase tracking-widest text-[10px] shrink-0 border-r border-red-500/30 shadow-[0_0_15px_rgba(220,38,38,0.3)] z-10 relative">
                <Radio className="w-3.5 h-3.5 animate-pulse text-white" />
                <span>Breaking</span>
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping absolute top-1 right-1"></span>
            </div>

            {/* Marquee Wrapper */}
            <div className="marquee-container flex-1 overflow-hidden relative h-full flex items-center">
                <div className="marquee-content flex items-center gap-16 pr-16">
                    {marqueeItems.map((item, index) => (
                        <a
                            key={`${item.id}-${index}`}
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-white flex items-center gap-2 hover:underline transition-colors shrink-0 font-medium"
                            title={`Read on ${item.source}`}
                        >
                            <span className="text-[10px] text-red-400/80 font-bold uppercase tracking-wider">[{item.source}]</span>
                            <span>{item.headline}</span>
                            <ExternalLink className="w-3 h-3 text-red-500/60" />
                        </a>
                    ))}
                </div>
            </div>

            {/* Injected marquee keyframe style */}
            <style jsx global>{`
                @keyframes marquee {
                    0% {
                        transform: translate3d(0, 0, 0);
                    }
                    100% {
                        transform: translate3d(-50%, 0, 0);
                    }
                }
                .marquee-content {
                    animation: marquee 60s linear infinite;
                }
                .marquee-container:hover .marquee-content {
                    animation-play-state: paused;
                }
            `}</style>
        </div>
    );
}
