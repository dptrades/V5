import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { calculateIndicators } from '@/lib/indicators';
import { fetchAlpacaBars, fetchAlpacaPrice } from '@/lib/alpaca';
import { finnhubClient } from '@/lib/finnhub';
import fs from 'fs';
import path from 'path';

const yahooFinance = new YahooFinance();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const HISTORY_FILE = path.join(process.cwd(), 'data', 'terminal_history.json');

function loadHistory(): Record<string, number[]> {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    }
  } catch (e) { console.error("[Terminal] Failed to load history", e); }
  return {};
}

function saveHistory(history: Record<string, number[]>) {
  try {
    if (!fs.existsSync(path.dirname(HISTORY_FILE))) {
      fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
    }
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (e) { console.error("[Terminal] Failed to save history", e); }
}

// In-memory score history (initialized from file)
let scoreHistory: Record<string, number[]> = loadHistory();

// ── 60-second response cache (key = `${benchmark}-${mode}`) ────────────────────
const CACHE_TTL_MS = 60_000;
interface CacheEntry { data: any; ts: number; }
const apiCache = new Map<string, CacheEntry>();

function getCached(key: string): any | null {
  const entry = apiCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { apiCache.delete(key); return null; }
  return entry.data;
}
function setCache(key: string, data: any) {
  apiCache.set(key, { data, ts: Date.now() });
}

// ── Alpaca bar → our bar format ──────────────────────────────────────────────
function alpacaToBar(b: any) {
  return { time: new Date(b.t).getTime(), open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v };
}

// ── Finnhub single quote (VIX, TNX, DXY proxies) ────────────────────────────
async function fetchFinnhubQuote(symbol: string): Promise<{ price: number; changePercent: number } | null> {
  try {
    const d = await finnhubClient.getQuote(symbol);
    if (!d || !d.c) return null;
    return { price: d.c, changePercent: d.dp ?? 0 };
  } catch { return null; }
}

// ── Alpaca latest quote (ETF price + change%) ────────────────────────────────
async function fetchAlpacaQuote(symbol: string): Promise<{ price: number; changePercent: number; changeAmount: number } | null> {
  try {
    const apiKey = process.env.ALPACA_API_KEY || '';
    const apiSecret = process.env.ALPACA_API_SECRET || '';
    if (!apiKey || !apiSecret) return null;
    // Use snapshot which includes prev_daily_bar for change%
    const res = await fetch(
      `https://data.alpaca.markets/v2/stocks/${symbol}/snapshot?feed=iex`,
      { headers: { 'APCA-API-KEY-ID': apiKey, 'APCA-API-SECRET-KEY': apiSecret }, cache: 'no-store' }
    );
    if (!res.ok) return null;
    const d = await res.json();
    const price = d.latestTrade?.p || d.latestQuote?.ap || null;
    const prevClose = d.prevDailyBar?.c || null;
    if (!price) return null;
    const changeAmount = prevClose ? price - prevClose : 0;
    const changePercent = prevClose ? (changeAmount / prevClose) * 100 : 0;
    return { price, changePercent, changeAmount };
  } catch { return null; }
}

// ── Technical snapshot: Alpaca daily + weekly bars → indicators ───────────────
async function getTechnicalSnapshot(symbol: string) {
  try {
    // Fetch daily (365 bars) and weekly (260 bars ≈ 5 years) from Alpaca
    const [alpacaDaily, alpacaWeekly] = await Promise.all([
      fetchAlpacaBars(symbol, '1Day', 365),
      fetchAlpacaBars(symbol, '1Week', 260),
    ]);

    // Convert to standard bar format
    const dailyBars = alpacaDaily.map(alpacaToBar).filter(b => b.close);
    const weeklyBars = alpacaWeekly.map(alpacaToBar).filter(b => b.close);

    if (dailyBars.length < 30) {
      console.warn(`[Terminal] Not enough Alpaca bars for ${symbol}, trying Yahoo fallback`);
      return getTechnicalSnapshotYahoo(symbol);
    }

    const dailyIndicators = calculateIndicators(dailyBars);
    const weeklyIndicators = calculateIndicators(weeklyBars);

    const latestDaily = dailyIndicators[dailyIndicators.length - 1];
    const latestWeekly = weeklyIndicators[weeklyIndicators.length - 1];

    const avgVolume = dailyBars.slice(-20).reduce((acc, b) => acc + b.volume, 0) / 20;
    const relVolume = avgVolume > 0 ? latestDaily.volume / avgVolume : 1;

    const bb = latestDaily.bollinger;
    const bbWidth = bb?.upper && bb?.lower && bb?.middle
      ? ((bb.upper - bb.lower) / bb.middle * 100) : null;

    const macd = latestDaily.macd;
    const macdBullish = macd?.MACD !== undefined && macd?.signal !== undefined
      ? macd.MACD > macd.signal : null;

    const divergence = latestDaily.divergence;

    return { daily: latestDaily, weekly: latestWeekly, relVolume, bbWidth, macdBullish, divergence };
  } catch (e) {
    console.error(`[Terminal] Alpaca snapshot failed for ${symbol}, falling back to Yahoo:`, e);
    return getTechnicalSnapshotYahoo(symbol);
  }
}

// ── Fallback: Yahoo Finance bars ─────────────────────────────────────────────
async function getTechnicalSnapshotYahoo(symbol: string) {
  try {
    const [dailyChart, weeklyChart] = await Promise.all([
      yahooFinance.chart(symbol, { period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), interval: '1d' }),
      yahooFinance.chart(symbol, { period1: new Date(Date.now() - 365 * 5 * 24 * 60 * 60 * 1000), interval: '1wk' })
    ]);
    const toBar = (q: any) => ({ time: new Date(q.date).getTime(), open: q.open, high: q.high, low: q.l, close: q.close, volume: q.volume });
    const dailyBars = dailyChart.quotes.map(toBar).filter(q => q.close) as any[];
    const weeklyBars = weeklyChart.quotes.map(toBar).filter(q => q.close) as any[];
    const dailyIndicators = calculateIndicators(dailyBars);
    const weeklyIndicators = calculateIndicators(weeklyBars);
    const latestDaily = dailyIndicators[dailyIndicators.length - 1];
    const latestWeekly = weeklyIndicators[weeklyIndicators.length - 1];
    const avgVolume = dailyBars.slice(-20).reduce((acc: number, b: any) => acc + b.volume, 0) / 20;
    const relVolume = latestDaily.volume / avgVolume;
    const bb = latestDaily.bollinger;
    const bbWidth = bb?.upper && bb?.lower && bb?.middle ? ((bb.upper - bb.lower) / bb.middle * 100) : null;
    const macd = latestDaily.macd;
    const macdBullish = macd?.MACD !== undefined && macd?.signal !== undefined ? macd.MACD > macd.signal : null;
    const divergence = latestDaily.divergence;
    return { daily: latestDaily, weekly: latestWeekly, relVolume, bbWidth, macdBullish, divergence };
  } catch (e) {
    console.error(`Yahoo snapshot failed for ${symbol}:`, e);
    return null;
  }
}

// ── Market Status (ET Time) ──────────────────────────────────────────────────
function getMarketStatus() {
  const now = new Date();
  const etTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    weekday: 'long'
  }).formatToParts(now);

  const hour = parseInt(etTime.find(x => x.type === 'hour')?.value || '0');
  const minute = parseInt(etTime.find(x => x.type === 'minute')?.value || '0');
  const weekday = etTime.find(x => x.type === 'weekday')?.value;

  const isWeekend = weekday === 'Saturday' || weekday === 'Sunday';
  const totalMinutes = hour * 60 + minute;
  const openMinutes = 9 * 60 + 30; // 09:30
  const closeMinutes = 16 * 60; // 16:00

  const isOpen = !isWeekend && totalMinutes >= openMinutes && totalMinutes < closeMinutes;
  return { isOpen, label: isOpen ? 'LIVE' : 'MARKET CLOSED' };
}

// ── Sector trending: use Alpaca 30-day bars → check vs 20d avg ───────────────
async function getSectorTrending(symbol: string): Promise<boolean> {
  try {
    const bars = await fetchAlpacaBars(symbol, '1Day', 25);
    if (bars.length < 21) return false;
    const closes = bars.map(b => b.c);
    const avg20 = closes.slice(-21, -1).reduce((a, c) => a + c, 0) / 20;
    return closes[closes.length - 1] > avg20;
  } catch {
    return false;
  }
}

// ── VIX 52-week percentile via VIXY bars ──────────────────────────────────────
async function getVixPercentile(currentVix: number): Promise<number> {
  try {
    const bars = await fetchAlpacaBars('VIXY', '1Day', 252); // ~1 trading year
    if (bars.length < 50) return 50;
    const closes = bars.map(b => b.c);
    const below = closes.filter(c => c < currentVix).length;
    return Math.round((below / closes.length) * 100);
  } catch {
    return 50; // default to median if unavailable
  }
}

// ── S&P 500 breadth internals — computed from a representative 50-stock basket ─
const SP500_BASKET = [
  'AAPL','MSFT','NVDA','AMZN','META','GOOGL','TSLA','AVGO','JPM','WMT',
  'MA','UNH','XOM','PG','ORCL','JNJ','HD','V','COST','MRK',
  'BAC','ABBV','NFLX','CRM','AMD','LLY','CVX','KO','PEP','WFC',
  'ADBE','MCD','CSCO','ABT','ACN','LIN','DHR','NKE','PM','INTC',
  'TXN','QCOM','CMCSA','VZ','IBM','GE','UNP','CAT','HON','RTX',
];

async function getBreadthInternals(): Promise<{ above20: number | null; above50: number | null; above200: number | null; putCall: number | null }> {
  try {
    // Fetch 205 days of bars to cover 200-day MA + buffer, in batches of 10
    const BATCH_SIZE = 10;
    const batches: string[][] = [];
    for (let i = 0; i < SP500_BASKET.length; i += BATCH_SIZE) {
      batches.push(SP500_BASKET.slice(i, i + BATCH_SIZE));
    }

    const batchResults = await Promise.all(
      batches.map(batch =>
        Promise.all(batch.map(sym => fetchAlpacaBars(sym, '1Day', 205).catch(() => null)))
      )
    );
    const allBars: (any[] | null)[] = batchResults.flat();

    let above20Count = 0, above50Count = 0, above200Count = 0, valid = 0;

    allBars.forEach(bars => {
      if (!bars || bars.length < 25) return;
      valid++;
      const closes = bars.map((b: any) => b.c);
      const last = closes[closes.length - 1];

      const avg20  = closes.slice(-21, -1).reduce((a: number, c: number) => a + c, 0) / 20;
      const avg50  = closes.length >= 51  ? closes.slice(-51, -1).reduce((a: number, c: number) => a + c, 0) / 50  : null;
      const avg200 = closes.length >= 201 ? closes.slice(-201, -1).reduce((a: number, c: number) => a + c, 0) / 200 : null;

      if (last > avg20)  above20Count++;
      if (avg50  && last > avg50)  above50Count++;
      if (avg200 && last > avg200) above200Count++;
    });

    if (valid === 0) return { above20: null, above50: null, above200: null, putCall: null };

    // Put/Call ratio: still try Yahoo as a best-effort, fall back to null
    let putCall: number | null = null;
    try {
      const pcq = await yahooFinance.quote('^CPCE').catch(() => null);
      putCall = (pcq as any)?.regularMarketPrice ?? null;
    } catch { putCall = null; }

    return {
      above20:  Math.round((above20Count  / valid) * 100),
      above50:  Math.round((above50Count  / valid) * 100),
      above200: Math.round((above200Count / valid) * 100),
      putCall,
    };
  } catch {
    return { above20: null, above50: null, above200: null, putCall: null };
  }
}


export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const benchmark = searchParams.get('benchmark') || 'SPY';
    const mode = (searchParams.get('mode') || 'POSITIONAL').toUpperCase();
    const cacheKey = `${benchmark}-${mode}`;

    // ── Serve from cache if fresh ─────────────────────────────
    const cached = getCached(cacheKey);
    if (cached) {
      console.log(`[Terminal] Cache hit for ${cacheKey}`);
      return NextResponse.json(cached, {
        headers: { 'X-Cache': 'HIT', 'X-Cache-Key': cacheKey }
      });
    }
    console.log(`[Terminal] Cache miss — fetching fresh data for ${cacheKey}`);

    const baseSymbols = ['QQQ', 'SPY', 'IWM', '^VIX', '^TNX', 'DX-Y.NYB'];
    const sectorSymbols = ['XLE', 'XLI', 'XLU', 'XLK', 'XLF', 'XLV', 'XLY', 'XLP', 'XLRE', 'XLC', 'XLB'];

    // ── Fetch all data in parallel ─────────────────────────────────────────
    const ETF_QUOTES = ['SPY', 'QQQ', 'IWM', 'VIXY', ...sectorSymbols];

    const [techSnapshot, sectorData, etfQuotes, dxyData, yahooVix, yahooDxy, yahooIrx, yahooFvx, yahooTnx, yahooTyx, yahooMain, breadthInternals] = await Promise.all([
      getTechnicalSnapshot(benchmark),
      Promise.all(sectorSymbols.map(s => getSectorTrending(s))),
      Promise.all(ETF_QUOTES.map(s => fetchAlpacaQuote(s))),
      fetchAlpacaQuote('UUP').catch(() => null),
      yahooFinance.quote('^VIX').catch(() => null),
      yahooFinance.quote('DX-Y.NYB').catch(() => null),
      yahooFinance.quote('^IRX').catch(() => null),
      yahooFinance.quote('^FVX').catch(() => null),
      yahooFinance.quote('^TNX').catch(() => null),
      yahooFinance.quote('^TYX').catch(() => null),
      yahooFinance.quote(['SPY', 'QQQ', 'IWM']).catch(() => []),
      getBreadthInternals(),
    ]);

    const dataMap: Record<string, { price: number; changePercent: number; changeAmount: number }> = {};
    const fetchResults = etfQuotes as ({ price: number; changePercent: number; changeAmount: number } | null)[];
    ETF_QUOTES.forEach((sym, i) => { if (fetchResults[i]) dataMap[sym] = fetchResults[i]!; });

    // Yahoo fallbacks for core indices in top bar
    (yahooMain as any[]).forEach(q => {
      if (!dataMap[q.symbol] && q.regularMarketPrice) {
        dataMap[q.symbol] = { 
          price: q.regularMarketPrice, 
          changePercent: q.regularMarketChangePercent || 0,
          changeAmount: q.regularMarketChange || 0
        };
      }
    });

    // VIX handling: Primary from Yahoo index, then Alpaca VIXY, then fallback
    const vixPrice = (yahooVix as any)?.regularMarketPrice || dataMap['VIXY']?.price || 20;
    const vixChange = (yahooVix as any)?.regularMarketChangePercent || dataMap['VIXY']?.changePercent || 0;
    const vixChangeAmount = (yahooVix as any)?.regularMarketChange || dataMap['VIXY']?.changeAmount || 0;
    const vix = vixPrice;

    const irxPrice = (yahooIrx as any)?.regularMarketPrice || 0;
    const irxChange = (yahooIrx as any)?.regularMarketChangePercent || 0;
    const fvxPrice = (yahooFvx as any)?.regularMarketPrice || 0;
    const fvxChange = (yahooFvx as any)?.regularMarketChangePercent || 0;
    const tnxPrice = (yahooTnx as any)?.regularMarketPrice || 0;
    const tnxChange = (yahooTnx as any)?.regularMarketChangePercent || 0;
    const tyxPrice = (yahooTyx as any)?.regularMarketPrice || 0;
    const tyxChange = (yahooTyx as any)?.regularMarketChangePercent || 0;

    const dxyPrice = (yahooDxy as any)?.regularMarketPrice || dxyData?.price || 100;
    const dxyChange = (yahooDxy as any)?.regularMarketChangePercent || dxyData?.changePercent || 0;

    // VIX percentile (compute after we know vix)
    const vixPercentile = await getVixPercentile(vix);

    let dailyBullEmas = 0;
    let weeklyBullEmas = 0;
    const levels = [9, 21, 50, 100, 200];

    if (!techSnapshot) {
      return NextResponse.json({ error: "Technical analysis failed" }, { status: 500 });
    }

    const { daily, weekly, relVolume, bbWidth, macdBullish, divergence } = techSnapshot;
    const price = daily.close;
    const rsi = daily.rsi14 || 50;

    levels.forEach(lvl => {
      const d = (daily as any)[`ema${lvl}`];
      const w = (weekly as any)[`ema${lvl}`];
      if (d && price > d) dailyBullEmas++;
      if (w && price > w) weeklyBullEmas++;
    });

    const dailyTrendScore = (dailyBullEmas / 5) * 100;
    const weeklyTrendScore = (weeklyBullEmas / 5) * 100;

    let momentumWeight = 50;
    if (rsi > 40 && rsi < 70) momentumWeight = 85;
    else if (rsi >= 70) momentumWeight = 30;
    else if (rsi <= 30) momentumWeight = 60;
    if (relVolume > 1.2 && daily.ema9 && price > daily.ema9) momentumWeight += 10;
    
    // RSI Divergence Impact
    if (divergence?.type === 'BULLISH') momentumWeight += 15;
    if (divergence?.type === 'BEARISH') momentumWeight -= 15;

    const momentumScore = Math.max(0, Math.min(100, momentumWeight));

    const volatilityScore = Math.max(0, Math.min(100, 100 - (vix - 15) * (100 / 15)));

    const positiveSectors = sectorSymbols.filter(sym => (dataMap[sym]?.changePercent ?? 0) > 0);
    const breadthScore = (positiveSectors.length / sectorSymbols.length) * 100;

    // Macro Score: Penalty for rising yields across the curve + rising dollar
    const yieldImpact = (Math.max(0, irxChange) + Math.max(0, fvxChange) + Math.max(0, tnxChange) + Math.max(0, tyxChange)) / 4;
    const macroScore = Math.max(0, Math.min(100, 100 - (yieldImpact * 15 + Math.max(0, dxyChange) * 15)));

    // --- Mode-Aware Scoring Weights ---
    const weights = mode === 'TACTICAL'
      ? { dailyTrend: 0.25, weeklyTrend: 0.10, momentum: 0.25, volatility: 0.20, breadth: 0.10, macro: 0.10 }
      : { dailyTrend: 0.20, weeklyTrend: 0.20, momentum: 0.15, volatility: 0.15, breadth: 0.15, macro: 0.15 };

    const totalScore = Math.round(
      (dailyTrendScore * weights.dailyTrend) +
      (weeklyTrendScore * weights.weeklyTrend) +
      (momentumScore * weights.momentum) +
      (volatilityScore * weights.volatility) +
      (breadthScore * weights.breadth) +
      (macroScore * weights.macro)
    );

    // --- Scoring Weights Breakdown ---
    const scoringWeights = [
      { label: "Daily Trend", score: Math.round(dailyTrendScore), weight: Math.round(weights.dailyTrend * 100), contribution: Math.round(dailyTrendScore * weights.dailyTrend), type: dailyBullEmas >= 4 ? "positive" : dailyBullEmas >= 2 ? "warning" : "negative" },
      { label: "Weekly Trend", score: Math.round(weeklyTrendScore), weight: Math.round(weights.weeklyTrend * 100), contribution: Math.round(weeklyTrendScore * weights.weeklyTrend), type: weeklyBullEmas >= 4 ? "positive" : weeklyBullEmas >= 2 ? "warning" : "negative" },
      { label: "Momentum", score: Math.round(momentumScore), weight: Math.round(weights.momentum * 100), contribution: Math.round(momentumScore * weights.momentum), type: momentumScore >= 60 ? "positive" : momentumScore >= 40 ? "warning" : "negative" },
      { label: "Volatility", score: Math.round(volatilityScore), weight: Math.round(weights.volatility * 100), contribution: Math.round(volatilityScore * weights.volatility), type: volatilityScore >= 60 ? "positive" : "negative" },
      { label: "Breadth", score: Math.round(breadthScore), weight: Math.round(weights.breadth * 100), contribution: Math.round(breadthScore * weights.breadth), type: breadthScore >= 60 ? "positive" : breadthScore >= 40 ? "warning" : "negative" },
      { label: "Macro", score: Math.round(macroScore), weight: Math.round(weights.macro * 100), contribution: Math.round(macroScore * weights.macro), type: macroScore >= 60 ? "positive" : macroScore >= 40 ? "warning" : "negative" },
    ];

    // --- Position Sizing ---
    const positionSize = totalScore >= 70 ? "SCALE IN" : totalScore >= 55 ? "REDUCED EXPOSURE" : "RISK-OFF";
    const deployCapital = totalScore >= 60 ? "DEPLOY" : totalScore >= 45 ? "STANDBY" : "AVOID";

    // --- Signal Readiness (Execution Quality) ---
    const trendingCount = (sectorData as boolean[]).filter(Boolean).length;
    const signalReadiness = [
      { question: "Momentum Confirming?", answer: (macdBullish && rsi > 50) ? "Yes" : "No", status: (macdBullish && rsi > 50) ? "positive" : "negative", detail: macdBullish ? "MACD Aligned" : "MACD Crossed Down" },
      { question: "Structure Intact?", answer: (daily.ema50 && price > daily.ema50 && daily.ema200 && price > daily.ema200) ? "Yes" : "No", status: (daily.ema50 && price > daily.ema50) ? "positive" : "negative", detail: (daily.ema50 && price > daily.ema50) ? "Above Key EMAs" : "Below Key EMAs" },
      { question: "Dip Demand Active?", answer: (breadthScore > 50 && relVolume > 0.8) ? "Yes" : "No", status: (breadthScore > 50) ? "positive" : "negative", detail: breadthScore > 50 ? "Buyers Present" : "Sellers In Control" },
      { question: "Sector Rotation Healthy?", answer: trendingCount >= 6 ? "Yes" : "Weak", status: trendingCount >= 6 ? "positive" : trendingCount >= 4 ? "warning" : "negative", detail: `${trendingCount}/11 sectors trending` },
    ];

    // --- Event Risk Alert ---
    // Simple heuristic: flag if VIX > 20 and macro is spiking
    const isEventRisk = (Math.abs(tnxChange) > 1.5 || Math.abs(dxyChange) > 0.5) && vix > 20;
    const eventAlert = isEventRisk
      ? { active: true, message: `Macro event risk elevated — Yield ${tnxChange > 0 ? "spiking" : "falling"} ${Math.abs(tnxChange).toFixed(2)}%, DXY ${dxyChange > 0 ? "strengthening" : "weakening"}. Reduce leverage.` }
      : null;

    // --- Score History & Delta ---
    // --- History & Delta ---
    if (!scoreHistory[benchmark]) scoreHistory[benchmark] = [];
    const prev = scoreHistory[benchmark];
    const scoreDelta = prev.length > 0 ? totalScore - prev[prev.length - 1] : 0;
    
    // Update and persist
    prev.push(totalScore);
    if (prev.length > 30) prev.shift();
    saveHistory(scoreHistory);

    // --- EMA Divergence ---
    const emaDivergence = (dailyBullEmas <= 1 && weeklyBullEmas >= 4) || (dailyBullEmas >= 4 && weeklyBullEmas <= 1);

    // --- Conditions Checklist ---
    const checklist = [
      { label: "Price > Daily EMA50", met: !!(daily.ema50 && price > daily.ema50) },
      { label: "Price > Weekly EMA50", met: !!(weekly.ema50 && price > weekly.ema50) },
      { label: "VIX < 20", met: vix < 20 },
      { label: "RSI 40–70 (Healthy)", met: rsi >= 40 && rsi <= 70 },
      { label: "Breadth > 60%", met: breadthScore >= 60 },
      { label: "MACD Bullish", met: macdBullish === true },
      { label: "Price > D-EMA200 (Uptrend)", met: !!(daily.ema200 && price > daily.ema200) },
      { label: "Rel Volume > 1x", met: relVolume >= 1 },
    ];

    // --- AI Assessment ---
    let assessment = "Analysis in progress...";
    let suggestedAction = "Monitor internals.";
    let riskLevel: "Low" | "Moderate" | "High" | "Extreme" = "Moderate";

    if (totalScore >= 70) {
      assessment = `Market showing strong alignment across Daily and Weekly timeframes. Structural trend is intact.`;
      suggestedAction = "Active Long Exposure";
      if (vix < 20) riskLevel = "Low";
    } else if (totalScore <= 40) {
      assessment = "Trend breakdown identified. Price below major moving averages on high timeframes.";
      suggestedAction = "Preserve Capital";
      riskLevel = "High";
    } else {
      assessment = "Market consolidating near key EMA levels. Sentiment is neutral-to-cautious.";
      suggestedAction = "Wait for Clarity";
    }

    if (process.env.GEMINI_API_KEY) {
      try {
        const currentQuote = dataMap[benchmark] || { price: price, changePercent: 0, changeAmount: 0 };
        const qPct = currentQuote.changePercent;

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `You are a quantitative market analyst. Analyze ${benchmark} (${mode} mode) with this data:

  SCORE: ${totalScore}/100 (${scoreDelta > 0 ? '+' : ''}${scoreDelta} change)
  TREND: Daily EMAs ${dailyBullEmas}/5 bullish | Weekly EMAs ${weeklyBullEmas}/5 bullish
      Benchmark: ${benchmark}
      Current Mode: ${mode} (${mode === 'TACTICAL' ? 'Short-term focus' : 'Swing/Mid-term focus'})
      Current Price: $${price.toFixed(2)} (${qPct.toFixed(2)}% from close)
      RSI (14d): ${rsi.toFixed(2)}
      RSI Divergence: ${divergence?.type || 'None'} (Bullish/Bearish signal now factored into Momentum Score/Total Score)
      MACD Bullish: ${macdBullish ? 'YES' : 'NO'}
      Bollinger Band Width: ${bbWidth !== null ? (bbWidth * 100).toFixed(2) + '%' : 'N/A'}
      Relative Volume (30d): ${relVolume.toFixed(1)}x
  VOLATILITY: VIX ${vix.toFixed(2)} (${vixPercentile}th percentile vs 52-week) | Put/Call ${breadthInternals.putCall !== null ? breadthInternals.putCall.toFixed(2) : 'N/A'}
  BREADTH: Sectors positive ${positiveSectors.length}/11 | S&P 500 stocks above 20MA: ${breadthInternals.above20?.toFixed(1) ?? 'N/A'}% | 50MA: ${breadthInternals.above50?.toFixed(1) ?? 'N/A'}% | 200MA: ${breadthInternals.above200?.toFixed(1) ?? 'N/A'}%
  MACRO: 2Y change ${irxChange.toFixed(2)}% | 5Y change ${fvxChange.toFixed(2)}% | 10Y change ${tnxChange.toFixed(2)}% | 30Y change ${tyxChange.toFixed(2)}% | DXY change ${dxyChange.toFixed(2)}%
  ${emaDivergence ? '⚠️ EMA DIVERGENCE: Daily and weekly trend conflict — high caution.' : ''}
  ${breadthInternals.putCall !== null && breadthInternals.putCall > 1.0 ? '⚠️ Elevated put/call ratio — options market pricing in downside risk.' : ''}
  ${vixPercentile > 75 ? '⚠️ VIX in extreme fear territory — historically a mean-reversion zone.' : ''}
  ${yieldImpact > 1.0 ? '⚠️ Yield curve is spiking aggressively, creating strong valuation headwinds.' : ''}

  Write a 2-sentence plain-English assessment focusing on the most critical signals. Then give a 3-5 word suggested action.
  Return ONLY JSON: {"assessment": "...", "suggestedAction": "...", "riskLevel": "Low/Moderate/High/Extreme"}`;
        const result = await model.generateContent(prompt);
        const jsonMatch = result.response.text().match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const ai = JSON.parse(jsonMatch[0]);
          assessment = ai.assessment || assessment;
          suggestedAction = ai.suggestedAction || suggestedAction;
          riskLevel = ai.riskLevel || riskLevel;
        }
      } catch (e) { console.error("Gemini error:", e); }
    }

    const responsePayload = {
      benchmark,
      mode,
      totalScore,
      deployCapital,
      positionSize,
      marketStatus: getMarketStatus(),
      scoringWeights,
      signalReadiness,
      eventAlert,
      scoreDelta,
      scoreHistory: [...(scoreHistory[benchmark] || [])],
      emaDivergence,
      checklist,
      metrics: {
        dailyTrend: {
          value: Math.round(dailyTrendScore),
          status: dailyBullEmas >= 4 ? "Tactical Bull" : dailyBullEmas >= 2 ? "Neutral" : "Tactical Bear",
          type: dailyBullEmas >= 4 ? "positive" : dailyBullEmas >= 2 ? "warning" : "negative",
          subMetrics: [
            { label: "EMA Stack", value: `${dailyBullEmas}/5 Bullish`, status: dailyBullEmas >= 4 ? "positive" : "warning" },
            { label: `Short (9/21: $${daily.ema9?.toFixed(0)})`, value: (daily.ema9 && price > daily.ema9 && daily.ema21 && price > daily.ema21) ? "Holding" : "Broken", status: (daily.ema9 && price > daily.ema9) ? "positive" : "negative" },
            { label: `Mid (50/100: $${daily.ema50?.toFixed(0)})`, value: (daily.ema50 && price > daily.ema50) ? "Above" : "Below", status: (daily.ema50 && price > daily.ema50) ? "positive" : "negative" },
            { label: `Long (200: $${daily.ema200?.toFixed(0)})`, value: (daily.ema200 && price > daily.ema200) ? "Above" : "Below", status: (daily.ema200 && price > daily.ema200) ? "positive" : "negative" }
          ]
        },
        weeklyTrend: {
          value: Math.round(weeklyTrendScore),
          status: weeklyBullEmas >= 4 ? "Structural Bull" : weeklyBullEmas >= 2 ? "Neutral" : "Structural Bear",
          type: weeklyBullEmas >= 4 ? "positive" : weeklyBullEmas >= 2 ? "warning" : "negative",
          subMetrics: [
            { label: "EMA Stack", value: `${weeklyBullEmas}/5 Bullish`, status: weeklyBullEmas >= 4 ? "positive" : "warning" },
            { label: `Intermediate (21: $${weekly.ema21?.toFixed(0)})`, value: (weekly.ema21 && price > weekly.ema21) ? "Bullish" : "Bearish", status: (weekly.ema21 && price > weekly.ema21) ? "positive" : "negative" },
            { label: `Structural (50: $${weekly.ema50?.toFixed(0)})`, value: (weekly.ema50 && price > weekly.ema50) ? "Holding" : "Broken", status: (weekly.ema50 && price > weekly.ema50) ? "positive" : "negative" },
            { label: `Macro (200: $${weekly.ema200?.toFixed(0)})`, value: (weekly.ema200 && price > weekly.ema200) ? "Bullish" : "Bearish", status: (weekly.ema200 && price > weekly.ema200) ? "positive" : "negative" }
          ]
        },
        momentum: {
          value: Math.round(momentumScore),
          status: rsi > 50 ? "Rising" : "Declining",
          type: rsi > 50 ? "positive" : "negative",
          subMetrics: [
            { label: "RSI(14)", value: rsi.toFixed(1), status: rsi > 40 && rsi < 70 ? "positive" : "warning" },
            { label: "MACD Signal", value: macdBullish === null ? "N/A" : macdBullish ? "Bullish Cross" : "Bearish Cross", status: macdBullish ? "positive" : "negative" },
            { label: "Rel Volume", value: relVolume.toFixed(2) + "x", status: relVolume > 1 ? "positive" : "neutral" },
            { label: "RSI Divergence", value: divergence?.type || "None", status: divergence?.type === "BULLISH" ? "positive" : divergence?.type === "BEARISH" ? "negative" : "neutral" }
          ]
        },
        volatility: {
          value: Math.round(volatilityScore),
          status: vix < 20 ? "Stable" : vix < 28 ? "Elevated" : "Fear",
          type: vix < 20 ? "positive" : vix < 28 ? "warning" : "negative",
          subMetrics: [
            { label: "VIX Level", value: vix.toFixed(2), status: (vix < 20 ? "positive" : vix < 28 ? "warning" : "negative") as any },
            { label: "VIX Percentile", value: `${vixPercentile}th %ile`, statusLabel: vixPercentile < 30 ? "Low Fear" : vixPercentile < 60 ? "Normal" : vixPercentile < 80 ? "Elevated" : "Extreme", status: (vixPercentile < 40 ? "positive" : vixPercentile < 70 ? "warning" : "negative") as any },
            { label: "Put/Call Ratio", value: breadthInternals.putCall !== null ? breadthInternals.putCall.toFixed(2) : "N/A", statusLabel: breadthInternals.putCall !== null ? (breadthInternals.putCall > 1.0 ? "Bearish Bias" : breadthInternals.putCall < 0.7 ? "Bullish Bias" : "Neutral") : undefined, status: (breadthInternals.putCall !== null && breadthInternals.putCall > 1.0 ? "negative" : "positive") as any },
            { label: "BB Width", value: bbWidth !== null ? bbWidth.toFixed(2) + "%" : "N/A", status: (bbWidth !== null && bbWidth < 5 ? "warning" : "neutral") as any }
          ]
        },
        breadth: {
          value: Math.round(breadthScore),
          status: breadthScore >= 70 ? "Strong" : breadthScore >= 50 ? "Healthy" : "Weak",
          type: breadthScore >= 50 ? "positive" : "negative",
          subMetrics: [
            { label: "Sectors Positive", value: `${positiveSectors.length}/${sectorSymbols.length}`, status: (breadthScore >= 50 ? "positive" : "negative") as any },
            { label: "Trending > 20d", value: `${(sectorData as boolean[]).filter(Boolean).length}/${sectorSymbols.length}`, status: ((sectorData as boolean[]).filter(Boolean).length >= 6 ? "positive" : "warning") as any },
            { label: "% > 20MA (S&P)", value: breadthInternals.above20 !== null ? breadthInternals.above20.toFixed(1) + "%" : "N/A", status: (breadthInternals.above20 !== null && breadthInternals.above20 > 50 ? "positive" : "negative") as any },
            { label: "% > 50MA (S&P)", value: breadthInternals.above50 !== null ? breadthInternals.above50.toFixed(1) + "%" : "N/A", status: (breadthInternals.above50 !== null && breadthInternals.above50 > 50 ? "positive" : "negative") as any },
            { label: "% > 200MA (S&P)", value: breadthInternals.above200 !== null ? breadthInternals.above200.toFixed(1) + "%" : "N/A", status: (breadthInternals.above200 !== null && breadthInternals.above200 > 50 ? "positive" : "negative") as any },
          ]
        },
        macro: {
          value: Math.round(macroScore),
          status: macroScore < 40 ? "Hostile" : macroScore < 60 ? "Headwind" : "Supportive",
          type: macroScore < 40 ? "negative" : macroScore < 60 ? "warning" : "positive",
          subMetrics: [
            { label: "2Y Yield", value: irxPrice ? `${irxPrice.toFixed(2)}%` : "N/A", status: irxChange > 0 ? "negative" : "positive" },
            { label: "5Y Yield", value: fvxPrice ? `${fvxPrice.toFixed(2)}%` : "N/A", status: fvxChange > 0 ? "negative" : "positive" },
            { label: "10Y Yield", value: tnxPrice ? `${tnxPrice.toFixed(2)}%` : "N/A", status: tnxChange > 0 ? "negative" : "positive" },
            { label: "30Y Yield", value: tyxPrice ? `${tyxPrice.toFixed(2)}%` : "N/A", status: tyxChange > 0 ? "negative" : "positive" },
            { label: "US Dollar (DXY)", value: dxyPrice ? dxyPrice.toFixed(2) : "N/A", status: dxyChange > 0.2 ? "negative" : "positive" }
          ]
        }
      },
      sectors: sectorSymbols.map((sym, i) => ({
        name: sym,
        change: dataMap[sym]?.changePercent ?? 0,
        trending: sectorData[i] as boolean
      })).sort((a: any, b: any) => b.change - a.change),
      ai: { assessment, suggestedAction, riskLevel },
      topBar: [
        { symbol: 'SPY', price: dataMap['SPY']?.price, change: dataMap['SPY']?.changePercent, changeAmount: dataMap['SPY']?.changeAmount },
        { symbol: 'QQQ', price: dataMap['QQQ']?.price, change: dataMap['QQQ']?.changePercent, changeAmount: dataMap['QQQ']?.changeAmount },
        { symbol: 'IWM', price: dataMap['IWM']?.price, change: dataMap['IWM']?.changePercent, changeAmount: dataMap['IWM']?.changeAmount },
        { symbol: 'VIX', price: vix, change: vixChange, changeAmount: vixChangeAmount },
      ]
    };

    setCache(cacheKey, responsePayload);
    return NextResponse.json(responsePayload, {
      headers: { 'X-Cache': 'MISS', 'X-Cache-Key': cacheKey }
    });

  } catch (error) {
    console.error("Terminal API Error:", error);
    return NextResponse.json({ error: "Failed to fetch terminal data" }, { status: 500 });
  }
}
