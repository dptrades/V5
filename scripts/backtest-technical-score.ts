/**
 * Lightweight technical-score backtest.
 *
 * SCOPE (read this before interpreting results):
 *   This backtest measures ONLY the technical-score component
 *   (calculateConfluenceScore().strength, from lib/indicators.ts) against forward
 *   returns. It does NOT backtest the analyst score, social score, fundamental
 *   score, sector caps, position sizing, or the full scanConviction/scanAlphaHunter
 *   pipelines. Those components depend on point-in-time analyst/fundamental/social
 *   data we don't have a historical, lookahead-free source for. The technical
 *   score is the only score component computable causally from OHLCV bars alone,
 *   so it's the only one a "lightweight" backtest can honestly evaluate.
 *
 * METHOD:
 *   For each symbol, run calculateIndicators() ONCE over the full causal bar
 *   series (this function only ever looks backward at each index, so a single
 *   pass is equivalent to running it fresh at each historical date — no lookahead).
 *   Starting at bar 50 (so EMA50/RSI/MACD/Bollinger are populated; EMA200 needs
 *   200 bars and is unavailable before that — calculateConfluenceScore() already
 *   handles this by silently omitting the EMA200 contribution, exactly as it
 *   would in production for a young listing or short data window), compute the
 *   confluence score at every bar, then look forward 30/60/90 CALENDAR days from
 *   that bar's timestamp to find the next bar at or after that date and measure
 *   the close-to-close return.
 *
 * CAVEATS (also restated in the report):
 *   - Single ~14-month window (2025-04-25 to 2026-06-24), one historical regime.
 *     Several names here (GE, NVDA) were in strong uptrends most of this period,
 *     which can make "high score -> positive forward return" look better than it
 *     would in a chop/bear regime. Do not generalize from this alone.
 *   - 7 symbols only (AAPL, NVDA, LLY, JPM, XOM, GE, SPY) — small, not
 *     sector-balanced, not survivorship-bias-checked beyond "still trades today."
 *   - No transaction costs, slippage, or position sizing modeled — this is a
 *     signal-quality check, not a strategy P&L simulation.
 */
import { calculateIndicators, calculateConfluenceScore } from '../lib/indicators';
import { OHLCVData } from '../types/financial';
import * as fs from 'fs';
import * as path from 'path';

// Run from the V5 project root (npx ts-node scripts/backtest-technical-score.ts).
const DATA_DIR = path.join(process.cwd(), 'scripts', 'backtest-data');
const SYMBOLS = ['AAPL', 'NVDA', 'LLY', 'JPM', 'XOM', 'GE', 'SPY'];
const HORIZONS = [30, 60, 90]; // calendar days
const MIN_LOOKBACK = 50; // bars before scoring starts (EMA50 ready)
const DAY_MS = 24 * 60 * 60 * 1000;

interface ScorePoint {
  symbol: string;
  date: string;
  score: number;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  forwardReturns: Record<number, number | null>; // horizon(days) -> % return, null if not enough future data
}

function loadSymbol(symbol: string): OHLCVData[] {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${symbol}.json`), 'utf-8'));
}

// First bar at/after (fromTime + days). Returns null if the series doesn't reach that far.
function findForwardBar(data: OHLCVData[], fromIdx: number, days: number): OHLCVData | null {
  const targetTime = data[fromIdx].time + days * DAY_MS;
  for (let j = fromIdx + 1; j < data.length; j++) {
    if (data[j].time >= targetTime) return data[j];
  }
  return null;
}

function backtestSymbol(symbol: string): ScorePoint[] {
  const data = loadSymbol(symbol);
  const indicators = calculateIndicators(data, 'none');
  const points: ScorePoint[] = [];

  for (let i = MIN_LOOKBACK; i < data.length; i++) {
    const result = calculateConfluenceScore(indicators[i]);
    const forwardReturns: Record<number, number | null> = {};
    for (const h of HORIZONS) {
      const fwdBar = findForwardBar(data, i, h);
      forwardReturns[h] = fwdBar ? ((fwdBar.close - data[i].close) / data[i].close) * 100 : null;
    }
    points.push({
      symbol,
      date: new Date(data[i].time).toISOString().slice(0, 10),
      score: result.strength,
      trend: result.trend,
      forwardReturns,
    });
  }
  return points;
}

// ---- Stats helpers ----
function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}
function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function winRate(xs: number[]): number {
  return xs.length ? (xs.filter((x) => x > 0).length / xs.length) * 100 : NaN;
}
function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return NaN;
  const mx = mean(xs), my = mean(ys);
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? NaN : num / denom;
}

// Score buckets anchored on the app's actual gating threshold (technicalScore >= 50
// is required to even appear in scanConviction's Top Picks).
const BUCKETS: { label: string; lo: number; hi: number }[] = [
  { label: '<50 (below gate)', lo: -Infinity, hi: 50 },
  { label: '50-65 (gate-pass, low)', lo: 50, hi: 65 },
  { label: '65-80 (gate-pass, mid)', lo: 65, hi: 80 },
  { label: '80-100 (gate-pass, high)', lo: 80, hi: Infinity },
];

function main() {
  console.log('='.repeat(78));
  console.log('LIGHTWEIGHT TECHNICAL-SCORE BACKTEST');
  console.log('Scope: technical score (calculateConfluenceScore.strength) only.');
  console.log('='.repeat(78));

  const allPoints: ScorePoint[] = [];
  for (const symbol of SYMBOLS) {
    const points = backtestSymbol(symbol);
    allPoints.push(...points);
    console.log(`  ${symbol.padEnd(5)} -> ${points.length} scored bars`);
  }
  console.log(`\nTotal scored bars across all symbols: ${allPoints.length}\n`);

  const nonSpyPoints = allPoints.filter((p) => p.symbol !== 'SPY');
  const spyPoints = allPoints.filter((p) => p.symbol === 'SPY');

  for (const h of HORIZONS) {
    console.log('-'.repeat(78));
    console.log(`HORIZON: ${h} calendar days forward`);
    console.log('-'.repeat(78));

    // Unconditional benchmarks
    const allReturns = allPoints.map((p) => p.forwardReturns[h]).filter((r): r is number => r !== null);
    const watchlistReturns = nonSpyPoints.map((p) => p.forwardReturns[h]).filter((r): r is number => r !== null);
    const spyReturns = spyPoints.map((p) => p.forwardReturns[h]).filter((r): r is number => r !== null);

    console.log(`  Watchlist avg fwd return (all 6 non-SPY names, unconditional): ${mean(watchlistReturns).toFixed(2)}%  (n=${watchlistReturns.length})`);
    console.log(`  SPY avg fwd return (unconditional, same horizon):              ${mean(spyReturns).toFixed(2)}%  (n=${spyReturns.length})`);

    // Score correlation (non-SPY only, to avoid the benchmark contaminating the signal test)
    const scores = nonSpyPoints.map((p) => p.score);
    const returnsForCorr = nonSpyPoints.map((p) => p.forwardReturns[h]);
    const pairedScores: number[] = [];
    const pairedReturns: number[] = [];
    for (let i = 0; i < scores.length; i++) {
      const r = returnsForCorr[i];
      if (r !== null) {
        pairedScores.push(scores[i]);
        pairedReturns.push(r);
      }
    }
    console.log(`  Pearson correlation(score, fwd return), non-SPY names:        r=${pearson(pairedScores, pairedReturns).toFixed(3)}  (n=${pairedScores.length})`);

    console.log(`\n  By score bucket (non-SPY names):`);
    for (const bucket of BUCKETS) {
      const inBucket = nonSpyPoints.filter((p) => p.score >= bucket.lo && p.score < bucket.hi);
      const rets = inBucket.map((p) => p.forwardReturns[h]).filter((r): r is number => r !== null);
      if (rets.length === 0) {
        console.log(`    ${bucket.label.padEnd(26)} n=0`);
        continue;
      }
      console.log(
        `    ${bucket.label.padEnd(26)} n=${String(rets.length).padEnd(4)} avg=${mean(rets).toFixed(2)}%  median=${median(rets).toFixed(2)}%  winRate=${winRate(rets).toFixed(0)}%`
      );
    }
    console.log(`  Per-symbol correlation(score, fwd return) — checking if one name dominates:`);
    for (const symbol of SYMBOLS) {
      if (symbol === 'SPY') continue;
      const symPoints = nonSpyPoints.filter((p) => p.symbol === symbol);
      const sScores = symPoints.map((p) => p.score);
      const sReturns = symPoints.map((p) => p.forwardReturns[h]);
      const ps: number[] = [], pr: number[] = [];
      for (let i = 0; i < sScores.length; i++) {
        const r = sReturns[i];
        if (r !== null) { ps.push(sScores[i]); pr.push(r); }
      }
      console.log(`    ${symbol.padEnd(5)} r=${pearson(ps, pr).toFixed(3)}  avgReturn=${mean(pr).toFixed(2)}%  (n=${ps.length})`);
    }
    console.log('');
  }

  // Persist raw results for the report / further inspection
  const outPath = path.join(process.cwd(), 'scripts', 'backtest-results.json');
  fs.writeFileSync(outPath, JSON.stringify(allPoints, null, 2));
  console.log(`Raw score/return points written to: ${outPath}`);
}

main();
