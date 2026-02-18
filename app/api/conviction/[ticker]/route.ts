import { NextResponse } from 'next/server';
import { fetchMultiTimeframeAnalysis } from '@/lib/market-data';
import { scanUnusualOptions } from '@/lib/options-flow';
import { fetchPriceStats } from '@/lib/price-stats';
import { getPutCallRatio } from '@/lib/options';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

// Force dynamic mode so it fetches live data
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ ticker: string }> }) {
    try {
        const { ticker } = await context.params;
        const { searchParams } = new URL(request.url);
        const skipCache = searchParams.get('refresh') === 'true';

        if (!ticker) {
            return NextResponse.json({ error: "Ticker is required" }, { status: 400 });
        }

        const symbol = ticker.toUpperCase();
        console.log(`🔍 Fetching deep dive for ${symbol}...`);

        // Run concurrently with error handling
        const [analysisResult, optionsFlowResult, fundamentalsResult, priceStatsResult, pcrResult] = await Promise.allSettled([
            fetchMultiTimeframeAnalysis(symbol, skipCache),
            scanUnusualOptions(symbol),
            yahooFinance.quoteSummary(symbol, { modules: ['summaryDetail', 'financialData', 'defaultKeyStatistics'] }),
            fetchPriceStats(symbol),
            getPutCallRatio(symbol, skipCache)
        ]);

        const analysis = analysisResult.status === 'fulfilled' ? analysisResult.value : null;
        const optionsFlow = optionsFlowResult.status === 'fulfilled' ? optionsFlowResult.value : [];
        const fundamentalsRaw = fundamentalsResult.status === 'fulfilled' ? (fundamentalsResult.value as any) : null;
        const priceStats = priceStatsResult.status === 'fulfilled' ? priceStatsResult.value : null;
        const pcrData = pcrResult.status === 'fulfilled' ? pcrResult.value : null;

        if (analysisResult.status === 'rejected') {
            console.error(`Analysis failed`, analysisResult.reason);
        }
        if (optionsFlowResult.status === 'rejected') {
            console.error(`Options scan failed`, optionsFlowResult.reason);
        }
        if (fundamentalsResult.status === 'rejected') {
            console.error(`Fundamentals failed`, fundamentalsResult.reason);
        }

        if (!analysis) {
            return NextResponse.json({ error: "Failed to fetch market data" }, { status: 500 });
        }

        return NextResponse.json({
            symbol,
            displayPrice: analysis.currentPrice,
            headerPrice: analysis.headerPrice,
            analysis,
            optionsFlow,
            priceStats,
            fundamentals: fundamentalsRaw ? {
                marketCap: fundamentalsRaw.summaryDetail?.marketCap,
                peRatio: fundamentalsRaw.summaryDetail?.trailingPE,
                forwardPE: fundamentalsRaw.summaryDetail?.forwardPE,
                beta: fundamentalsRaw.summaryDetail?.beta,
                dividendYield: fundamentalsRaw.summaryDetail?.dividendYield,
                targetMeanPrice: fundamentalsRaw.financialData?.targetMeanPrice,
                recommendationKey: fundamentalsRaw.financialData?.recommendationKey, // e.g., "buy", "hold"
                obs: fundamentalsRaw.financialData?.numberOfAnalystOpinions
            } : {},
            putCallRatio: pcrData
        }, {
            headers: {
                'Cache-Control': 'no-store, max-age=0, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });

    } catch (error) {
        console.error("Error in conviction detail API:", error);
        return NextResponse.json({ error: "Failed to fetch conviction details" }, { status: 500 });
    }
}
