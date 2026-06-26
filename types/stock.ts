/**
 * Stock Types
 * Core types for stock scanning, conviction analysis, and discovery
 */

import type { OptionRecommendation } from './options';

/**
 * Stock discovered by the smart scanner
 */
export interface DiscoveredStock {
    symbol: string;
    name?: string;
    source: 'volume' | 'social' | 'news' | 'technical' | 'options';
    signal: string;
    strength: number; // 1-100
    timestamp: Date;
}

/**
 * Full conviction analysis result for a stock
 */
export interface ConvictionStock {
    symbol: string;
    name: string;
    price: number;
    score: number; // 0-100

    // Category Scores
    technicalScore: number;
    fundamentalScore: number;
    analystScore: number;
    sentimentScore: number;

    // Detailed Metrics
    metrics: {
        pe?: number; // undefined when Yahoo has no PE data — distinct from a real 0 (audit fix #8)
        marketCap?: number;
        revenueGrowth?: number; // YoY; undefined when unreported, not a real 0 (audit fix #8)
        pegRatio?: number; // Added
        debtToEquity?: number; // Added
        missingFundamentals?: string[]; // names of fundamental fields Yahoo had no data for (audit fix #8)
        rsi: number;
        macd?: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; // Added
        bollingerState?: string; // Added (e.g. "Squeeze", "Expansion")
        trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
        analystRating?: string; // "Strong Buy", etc.
        analystTarget?: number;
        socialSentiment: string; // "Bullish"
        atr14?: number; // ATR (or 2%-of-price proxy if unavailable) — used for ATR-anchored stop sizing (audit fix #2)
        ema50?: number; // 50-period EMA — secondary stop-loss anchor alongside ATR
    };

    reasons: string[];

    // Discovery source (if found by smart scanner)
    discoverySource?: 'volume' | 'social' | 'news' | 'technical' | 'options' | null;

    // Market Data
    change24h: number; // Percentage
    volume: number;
    volumeAvg1y?: number; // 1-year average volume
    volumeDiff?: number; // % difference from 1-year average
    sector?: string;
    suggestedOption?: OptionRecommendation;

    // Audit fix #8: cross-vendor price sanity check. _priceVerified is false when
    // Public.com/Alpaca and Yahoo Finance's independent price snapshots disagreed
    // by more than 2% (and the symbol is dropped entirely above 10% disagreement,
    // so it never reaches this type at all). priceDisagreementPct is the actual
    // gap when both vendors returned a usable price.
    _priceVerified?: boolean;
    priceDisagreementPct?: number;
}

/**
 * Scanned stock result (legacy, aliased to ConvictionStock for compatibility)
 */
export type ScannedStock = ConvictionStock;
