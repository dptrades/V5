import { NextResponse } from 'next/server';
import { scanConviction } from '@/lib/conviction';
import { scanSocialPulse } from '@/lib/social';
import { publicClient } from '@/lib/public-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    console.log("📥 [API/Pulse-360] GET request received");
    try {
        const { searchParams } = new URL(request.url);
        const forceRefresh = searchParams.get('refresh') === 'true';
        const marketSession = publicClient.getMarketSession();

        const [convictionStocks, socialPulseItems] = await Promise.all([
            scanConviction(forceRefresh, true).catch(err => {
                console.error("Error scanning conviction:", err);
                return [];
            }),
            scanSocialPulse(forceRefresh).catch(err => {
                console.error("Error scanning social pulse:", err);
                return [];
            })
        ]);

        const mergedMap = new Map<string, any>();

        // 1. Populate with conviction stocks first
        for (const stock of convictionStocks) {
            mergedMap.set(stock.symbol, {
                symbol: stock.symbol,
                name: stock.name,
                price: stock.price,
                change24h: stock.change24h,
                score: stock.score,
                technicalScore: stock.technicalScore,
                fundamentalScore: stock.fundamentalScore,
                analystScore: stock.analystScore,
                sentimentScore: stock.sentimentScore,
                volume: stock.volume,
                volumeDiff: stock.volumeDiff,
                reasons: stock.reasons,
                sector: stock.sector,
                suggestedOption: stock.suggestedOption,
                metrics: stock.metrics,
                
                // Social Pulse defaults
                heat: undefined,
                mentions: undefined,
                retailBuyRatio: undefined,
                topPlatform: undefined,
                description: undefined
            });
        }

        // 2. Merge social pulse items
        for (const item of socialPulseItems) {
            const existing = mergedMap.get(item.symbol);
            if (existing) {
                mergedMap.set(item.symbol, {
                    ...existing,
                    heat: item.heat,
                    mentions: item.mentions,
                    retailBuyRatio: item.retailBuyRatio,
                    topPlatform: item.topPlatform,
                    description: item.description,
                    _isHeuristic: item._isHeuristic // audit fix #4: false only when backed by real Finnhub Reddit/Twitter data
                });
            } else {
                mergedMap.set(item.symbol, {
                    symbol: item.symbol,
                    name: item.name,
                    price: item.price,
                    change24h: item.change,
                    score: undefined,
                    technicalScore: undefined,
                    fundamentalScore: undefined,
                    analystScore: undefined,
                    sentimentScore: Math.round(item.sentiment * 100),
                    volume: 0,
                    volumeDiff: undefined,
                    reasons: [],
                    sector: item.sector,
                    suggestedOption: undefined,
                    metrics: {
                        trend: 'NEUTRAL'
                    },
                    heat: item.heat,
                    mentions: item.mentions,
                    retailBuyRatio: item.retailBuyRatio,
                    topPlatform: item.topPlatform,
                    description: item.description,
                    _isHeuristic: item._isHeuristic
                });
            }
        }

        const mergedList = Array.from(mergedMap.values());

        return NextResponse.json({
            timestamp: new Date().toISOString(),
            count: mergedList.length,
            data: mergedList,
            isMarketClosed: marketSession === 'OFF'
        });
    } catch (error) {
        console.error("Error in pulse-360 API:", error);
        return NextResponse.json({ error: "Failed to fetch unified pulse 360 data" }, { status: 500 });
    }
}
