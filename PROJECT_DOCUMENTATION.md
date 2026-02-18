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
- **Source**: `lib/news.ts` -> Google News / Reddit / StockTwits.
- **Algorithm**: Keyword matching on last 48h headlines.
  - **Green/Bullish**: > 60% positive keywords (*surge, rally, beat*).
  - **Red/Bearish**: < 40% positive keywords (*crash, miss, dump*).
  - **Grey/Neutral**: 40-60%.

### **B. Analyst Ratings (`HeaderAnalyst`)**
Tracks the flow of institutional upgrades/downgrades.
- **Source**: `lib/news.ts` (Analyst specific queries).
- **Logic**: Counts headlines with "Upgrade"/"Raise" vs "Downgrade"/"Cut".
  - **Net Bullish**: More Upgrades than Downgrades.
  - **Net Bearish**: More Downgrades than Upgrades.
  - **Visuals**: Displays green/red ticks for each recent rating change.

### **C. Sector Heatmap (`/sectors`) - *Coming Soon***
Visual representation of capital flow across market sectors (Tech, Energy, Finance).

---

## 4. Decision Logic & Scoring Formulas

### **A. The Conviction Score (0-100)**
The "Master Score" is a weighted sum of 5 distinct factors.

**Formula:**
`Score = (Technical * 25%) + (Fundamental * 20%) + (Analyst * 15%) + (Social * 15%) + (Discovery * 25%)`

#### **1. Technical Score (25%)** - *Trend & Momentum*
| Condition | Points | Logic |
|-----------|--------|-------|
| **Uptrend** | +15 | Price > EMA50 > EMA200 (Golden alignment) |
| **Downtrend** | -15 | Price < EMA50 (Weakness) |
| **MACD Bull** | +10 | MACD Line > Signal Line (Momentum Shift) |
| **RSI Bull** | +5 | RSI between 50-70 (Healthy Strength) |
| **Oversold** | +10 | RSI < 30 (Bounce Potential) |
| **Overbought** | -10 | RSI > 80 (Pullback Risk) |
| **Bollinger** | +10 | Price Breaking Upper Band (Volatility Breakout) |

#### **2. Fundamental Score (20%)** - *Quality & Value*
| Metric | Points | Condition |
|--------|--------|-----------|
| **Growth** | +15 | Revenue Growth > 10% YoY |
| **Valuation** | +5 | PE Ratio < 40 (Reasonable) |
| **Overvalued** | -10 | PE Ratio > 100 |
| **Value (PEG)** | +10 | PEG Ratio < 1.0 (Undervalued Growth) |
| **Margins** | +10 | Profit Margins > 20% (Cash Cow) |
| **Safety** | +5 | Debt-to-Equity < 100% |

#### **3. Social Sentiment (15%)** - *Hype & Chatter*
Scans Google News, Reddit, and StockTwits for recent headlines.
- **Base**: Starts at 50 (Neutral).
- **Keywords**:
  - **Positive (+10)**: `surge`, `jump`, `soar`, `rally`, `beat`, `buy`, `upgrade`, `moon`, `yolo`, `calls`.
  - **Negative (-10)**: `drop`, `fall`, `plunge`, `miss`, `downgrade`, `crash`, `puts`, `dumps`.
- **Labeling**:
  - **>75**: "Very Bullish"
  - **>60**: "Bullish"
  - **<40**: "Bearish"

#### **4. Smart Discovery (25%)** - *Hidden Gems*
Bonus points if the stock was "Discovered" by the Smart Scanner rather than just being on a static watchlist.
- **Volume Spike**: +100 Strength (Normalized to score).
- **News Catalyst**: "Earnings Beat" or "Upgrade" headlines.

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
