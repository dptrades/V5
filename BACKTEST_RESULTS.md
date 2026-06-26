# Technical-Score Backtest Results

Companion to `CODE_AUDIT_AND_IMPROVEMENTS.md`. Run before any scoring-weight changes, per request, to get a measurement baseline first.

## Scope

This tests **only** the technical score (`calculateConfluenceScore().strength` in `lib/indicators.ts`) against forward returns. It does not test the analyst score, social score, fundamental score, sector caps, or the full `scanConviction`/`scanAlphaHunter` pipelines — there's no lookahead-free historical source for point-in-time analyst/fundamental/social data. Technical score is the only component computable causally from OHLCV bars alone, so it's the only one a lightweight backtest can honestly evaluate.

## Method

- **Data**: 7 symbols (AAPL, NVDA, LLY, JPM, XOM, GE, SPY), daily bars, 2025-04-25 to 2026-06-24, split-adjusted, fetched fresh via the Robinhood MCP `get_equity_historicals` tool and converted to `OHLCVData[]`.
- **Indicators**: `calculateIndicators()` run once per symbol over the full causal series — it only ever looks backward at each bar, so one pass is equivalent to recomputing fresh at each historical date. No lookahead.
- **Scoring window**: starts at bar 50 (EMA50/RSI/MACD/Bollinger populated). EMA200 needs 200 bars and is unavailable before that; `calculateConfluenceScore()` already handles this in production by silently omitting the EMA200 contribution, so early-window scores are computed exactly as they'd be for a short-history listing.
- **Forward returns**: from each scored bar, find the next bar at or after +30/+60/+90 calendar days and measure close-to-close % return.
- **Benchmarks**: equal-weight average of the 6 non-SPY names (unconditional), and SPY (unconditional), both over the same horizons.
- **Score buckets**: anchored on the app's real gate — `scanConviction` requires `technicalScore >= 50`. Buckets: `<50`, `50–65`, `65–80`, `80–100`.

## Results

### 30-day forward return

| Bucket | n | Avg | Median | Win rate |
|---|---|---|---|---|
| <50 (below gate) | 377 | **+4.32%** | +4.02% | 70% |
| 50–65 (gate-pass, low) | 247 | +2.25% | +1.78% | 63% |
| 65–80 (gate-pass, mid) | 514 | +2.49% | +1.86% | 63% |
| 80–100 (gate-pass, high) | 188 | **+0.89%** | +0.75% | 53% |

Watchlist avg (unconditional): +2.74% (n=1326). SPY avg (unconditional): +1.71% (n=221). Correlation(score, return): **r = −0.152** (n=1326).

### 60-day forward return

| Bucket | n | Avg | Median | Win rate |
|---|---|---|---|---|
| <50 | 347 | **+7.34%** | +4.92% | 72% |
| 50–65 | 233 | +4.22% | +3.46% | 70% |
| 65–80 | 461 | +4.86% | +3.27% | 65% |
| 80–100 | 165 | **+3.89%** | +1.82% | 58% |

Watchlist avg: +5.32% (n=1206). SPY avg: +3.30% (n=201). Correlation: **r = −0.114** (n=1206).

### 90-day forward return

| Bucket | n | Avg | Median | Win rate |
|---|---|---|---|---|
| <50 | 289 | **+11.99%** | +9.93% | 85% |
| 50–65 | 219 | +4.92% | +3.54% | 68% |
| 65–80 | 423 | +6.11% | +3.19% | 67% |
| 80–100 | 154 | +5.84% | +3.08% | 60% |

Watchlist avg: +7.40% (n=1085). SPY avg: +4.06% (n=181). Correlation: **r = −0.180** (n=1085).

### Per-symbol correlation (checking no single name dominates the result)

| Symbol | r (30d) | r (60d) | r (90d) |
|---|---|---|---|
| AAPL | +0.055 | −0.005 | −0.020 |
| NVDA | −0.332 | −0.489 | −0.342 |
| LLY | +0.097 | −0.055 | −0.241 |
| JPM | −0.347 | −0.186 | −0.450 |
| XOM | −0.119 | +0.112 | −0.024 |
| GE | −0.423 | −0.234 | −0.478 |

4 of 6 names are negative at every horizon; AAPL and LLY are roughly flat at 30 days but turn negative by 90. No single stock is driving the aggregate result.

## Interpretation

The headline finding: **at every horizon tested, the lowest-scoring bucket (<50, the bucket that fails the app's own Top Picks gate) had the highest average forward return and the highest win rate.** The highest-conviction bucket (80–100 — exactly what `scanConviction` is built to surface) had the lowest or second-lowest average return every time. The score is **negatively correlated** with forward returns across this sample, not positively.

The likely mechanism: this 14-month window was a strong, fairly uninterrupted uptrend for most of these names (GE roughly +84%, NVDA and others also up sharply). `calculateConfluenceScore()` rewards already-extended moves — RSI > 80 scores as bullish, price stretched above the upper Bollinger Band scores as a "breakout," a bullish EMA stack scores high precisely when a move has been running for a while. In a trending-up market, names that look "stretched" (lower score, or scored as bearish/neutral on a pullback) tend to be names that dipped and then mean-reverted hard, while names already flashing every bullish signal at once had less room left to run before the next pullback. That's consistent with what the per-symbol breakdown shows.

This doesn't mean the score is useless — it means this specific scoring formula, in this specific regime, behaves more like a **late-cycle/overextension indicator** than a clean "buy more as conviction rises" signal. A formula that scores RSI>80 and price-above-upper-Bollinger as unambiguously bullish is, by construction, scoring late-stage moves as the most bullish — which is exactly backwards from how professional momentum/mean-reversion systems usually treat those same readings.

## Caveats

- **Single regime, ~14 months.** Most names here were in sustained uptrends. A chop or bear-market sample could flip this result. Don't generalize from one window.
- **7 symbols, not sector-balanced**, chosen because they were already in the watchlist/audit context, not randomly sampled.
- **No transaction costs, slippage, or position sizing.** This is a signal-quality check, not a strategy P&L simulation.
- **Technical score only** — says nothing about whether the analyst/fundamental/social components add value, or whether the full gated composite (`technicalScore>=50 AND analystScore>=50`) behaves differently than technical score alone.
- Sample sizes per bucket are workable (150–500) but not large; treat the magnitudes as directional, not precise.

## Implication for the fix list

This is a real, if preliminary, signal that the technical scoring formula's treatment of "overbought = bullish" and "stretched above bands = breakout" (audit finding #6 — the RSI contradiction) may not just be a labeling/semantics issue but an actual mis-calibration that the data agrees with. Worth keeping in mind when we get to fix #6, and worth re-running this backtest after that fix to see if the correlation flips.

## Artifacts

- `scripts/backtest-data/raw/*.json` — raw fetched bars (7 symbols)
- `scripts/backtest-data/*.json` — converted `OHLCVData[]`
- `scripts/convert-backtest-data.ts` — raw → `OHLCVData[]` converter
- `scripts/backtest-technical-score.ts` — the backtest itself (run with `npx tsx scripts/backtest-technical-score.ts`; `ts-node` doesn't work in this Node version due to an ESM/extension-resolution incompatibility with the `technicalindicators` package's candlestick submodules — `tsx` sidesteps it)
- `scripts/backtest-results.json` — raw per-bar score/forward-return points
