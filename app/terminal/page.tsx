"use client";

import React, { useEffect, useState, useCallback } from "react";
import TerminalGauge from "@/components/terminal/TerminalGauge";
import MetricCard from "@/components/terminal/MetricCard";
import SectorPerformanceTerminal from "@/components/terminal/SectorPerformanceTerminal";
import AITerminalAssessment from "@/components/terminal/AITerminalAssessment";
import ScoreHistorySparkline from "@/components/terminal/ScoreHistorySparkline";
import ConditionsChecklist from "@/components/terminal/ConditionsChecklist";
import DecisionBanner from "@/components/terminal/DecisionBanner";
import SignalReadiness from "@/components/terminal/SignalReadiness";
import ScoringWeights from "@/components/terminal/ScoringWeights";
import EventCalendar from "@/components/terminal/EventCalendar";
import WidgetErrorBoundary from "@/components/terminal/WidgetErrorBoundary";
import WidgetSkeleton from "@/components/terminal/WidgetSkeleton";
import {
  Activity, TrendingUp, BarChart3, Zap, Globe,
  ChevronLeft, RefreshCw, Clock, AlertTriangle
} from "lucide-react";
import Link from "next/link";

type Benchmark = "SPY" | "QQQ" | "IWM";
type Mode = "TACTICAL" | "POSITIONAL";

type MarketStatus = "OPEN" | "PRE_MARKET" | "AFTER_HOURS" | "CLOSED";

function getMarketStatus(): MarketStatus {
  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) return "CLOSED";
  const etHour = parseInt(now.toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }), 10);
  const etTime = etHour * 60 + now.getMinutes();
  if (etTime >= 9 * 60 + 30 && etTime < 16 * 60) return "OPEN";
  if (etTime >= 4 * 60 && etTime < 9 * 60 + 30) return "PRE_MARKET";
  if (etTime >= 16 * 60 && etTime < 20 * 60) return "AFTER_HOURS";
  return "CLOSED";
}

function getRefreshInterval(m: Mode, status: MarketStatus): number {
  if (status === "CLOSED") return 0;
  if (status === "OPEN") return m === "TACTICAL" ? 5 * 60 : 15 * 60;
  return m === "TACTICAL" ? 15 * 60 : 30 * 60;
}

export default function TerminalPage() {
  const [benchmark, setBenchmark] = useState<Benchmark>("SPY");
  const [mode, setMode] = useState<Mode>("POSITIONAL");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [marketStatus, setMarketStatus] = useState<MarketStatus>(getMarketStatus());
  const [countdown, setCountdown] = useState(() => getRefreshInterval("POSITIONAL", getMarketStatus()) || 900);

  const fetchData = useCallback(async (b: Benchmark = benchmark, m: Mode = mode) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/terminal?benchmark=${b}&mode=${m}`);
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date());
      const status = getMarketStatus();
      setMarketStatus(status);
      setCountdown(getRefreshInterval(m, status) || 900);
    } catch (e) {
      console.error("Failed to fetch terminal data", e);
    } finally {
      setLoading(false);
    }
  }, [benchmark, mode]);

  useEffect(() => { fetchData(benchmark, mode); }, [benchmark, mode]);

  useEffect(() => {
    const tick = setInterval(() => {
      const status = getMarketStatus();
      setMarketStatus(status);
      const interval = getRefreshInterval(mode, status);
      if (interval === 0) return;
      setCountdown(prev => {
        if (prev <= 1) { fetchData(benchmark, mode); return interval; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [benchmark, mode, fetchData]);

  const handleBenchmarkChange = (b: Benchmark) => { if (b !== benchmark) setBenchmark(b); };
  const handleModeChange = (m: Mode) => { if (m !== mode) setMode(m); };

  const scoreDelta: number = data?.scoreDelta ?? 0;
  const emaDivergence: boolean = data?.emaDivergence ?? false;
  const refreshInterval = getRefreshInterval(mode, marketStatus) || 900;
  const progressPct = ((refreshInterval - countdown) / refreshInterval) * 100;
  const minutesLeft = Math.floor(countdown / 60);
  const secondsLeft = countdown % 60;

  const msConfig: Record<MarketStatus, { label: string; color: string; dot: string }> = {
    OPEN:        { label: "MARKET OPEN",   color: "text-[#00FF94]", dot: "bg-[#00FF94]" },
    PRE_MARKET:  { label: "PRE-MARKET",    color: "text-[#FFB800]", dot: "bg-[#FFB800]" },
    AFTER_HOURS: { label: "AFTER HOURS",   color: "text-[#FFB800]", dot: "bg-[#FFB800]" },
    CLOSED:      { label: "MARKET CLOSED", color: "text-white/30",  dot: "bg-white/20" },
  };
  const statusCfg = msConfig[marketStatus];

  /* Skeletons are handled inline per widget when !data */

  return (
    <div className="min-h-screen bg-[#05070A] text-white font-sans selection:bg-[#00FF94]/30">

      {/* ── Sticky Header ──────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-[#05070A]/95 backdrop-blur-xl border-b border-white/5">

        {/* Alert Banners */}
        {data?.eventAlert?.active && (
          <div className="flex items-center gap-3 bg-[#FF2E2E]/10 border-b border-[#FF2E2E]/20 px-6 py-2.5">
            <AlertTriangle className="w-3.5 h-3.5 text-[#FF2E2E] shrink-0 animate-pulse" />
            <p className="text-xs font-bold text-[#FF2E2E]">{data.eventAlert.message}</p>
          </div>
        )}
        {emaDivergence && (
          <div className="flex items-center gap-3 bg-[#FFB800]/10 border-b border-[#FFB800]/20 px-6 py-2.5">
            <AlertTriangle className="w-3.5 h-3.5 text-[#FFB800] shrink-0" />
            <p className="text-xs font-bold text-[#FFB800]">EMA Divergence — Daily &amp; Weekly signals conflict. Reduce sizing.</p>
          </div>
        )}

        {/* Nav Row */}
        <div className="flex items-center justify-between px-6 py-4 gap-4 flex-wrap">
          {/* Left: Branding */}
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/" className="p-1.5 hover:bg-white/5 rounded-lg transition-colors group shrink-0">
              <ChevronLeft className="w-5 h-5 text-white/40 group-hover:text-white" />
            </Link>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full shrink-0 ${statusCfg.dot} ${marketStatus === "OPEN" ? "animate-pulse" : ""}`} />
                <h1 className="text-sm font-black uppercase tracking-[0.25em] text-white truncate">DPTrade Terminal</h1>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${statusCfg.color}`}>{statusCfg.label}</span>
                {marketStatus === "OPEN" && (
                  <span className="text-[10px] text-white/20">
                    · {mode === "TACTICAL" ? "5m" : "15m"} refresh
                  </span>
                )}
                {marketStatus === "CLOSED" && <span className="text-[10px] text-white/20">· Paused</span>}
              </div>
            </div>
          </div>

          {/* Center: Benchmark Tabs */}
          <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/5 shrink-0">
            {(["SPY", "QQQ", "IWM"] as Benchmark[]).map(sym => (
              <button key={sym} onClick={() => handleBenchmarkChange(sym)}
                className={`px-5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  benchmark === sym
                    ? "bg-[#00FF94]/10 text-[#00FF94] border border-[#00FF94]/20"
                    : "text-white/40 hover:text-white/70"
                }`}>
                {sym}
              </button>
            ))}
          </div>

          {/* Right: Prices + Timer */}
          <div className="flex items-center gap-5 min-w-0">
            {/* Prices row */}
            <div className="hidden lg:flex items-center gap-4 bg-white/5 px-4 py-2 rounded-full border border-white/5">
              {data?.topBar?.map((item: any, i: number) => (
                <div key={i} className="flex items-center gap-1.5 border-r border-white/10 pr-4 last:border-0 last:pr-0">
                  <span className="text-[10px] font-bold text-white/40 uppercase">{item.symbol}</span>
                  <span className="text-xs font-bold tabular-nums">${item.price?.toFixed(2)}</span>
                  <span className={`text-[10px] font-bold ${item.change >= 0 ? "text-[#00FF94]" : "text-[#FF2E2E]"}`}>
                    {item.change >= 0 ? "+" : ""}{item.change?.toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>

            {/* Countdown */}
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-end gap-0.5">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-white/20" />
                  <span className="text-[10px] font-bold text-white/30">
                    {minutesLeft}:{secondsLeft.toString().padStart(2, "0")}
                  </span>
                </div>
                <div className="w-20 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-[#00FF94]/50 rounded-full transition-all duration-1000" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
              <button onClick={() => fetchData(benchmark, mode)}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 transition-all">
                <RefreshCw className={`w-4 h-4 text-white/60 hover:text-white ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────────────── */}
      <div className="p-6 max-w-[1800px] mx-auto">
        {loading && data && (
          <div className="fixed inset-0 z-30 bg-[#05070A]/40 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-3 bg-[#0B0F17] border border-white/10 rounded-xl px-6 py-3">
              <RefreshCw className="w-4 h-4 text-[#00FF94] animate-spin" />
              <span className="text-xs font-bold text-[#00FF94] tracking-widest uppercase">Updating...</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-12 gap-5">

          {/* ────── COL A: Decision Control (3 cols) ─────────────── */}
          <div className="col-span-12 md:col-span-6 xl:col-span-3 flex flex-col gap-4">

            {/* 1. Decision Banner */}
            <WidgetErrorBoundary title="Market Readiness">
              {!data && loading ? <WidgetSkeleton className="h-[120px]" /> : (
                <DecisionBanner
                  deployCapital={data?.deployCapital || "STANDBY"}
                  positionSize={data?.positionSize || "RISK-OFF"}
                  totalScore={data?.totalScore || 0}
                  mode={data?.mode || mode}
                  onModeChange={handleModeChange}
                />
              )}
            </WidgetErrorBoundary>

            {/* 2. Gauge + delta + sparkline */}
            <WidgetErrorBoundary title="Score Gauge">
              {!data && loading ? <WidgetSkeleton className="h-[220px]" /> : (
                <div className="bg-[#0B0F17]/40 border border-white/5 rounded-xl p-4 backdrop-blur-md relative hover:border-white/10 transition-colors">
                  {scoreDelta !== 0 && (
                    <div className={`absolute top-3 right-3 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      scoreDelta > 0 ? "bg-[#00FF94]/10 text-[#00FF94] border border-[#00FF94]/20" : "bg-[#FF2E2E]/10 text-[#FF2E2E] border border-[#FF2E2E]/20"
                    }`}>
                      {scoreDelta > 0 ? "▲" : "▼"} {Math.abs(scoreDelta)}
                    </div>
                  )}
                  <TerminalGauge score={data?.totalScore || 0} label={`${benchmark} Quality`} threshold={60} />
                  {data?.scoreHistory && (
                    <ScoreHistorySparkline history={data.scoreHistory} currentScore={data.totalScore} />
                  )}
                </div>
              )}
            </WidgetErrorBoundary>

            {/* 3. Event Calendar */}
            <WidgetErrorBoundary title="Event Calendar">
              {!data && loading ? <WidgetSkeleton className="h-[300px]" /> : <EventCalendar />}
            </WidgetErrorBoundary>

          </div>

          {/* ── COL B: 6 Metric Cards + AI Assessment (5 cols) ── */}
          <div className="col-span-12 md:col-span-12 xl:col-span-5 flex flex-col gap-4">

            {/* 2×3 Metric Grid */}
            <div className="grid grid-cols-2 gap-4">
              <WidgetErrorBoundary title="Daily EMA">
                {!data && loading ? <WidgetSkeleton className="h-32" /> : (
                  <MetricCard title="Daily EMA" value={data?.metrics?.dailyTrend?.value || 0} icon={TrendingUp}
                    status={data?.metrics?.dailyTrend?.status} statusType={data?.metrics?.dailyTrend?.type}
                    subMetrics={data?.metrics?.dailyTrend?.subMetrics || []}
                    info={[
                      "Tracks price position relative to 5 EMAs (9, 21, 50, 100, 200) on the daily chart.",
                      "9/21 EMA: Short-term tactical support — fast-moving signals for momentum traders.",
                      "50 EMA: Intermediate trend anchor — key institutional buying/selling level.",
                      "100 EMA: Mid-term momentum gauge — less reactive than 50, more than 200.",
                      "200 EMA: The long-term bull/bear dividing line — losing this is a major warning.",
                      "5/5 bullish = strong trend. Below 3/5 = weakening structure.",
                    ]} />
                )}
              </WidgetErrorBoundary>
              <WidgetErrorBoundary title="Weekly EMA">
                {!data && loading ? <WidgetSkeleton className="h-32" /> : (
                  <MetricCard title="Weekly EMA" value={data?.metrics?.weeklyTrend?.value || 0} icon={Clock}
                    status={data?.metrics?.weeklyTrend?.status} statusType={data?.metrics?.weeklyTrend?.type}
                    subMetrics={data?.metrics?.weeklyTrend?.subMetrics || []}
                    info={[
                      "Same 5 EMAs (9, 21, 50, 100, 200) analyzed on the weekly timeframe — structural health.",
                      "Price above weekly 50 EMA = secular bull market structure confirmed.",
                      "A bearish weekly EMA reading overrides bullish daily signals — the bigger picture wins.",
                      "Divergence between daily and weekly triggers the EMA Divergence alert banner.",
                      "Weekly EMAs change slowly — use them to set the directional bias for the week.",
                    ]} />
                )}
              </WidgetErrorBoundary>
              <WidgetErrorBoundary title="Momentum">
                {!data && loading ? <WidgetSkeleton className="h-32" /> : (
                  <MetricCard title="Momentum" value={data?.metrics?.momentum?.value || 0} icon={Zap}
                    status={data?.metrics?.momentum?.status} statusType={data?.metrics?.momentum?.type}
                    subMetrics={data?.metrics?.momentum?.subMetrics || []}
                    info={[
                      "Combines RSI, MACD, and Relative Volume to measure buying/selling pressure.",
                      "RSI(14): 40–70 range = healthy trend momentum. >70 = overbought. <30 = capitulation.",
                      "MACD Bullish Cross: MACD line crossed above signal line — upward momentum building.",
                      "MACD Bearish Cross: MACD dropped below signal — momentum fading, caution warranted.",
                      "Relative Volume: Current activity vs 20-day average. >1x confirms conviction behind moves.",
                    ]} />
                )}
              </WidgetErrorBoundary>
              <WidgetErrorBoundary title="Volatility">
                {!data && loading ? <WidgetSkeleton className="h-32" /> : (
                  <MetricCard title="Volatility" value={data?.metrics?.volatility?.value || 0} icon={Activity}
                    status={data?.metrics?.volatility?.status} statusType={data?.metrics?.volatility?.type}
                    subMetrics={data?.metrics?.volatility?.subMetrics || []}
                    info={[
                      "Measures market fear using VIX, its 52-week percentile, and Put/Call ratio.",
                      "VIX < 20: Complacency / low fear — institutional buyers active, safe to hold longs.",
                      "VIX 20–28: Elevated uncertainty — reduce leverage and tighten stop losses.",
                      "VIX > 28: Fear-driven selling likely — avoid new long positions.",
                      "VIX Percentile: Where today's VIX sits vs the past 52 weeks. >75th = extreme fear.",
                      "Put/Call Ratio: >1.0 = bearish bias (more puts bought). <0.7 = bullish bias (complacency).",
                      "BB Width: Bollinger Band squeeze (<5%) signals a large move is imminent.",
                    ]} />
                )}
              </WidgetErrorBoundary>
              <WidgetErrorBoundary title="Market Breadth">
                {!data && loading ? <WidgetSkeleton className="h-32" /> : (
                  <MetricCard title="Market Breadth" value={data?.metrics?.breadth?.value || 0} icon={BarChart3}
                    status={data?.metrics?.breadth?.status} statusType={data?.metrics?.breadth?.type}
                    subMetrics={data?.metrics?.breadth?.subMetrics || []}
                    info={[
                      "Two-layer breadth check: sector ETF performance + S&P 500 internal participation.",
                      "Sectors Positive: How many of 11 SPDR ETFs closed positive today.",
                      "Trending >20d: Sectors trading above their 20-day average = sustained demand.",
                      "% > 20MA (S&P): % of all S&P 500 stocks above their 20-day MA. >50% = short-term healthy.",
                      "% > 50MA (S&P): % above 50-day MA. >50% = intermediate uptrend is broad.",
                      "% > 200MA (S&P): % above 200-day MA. >50% = secular bull market intact. <30% = bear market.",
                    ]} />
                )}
              </WidgetErrorBoundary>
              <WidgetErrorBoundary title="Macro">
                {!data && loading ? <WidgetSkeleton className="h-32" /> : (
                  <MetricCard title="Macro" value={data?.metrics?.macro?.value || 0} icon={Globe}
                    status={data?.metrics?.macro?.status} statusType={data?.metrics?.macro?.type}
                    subMetrics={data?.metrics?.macro?.subMetrics || []}
                    info={[
                      "Measures headwinds from rising bond yields (10Y) and U.S. Dollar strength (DXY).",
                      "Rising yields = higher discount rate → reduces the present value of future earnings.",
                      "Rising dollar = tighter financial conditions globally, hurts multinational earnings.",
                      "Supportive: Both yields and dollar are flat/falling — equity tailwind.",
                      "Headwind: One spiking — be cautious. Hostile: Both spiking simultaneously — reduce all risk.",
                      "This is the macro 'weather forecast' for equities.",
                    ]} />
                )}
              </WidgetErrorBoundary>
            </div>

            {/* AI Assessment */}
            <WidgetErrorBoundary title="Terminal Analysis">
              {!data && loading ? <WidgetSkeleton className="h-24" /> : (
                <AITerminalAssessment
                  assessment={data?.ai?.assessment || "Analyzing market internals..."}
                  suggestedAction={data?.ai?.suggestedAction || "Monitor internals."}
                  riskLevel={data?.ai?.riskLevel || "Moderate"}
                />
              )}
            </WidgetErrorBoundary>

            {/* Conditions Checklist */}
            {(!data && loading) ? <WidgetSkeleton className="h-48" /> : data?.checklist && (
              <WidgetErrorBoundary title="Conditions Checklist">
                <ConditionsChecklist checklist={data.checklist} />
              </WidgetErrorBoundary>
            )}
          </div>

          {/* ── COL C: Sector + Readiness + Weights (4 cols) ──── */}
          <div className="col-span-12 md:col-span-6 xl:col-span-4 flex flex-col gap-4">

            {/* Sector Performance */}
            <WidgetErrorBoundary title="Sector Performance">
              {!data && loading ? <WidgetSkeleton className="h-48" /> : (
                <SectorPerformanceTerminal sectors={data?.sectors || []} />
              )}
            </WidgetErrorBoundary>

            {/* Signal Readiness */}
            {(!data && loading) ? <WidgetSkeleton className="h-40" /> : data?.signalReadiness && (
              <WidgetErrorBoundary title="Signal Readiness">
                <SignalReadiness signals={data.signalReadiness} score={data.totalScore} />
              </WidgetErrorBoundary>
            )}

            {/* Scoring Weights */}
            {(!data && loading) ? <WidgetSkeleton className="h-40" /> : data?.scoringWeights && (
              <WidgetErrorBoundary title="Score Breakdown">
                <ScoringWeights weights={data.scoringWeights} totalScore={data.totalScore} />
              </WidgetErrorBoundary>
            )}

          </div>
        </div>


      </div>
    </div>
  );
}
