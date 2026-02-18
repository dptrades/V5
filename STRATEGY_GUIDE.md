# Strategy Guide: Widget Logic & Methodology

This guide explains the underlying math and data logic for every component on the dashboard.

---

## 1. Hybrid Power Setup (Architecture)

To ensure maximum fidelity, the dashboard uses a **Hybrid Multi-Source** architecture. This avoids "single point of failure" issues and leverages the specific strengths of each provider.

| Component | Primary Source | Why? |
| :--- | :--- | :--- |
| **Technicals (Matrix/Charts)** | **Alpaca** | High-fidelity adjusted historical bars (splits/dividends). |
| **Options (Flow/Greeks)** | **Public.com** | Brokerage-grade Greeks (Delta), live IV, and aggregate volume. |
| **Live Price** | **Public.com** | Superior extended-hours (Pre/Post) brokerage feed. |
| **Fundamentals** | **Yahoo Finance** | Global analyst and target price consensus. |

---

## 1. Top Picks vs. Alpha Hunter

### **A. Top Picks (Mega-Cap Stability)**
- **Universe**: Curated list of ~60 Mega-Cap stocks from the **S&P 500** and **Nasdaq 100** (Market Cap > $200B).
- **Strategy**: Focused on high-liquidity, institutional "must-own" companies.
- **Scoring Model**:
    - **Technicals (25%)**: Trend alignment (Price vs 50/200 EMA) + RSI/MACD confluence.
    - **Fundamentals (20%)**: Revenue growth, P/E ratios, and profit margins.
    - **Analyst Flow (15%)**: Consensus rating + price target upside.
    - **Social Sentiment (15%)**: Real-time news/social sentiment score.
    - **Institutional Weight (25%)**: Stability bonus for blue-chip status.

### **B. Alpha Hunter (Growth & Momentum)**
- **Universe**: Broader market scan including growth stocks, mid-caps, and momentum favorites (e.g., PLTR, SOFI, CRWD).
- **Strategy**: Aggressively seeks outperformance by tracking smaller, faster-moving companies.
- **Smart Discovery**: Uses a dynamic scanner to find "Unusual Activity" or "Breakout Patterns" from a broader watchlist.
- **Scoring Model**: Identical weights to Top Picks, but with a **25% Discovery Bonus** awarded to stocks found via dynamic scanning rather than a static watchlist.

---

## 1. Header Widgets (Quick Glance)

### **Market Signals**
- **ST Trend**: Short-term trend based on the **50-day EMA**. Bullish if price > EMA50.
- **LT Trend**: Long-term trend based on the **200-day EMA**. Bullish if price > EMA200.
- **Golden Cross**: A yellow star appears if the 50-day EMA crosses above the 200-day EMA.
- **Indicators**:
    - **RSI**: Overbought (OB) > 70, Oversold (OS) < 30.
    - **MACD**: BULL if MACD Line > Signal Line.
    - **BB (Bollinger)**: OB if price > Upper Band, OS if price < Lower Band.
    - **ADX**: Measures trend strength (STR > 25, EXT > 40).
    - **VWAP**: Signals if price is above or below Volume Weighted Average Price.

### **Pattern Detector**
- **Logic**: Scans the most recent two candles for specific shapes.
    - **Doji**: Body size is < 10% of total range.
    - **Hammer/Shooting Star**: Reversal candles with long wicks.
    - **Engulfing**: Current body completely engulfs the previous one.

### **Analyst Flow**
- **Logic**: Sentiment scan of the last 20 analyst-related news headlines.
- **Scoring**: Keywords like "Upgrade" or "Buy" add to Bullish flow; "Cut" or "Sell" lead to Bearish flow.

---

## 2. Deep Dive Analysis

### **Technical Confluence Matrix**
- **Scope**: Monitors 4 critical timeframes concurrently (10M, 1H, 1D, 1W).
- **Near Detection**: Highlights a cell as **NEAR** if the price is within **0.5%** of a major EMA. These are high-probability support/resistance zones.

### **AI Signal (/10 Score)**
A weighted model that aggregates multi-source data:
1.  **Technicals (50%)**: Daily/Hourly trend alignment + RSI context.
2.  **Fundamentals (30%)**: Analyst consensus (Buy/Sell) + Upside targets.
3.  **Options/Volume (20%)**: Large call/put volume bias + Institutional volume spikes.

---

## 3. Options AI (Tactical Plays)

### **Trade Plan Generation**
- **Direction**: Triggered when the "EMA Stack" (9/21/50) aligns with RSI and MACD crosses.
- **Strike Selection**: Automatically rounds to the nearest viable strike. Uses a **0.5 * ATR** offset.
- **Risk Management**:
    - **Target Price**: Entry + (2 * ATR). Aiming for 2x daily volatility.
    - **Stop Loss**: Entry - (1 * ATR). 
    - **Result**: A built-in **2:1 Reward-to-Risk ratio**.

### **Probability ITM**
- Calculated using **Greeks (Delta)** from live Public.com data. 
- If live data is unavailable, it estimates probability based on the distance from strike and historical volatility (IV Proxy).

---

## 4. Sector Performance

- **Universe**: Tracks ~100 core equities across 11 GICS sectors.
- **Logic**: Calculates the average 24-hour percentage change for all stocks within a sector.
- **Utility**: Helps identify which sectors are leading or lagging the market.

---

## 5. Target Price Logic

### **AI Signal Target (Institution/Consensus)**
- **Source**: Aggregate Wall St. Mean Target.
- **Use Case**: Long-term "Fair Value" over the next 12 months.

### **Options AI Target (Technical/Tactical)**
- **Source**: ATR-based calculation.
- **Use Case**: Short-term exit target for high-probability setups.

---

## 7. Data Sources & Consistency

| Data Type | Primary Source | Logic |
| :--- | :--- | :--- |
| **Stock Trends** | Alpaca | Adjusted for 200+ days of historical context. |
| **Option Greeks** | Public.com | Real-time Delta/Theta derived from brokerage flow. |
| **Put/Call Ratio** | Public.com | Aggregate volume scan across all liquid expiries. |
| **Price Targets** | Yahoo Finance | Mean aggregate from Top Wall St. Analysts. |
| **News/Sentiment** | Finnhub/RSS | Scanned via NLP for bullish/bearish keyword density. |
