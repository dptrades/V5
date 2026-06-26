# AntiGravity Dashboard - Logic & Decision Engine Deep Dive

This document provides a transparent look at the algorithms, formulas, and decision-making logic powering the AntiGravity Dashboard.

---

## 1. Dashboard & Widgets Overview

### **A. Conviction Monitor (Main Grid)**
The central command center. It displays stocks ranked by their **Conviction Score**.
- **Data Source**: Real-time data from **Alpaca** (Price) and **Yahoo Finance** (Fundamentals/Options).
- **Update Frequency**: Live (Streaming prices) / 15-min interval for scores.
- **Visuals**:
  - **Conviction Score**: 0-100 Gauge.
  - **Trend Badge**: BULLISH / BEARISH based on EMA crossover.
  - **Sentiment Label**: Calculated from recent news headlines.
  - **Analyst Rating**: Consensus from Wall St. analysts.

### **B. Whale Watch (Sidebar)**
Tracks "Smart Money" institutional option flows.
- **Goal**: Identify large bets that often precede market moves.
- **Filtering Logic**:
  - **Filters**: Net Notional Value > **$100,000** OR Unusual Volume (>1.5x Open Interest).
  - **Ranking**: Alerts are sorted by `(Value * Unusualness)`.
- **Display**: Shows **CALL** or **PUT** icons, Strike Price, and Expiry.

### **C. Market Internals (Sidebar Bottom)**
Displays the "Health" of the broader market.
- **VIX (Fear Gauge)**: Green if falling (Bullish), Red if rising (Bearish).
- **Market Breadth**: Visual bar showing % of stocks Advancing vs Declining.
  - Calculated dynamically from the `ConvictionStock` dataset.

### **D. Auto-Trade Bot (Status Panel)**
Shows the status of the automated trading engine.
- **Active**: Bot is successfully scanning and executing.
- **Paused**: Market closed or error state.

---

## 2. Dashboards Logic Deep Dive

### **A. Weekly Top Picks (`/picks`)**
Designed for conservative, high-probability setups in Mega-Cap stocks.
- **Universe**: Hard-curated list of ~50 "Mega Cap" giants (Market Cap > $200B).
- **Core Names**: AAPL, MSFT, NVDA, GOOGL, AMZN, LLY, JPM, V.
- **Discovery**: Static (Discovery bonus manually disabled to maintain blue-chip focus).
- **Strategy**: Steady, reliable trend following for long-term swing trades.

### **B. Alpha Hunter (`/conviction`)**
Designed for aggressive growth and momentum discovery across the broader market.
- **Universe**: Broad watchlist of 150+ stocks + **Dynamic Smart Discovery**.
- **Smart Discovery**: Real-time scanner injects names triggering:
    - **Unusual Volume**: 1.5x+ relative to 1-year average.
    - **News Catalysts**: Major earnings beats or analyst upgrades.
    - **Breakouts**: Bollinger Band expansions.
- **Strategy**: Identifying momentum breakouts and speculative alpha-generating opportunities.

---

## 3. Secondary Widgets Logic

### **A. Crowd Sentiment (`HeaderSentiment`)**
Real-time "Mood Ring" for the active stock.
- **Source**: `app/page.tsx`'s `fetchStockNews()` → `/api/news` → `lib/news-service.ts`'s `getNewsData()`. This is Yahoo Finance headline search blended with Finnhub NLP bias — **not** Reddit or StockTwits; `lib/news.ts` is only the client-side fetch wrapper and `NewsItem` type, not a data source. (Audit fix #7: corrected — the previous text named Reddit/StockTwits, which aren't actually queried anywhere in this codebase.)
- **Algorithm**: Starts at 50. Each of the last several headlines contributes ±5 (recency-weighted, most-recent headline weighted heaviest, decaying to ±2.5 for the oldest), based on per-headline keyword + Finnhub NLP sentiment — not a raw "% positive headlines" threshold.
  - **Green/Bullish**: score ≥ 60.
  - **Red/Bearish**: score ≤ 40.
  - **Grey/Neutral**: 41-59.

### **B. Analyst Ratings (`HeaderAnalyst`)**
Tracks the flow of institutional upgrades/downgrades for the active stock. **This is a separate, single-stock detail-page widget — it is not the same mechanism as the "Analyst Score" pillar used in the Conviction Score / Alpha Hunter formulas below (see §4.A.3 for that).**
- **Source**: `app/page.tsx`'s `fetchAnalystRatings()` → `/api/news?type=analyst` → `lib/news-service.ts`'s `getNewsData()` (same Yahoo+Finnhub pipeline as Crowd Sentiment above, just news scoped toward analyst-related headlines).
- **Logic**: Counts headlines with "upgrade"/"raise"/"buy"/"outperform" vs "downgrade"/"cut"/"sell"/"underperform"/"lower" (verified accurate against `components/HeaderAnalyst.tsx`).
  - **Net Bullish**: More Upgrades than Downgrades.
  - **Net Bearish**: More Downgrades than Upgrades.
  - **Visuals**: Displays green/red ticks for each recent rating change.

### **C. Sector Heatmap (`/sectors`) - *Coming Soon***
Visual representation of capital flow across market sectors (Tech, Energy, Finance).

---

## 4. Decision Logic & Scoring Formulas

### **A. The Conviction Score (0-100)**
The "Master Score" is a weighted sum of up to 5 factors. **Top Picks and Alpha Hunter use different weights** (`lib/conviction.ts`'s `scanConviction()` and `scanAlphaHunter()`, respectively) — Top Picks excludes the Discovery term entirely, since it scans a static watchlist rather than a smart-scanned universe.

**Formula (Top Picks):**
`Score = (Technical * 30%) + (Fundamental * 25%) + (Analyst * 25%) + (Social * 20%)`

**Formula (Alpha Hunter):**
`Score = (Technical * 25%) + (Fundamental * 20%) + (Analyst * 10%) + (Social * 15%) + (Discovery * 30%)`

*(Audit fix #7: corrected — the previous single formula, `25/20/15/15/25`, matched neither scanner's actual weights in code.)*

#### **1. Technical Score** - *Trend & Momentum* (`lib/indicators.ts`'s `calculateConfluenceScore()`)
Bull/bear "votes" are tallied and netted into a 0-100 score; a risk-overlay penalty in `conviction.ts` is then applied on top.
| Condition | Points | Logic |
|-----------|--------|-------|
| **Price vs EMA50** | ±15 | Price above/below the 50-period EMA |
| **Price vs EMA200** | ±5 | Price above/below the 200-period EMA |
| **EMA Stack** | ±10 | EMA9 > EMA21 > EMA50 (bullish) or fully inverted (bearish) |
| **MACD Cross** | ±10 | MACD line above/below signal line |
| **RSI Momentum** | ±5 | RSI 60-70 → bullish vote; RSI 30-40 → bearish vote (the 70-80 and 20-30 extremes intentionally cast **no** momentum vote — see Overbought/Oversold below) |
| **RSI Divergence** | ±12 | Price vs. RSI moving in opposite directions over a 21-bar window, gated to require ≥1.5% price move and ≥3-point RSI move (tightened in audit fix #6 to suppress noise) |
| **Bollinger Bands** | ±5 to ±10 | Price outside the bands (±10, mean-reversion fade) or testing band/midline support-resistance (±5) |
| **Candlestick Pattern** | ±10 | Detected bullish/bearish reversal pattern (e.g. engulfing, hammer) |
| **Overbought penalty** | -10 | RSI > 80 — applied once, in `conviction.ts`, as a pure entry-timing risk flag. *(Audit fix #6: previously `indicators.ts` also cast a +5 "bullish momentum" vote for the same RSI>80 condition, directly contradicting this penalty; that vote was removed so RSI extremes are scored as risk, not trend confirmation, in exactly one place.)* |

#### **2. Fundamental Score** - *Quality & Value* (`lib/conviction.ts`)
| Metric | Points | Condition |
|--------|--------|-----------|
| **Growth** | +15 | Revenue Growth > 10% YoY |
| **Valuation** | +10 | PE Ratio between 0 and 40 |
| **Overvalued** | -10 | PE Ratio > 100 |
| **Margins** | +10 | Profit Margins > 20% |
| **EPS Growth** | +10 | EPS Growth > 10% YoY |
| **FCF Margin** | +10 | Free Cash Flow / Revenue > 15% |
| **Insider Ownership** | +5 | Insider ownership > 5% |
| **Leverage** | -10 | Debt-to-Equity > 2.0x (200%) |

*(Audit fix #7: removed a "Value (PEG) +10, PEG < 1.0" row — no PEG-ratio logic exists anywhere in the codebase. Corrected "Valuation" from +5 to the actual +10. Removed a "Safety +5, Debt-to-Equity < 100%" row — no positive bonus for low leverage exists; only the negative penalty above does. Added the EPS Growth, FCF Margin, and Insider Ownership bonuses, and the Leverage penalty, none of which appeared in this table before. Audit fix #3 also corrected a units bug in the Leverage check: Yahoo Finance returns `debtToEquity` on a 0-100+ percentage scale, e.g. `150` means a 1.5x ratio — the code previously compared that raw percentage value against a `2.0` threshold meant for a ratio, so it almost never fired. It's now normalized to a true ratio before comparing.)*

#### **3. Analyst Score** - *Wall Street Consensus* (`lib/conviction.ts`)
Distinct from the `HeaderAnalyst` headline-keyword widget in §3.B — this pillar is computed entirely from Yahoo Finance's `financialData` and `earningsTrend` modules, with no headline counting involved.
- **Base**: `financialData.recommendationMean` (1=Strong Buy ... 5=Sell) maps to a base score: ≤2.0 → 90 ("Strong Buy"), ≤3.0 → 70 ("Buy"), >4.0 → 20 ("Sell"), else → 50 ("Hold"). Defaults to 50 ("Neutral") if Yahoo has no coverage for the symbol.
- **Price-target upside bonus**: +10 if the analyst mean target price implies more than 10% upside over the current price.
- **EPS-surprise bonus**: +15 if the last 2+ quarters beat EPS estimates, +8 for exactly 1 beat (capped at 100 total).

*(Audit fix #7: this pillar previously had no breakdown in this document at all — the only "analyst" mechanism described anywhere was §3.B's headline-keyword widget, which could be misread as describing this scoring pillar too. They are unrelated.)*

#### **4. Social Sentiment** - *News-Headline NLP, not live social data*
- **Source**: `lib/news-service.ts`'s `getNewsData(symbol, 'social')` — same Yahoo headline + Finnhub NLP pipeline as §3.A/§3.B, run over general (not analyst-scoped) news. Despite the `'social'` argument name, this is **not** Reddit, Twitter/X, or StockTwits data.
- **Base**: Starts at 50 (Neutral); shifted by per-headline keyword/NLP sentiment, similar to §3.A.
- **Labeling**: >75 "Very Bullish", >60 "Bullish", <40 "Bearish".

*(Audit fix #4: real Reddit/Twitter mention data does exist in this codebase — via Finnhub's `/stock/social-sentiment` endpoint — but it's wired into the separate Social Pulse feature (`lib/social.ts`'s `scanSocialPulse()`), bounded to 5 symbols at a time for latency reasons, not into this scoring pillar. The UI labels for this pillar were relabeled "News Sentiment" accordingly.)*

#### **5. Smart Discovery (Alpha Hunter only — 30% weight; not used by Top Picks)** - *Hidden Gems*
Bonus points if the stock was "Discovered" by the Smart Scanner (`lib/smart-scanner.ts`) rather than just being on a static watchlist — the single largest weight in the Alpha Hunter formula.
- **Volume Spike / News Catalyst / Breakout signals**: feed into a normalized `strength` score (0-100) from the scanner, used directly as this pillar's value.

---

## 3. Decision Making: Option Strikes

The system suggests a specific option contract structure based on volatility (ATR).

### **Strike Price Selection**
We use **Average True Range (ATR)** to calculate a realistic target for the next 30 days.

- **BULLISH Trend**:
  - **Target**: Current Price + (1.0 x ATR).
  - **Strike**: Rounded to nearest $5.
  - *Example*: NVDA is $140. ATR is $5. Target $145. **Suggestion: $145 CALL**.

- **BEARISH Trend**:
  - **Target**: Current Price - (1.0 x ATR).
  - **Strike**: Rounded to nearest $5.
  - *Example*: TSLA is $200. ATR is $10. Target $190. **Suggestion: $190 PUT**.

### **Confidence Confluence**
The "Confidence" % for an option trade is adjusted by RSI:
- **Base Confidence**: 60%.
- **RSI Sweet Spot (40-65)**: +20% (Perfect momentum).
- **Overbought (>70)**: -30% (Don't buy calls at the top!).
- **Support Bounce**: +15% (If Price is bouncing off EMA50).

---

## 4. Auto-Trading Decisions

The Bot (`/api/auto-trade`) is the execution arm. It autonomously decides when to buy.

### **Entry Criteria** (Must meet ALL)
1.  **Trend**: Must be **BULLISH** (Price > EMA50 > EMA200).
2.  **Conviction**: Score must be **> 50**.
3.  **Excluded**: No Indices (SPY, QQQ) or Inverse ETFs.
4.  **Portfolio**: Max 4 positions allowed at once.

### **Risk Management**
- **Position Size**: Fixed **$250** per trade.
- **Stop Loss**: Hard set at **-10%**.
- **Take Profit**: Hard set at **+25%**.
- **Order Type**: Bracket Order (Entry + Profit/Stop exits attached).
