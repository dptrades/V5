import { NewsItem } from './news';
import { finnhubClient } from './finnhub';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

// --- News Cache ---
// Store news results for 30 minutes to heavily reduce Yahoo API load during 300-stock Alpha Hunter scans
interface NewsCacheEntry {
    data: NewsItem[];
    expiry: number;
}
const newsCache = new Map<string, NewsCacheEntry>();
const NEWS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export async function getNewsData(symbol: string, type: 'news' | 'social' | 'analyst' = 'news'): Promise<NewsItem[]> {
    // Check Cache
    const cacheKey = `${symbol}-${type}`;
    const cached = newsCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
        return cached.data;
    }

    try {
        // Fetch articles and Finnhub NLP sentiment in parallel. 
        // We use a 3-second timeout for sentiment since Finnhub can hang when rate limited.
        const sentimentPromise = finnhubClient.getNewsSentiment(symbol).catch(() => null);
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));

        const [results, finnhubSentiment] = await Promise.all([
            yahooFinance.search(symbol, { newsCount: 20 }),
            Promise.race([sentimentPromise, timeoutPromise])
        ]);

        if (!results.news || results.news.length === 0) {
            return [];
        }

        // Derive overall bias from Finnhub NLP if available
        let nlpBias: 'positive' | 'negative' | 'neutral' = 'neutral';
        if (finnhubSentiment?.sentiment) {
            const { bullishPercent, bearishPercent } = finnhubSentiment.sentiment;
            if (bullishPercent > 0.6) nlpBias = 'positive';
            else if (bearishPercent > 0.6) nlpBias = 'negative';
        }

        const now = Date.now();
        const SEVENTY_TWO_HOURS = 72 * 60 * 60 * 1000;
        const symbolUpper = symbol.toUpperCase();

        const seen = new Set<string>();
        const items: NewsItem[] = results.news
            .filter((article: any) => {
                if (!article.title || !article.link) return false;

                // Deduplicate by title
                const key = article.title.toLowerCase().trim();
                if (seen.has(key)) return false;
                seen.add(key);

                // Filter: only articles from the last 72 hours
                if (article.providerPublishTime) {
                    const publishedMs = new Date(article.providerPublishTime).getTime();
                    if (now - publishedMs > SEVENTY_TWO_HOURS) return false;
                }

                return true;
            })
            .sort((a: any, b: any) => {
                // Prioritize: related articles first, then by recency
                const aTitle = (a.title || '').toLowerCase();
                const bTitle = (b.title || '').toLowerCase();
                const symLower = symbol.toLowerCase();
                const aRelated = aTitle.includes(symLower) ||
                    (a.relatedTickers || []).some((t: string) => t.toUpperCase() === symbolUpper);
                const bRelated = bTitle.includes(symLower) ||
                    (b.relatedTickers || []).some((t: string) => t.toUpperCase() === symbolUpper);

                if (aRelated && !bRelated) return -1;
                if (!aRelated && bRelated) return 1;

                // Then sort by recency
                const aTime = new Date(a.providerPublishTime || 0).getTime();
                const bTime = new Date(b.providerPublishTime || 0).getTime();
                return bTime - aTime;
            })
            .slice(0, 6) // Top 6 articles
            .map((article: any, i: number) => {
                const title = article.title || '';
                const titleLower = title.toLowerCase();
                let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';

                // Improved Sentiment: Use Finnhub NLP bias as base, then refine with keywords
                const bullishWords = ['surge', 'jump', 'rally', 'gain', 'rise', 'beat', 'bull', 'boost', 'soar', 'upgrade', 'breakout', 'record', 'strong', 'outperform', 'buy'];
                const bearishWords = ['drop', 'fall', 'decline', 'slip', 'loss', 'bear', 'cut', 'warn', 'crash', 'plunge', 'sell', 'downgrade', 'risk', 'concern', 'weak', 'underperform'];

                const hasBullish = bullishWords.some(w => titleLower.includes(w));
                const hasBearish = bearishWords.some(w => titleLower.includes(w));

                if (hasBullish && !hasBearish) sentiment = 'positive';
                else if (hasBearish && !hasBullish) sentiment = 'negative';
                else if (!hasBullish && !hasBearish) sentiment = nlpBias; // Use Finnhub NLP when keywords are ambiguous
                // If both bullish & bearish keywords are present, stay neutral

                // providerPublishTime is already a Date object
                const publishedAt = article.providerPublishTime
                    ? new Date(article.providerPublishTime)
                    : new Date();

                // Relative time
                const diffMs = now - publishedAt.getTime();
                const diffMins = Math.floor(diffMs / (1000 * 60));
                const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                let timeStr: string;
                if (diffMins < 60) {
                    timeStr = `${Math.max(1, diffMins)}m ago`;
                } else if (diffHours < 24) {
                    timeStr = `${diffHours}h ago`;
                } else {
                    const diffDays = Math.floor(diffHours / 24);
                    timeStr = `${diffDays}d ago`;
                }

                return {
                    id: `news-${i}-${article.uuid || i}`,
                    title,
                    source: article.publisher || 'Yahoo Finance',
                    time: timeStr,
                    sentiment,
                    url: article.link
                };
            });

        // Save to Cache
        newsCache.set(cacheKey, { data: items, expiry: Date.now() + NEWS_CACHE_TTL });

        return items;

    } catch (error) {
        console.error(`Failed to fetch news for ${symbol}:`, error);
        return [];
    }
}
