"use client";

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { fetchOHLCV } from '../lib/api';
import { REFRESH_INTERVALS, isMarketActive, getMarketSession, getNextMarketOpen } from '../lib/refresh-utils';
import { fetchStockNews, fetchSocialSentiment, fetchAnalystRatings, NewsItem } from '../lib/news';
import { OHLCVData, IndicatorData } from '../types/financial';
import { calculateIndicators } from '../lib/indicators';
import { calculatePriceStats, PriceStats } from '../lib/stats';
import { OptionRecommendation } from '../lib/options';

import { detectPatterns } from '../lib/patterns';
// import PriceChart from '../components/PriceChart'; // Removed
import Sidebar from '../components/Sidebar';
import LoginOverlay from '../components/LoginOverlay';
import HighlightStats from '../components/HighlightStats';

import OptionsSignal from '../components/OptionsSignal';
import TopOptionsList from '../components/TopOptionsList';
import DeepDiveContent from '../components/DeepDiveContent';
import HeaderSentiment from '../components/HeaderSentiment';
import HeaderSignals from '../components/HeaderSignals';
import HeaderPattern from '../components/HeaderPattern';
import HeaderAnalyst from '../components/HeaderAnalyst';
import HeaderFundamentals from '../components/HeaderFundamentals';

import NewsFeed from '../components/NewsFeed';
import LivePriceDisplay from '../components/LivePriceDisplay';
import { Loading } from '@/components/ui/Loading';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Zap, ChevronRight, Activity, RefreshCw, Database } from 'lucide-react';
import SectorPerformanceWidget from '../components/SectorPerformanceWidget';
import SectorDetailModal from '../components/SectorDetailModal';

interface SectorGroup {
  name: string;
  avgChange: number;
  stocks: any[];
}

export default function Dashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const urlSymbol = searchParams.get('symbol');

  const [data, setData] = useState<IndicatorData[]>([]);
  const [companyName, setCompanyName] = useState<string>('');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [analystData, setAnalystData] = useState<NewsItem[]>([]);
  const [stats, setStats] = useState<PriceStats | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Initialize from localStorage if available, otherwise default to SPY
  const [symbol, setSymbol] = useState('SPY');
  const [stockInput, setStockInput] = useState('SPY');
  const [refreshTrigger, setRefreshTrigger] = useState(0); // For manual refresh
  const [priceRefreshKey, setPriceRefreshKey] = useState(0); // Synchronized 60s price timer for header + deep dive

  const handleManualRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
    setPriceRefreshKey(prev => prev + 1); // Also sync price on manual refresh
  };

  // Load initial symbol from localStorage on mount (client-side only)
  // Initial symbol loading logic moved to combined effect below to prevent race conditions

  const [interval, setIntervalState] = useState('1d'); // 15m, 1h, 4h, 1d
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Viewport (number of bars)
  const [viewScope, setViewScope] = useState(365);

  // Sidebar Layout State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Persistence: Load sidebar state on mount
  useEffect(() => {
    const saved = localStorage.getItem('sidebarExpanded');
    if (saved !== null) {
      setIsSidebarOpen(saved === 'true');
    }
  }, []);

  // Persistence: Save sidebar state on change
  useEffect(() => {
    localStorage.setItem('sidebarExpanded', isSidebarOpen.toString());
  }, [isSidebarOpen]);

  // Custom Auth Session
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Check for session via server API (since cookie is httpOnly)
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/session');
        setIsAuthenticated(res.ok);
      } catch (e) {
        setIsAuthenticated(false);
      }
    };
    checkSession();
  }, []);

  // Derived Summary & Sentiment
  const [selectedSector, setSelectedSector] = useState<SectorGroup | null>(null);


  const sentimentScore = useMemo(() => {
    if (!news.length) return 50;
    let score = 50;
    news.forEach(n => {
      if (n.sentiment === 'positive') score += 10;
      if (n.sentiment === 'negative') score -= 10;
    });
    return Math.max(0, Math.min(100, score));
  }, [news]);

  // Effect to handle URL params
  useEffect(() => {
    if (urlSymbol) {
      setSymbol(urlSymbol);
      // Also update the stockInput to match so it doesn't look weird
      setStockInput(urlSymbol);
      // Force loading state reset to ensure UI feedback
      setLoading(true);
    }
  }, [urlSymbol]);

  // Debounce stock input (only if user is typing, not if URL changed)
  useEffect(() => {
    const handler = setTimeout(() => {
      const trimmedInput = stockInput.trim().toUpperCase();
      if (trimmedInput && trimmedInput !== symbol) {
        console.log('[Dashboard] Debounce triggering update for:', trimmedInput);
        setSymbol(trimmedInput);
      }
    }, 800);

    return () => {
      clearTimeout(handler);
    };
  }, [stockInput, symbol]);

  const handleSymbolSelect = (sym: string) => {
    setSymbol(sym);
    setStockInput(sym);
    // Mobile sidebar handling logic moved here if needed, or kept inline
  };

  // Sync symbol to URL and localStorage
  // Initialize symbol state safely to avoid overwriting localStorage on mount
  const [isInitialized, setIsInitialized] = useState(false);

  // Load initial symbol from URL or localStorage on mount (client-side only)
  useEffect(() => {
    if (urlSymbol) {
      setSymbol(urlSymbol);
      setStockInput(urlSymbol);
      setIsInitialized(true);
    } else {
      const savedSymbol = localStorage.getItem('lastTicker');
      if (savedSymbol) {
        setSymbol(savedSymbol);
        setStockInput(savedSymbol);
      }
      setIsInitialized(true);
    }
  }, [urlSymbol]);

  // Sync symbol to URL and localStorage
  useEffect(() => {
    if (isInitialized && symbol) {
      // 1. Save to localStorage
      localStorage.setItem('lastTicker', symbol);

      // 2. Update URL silently without a full reload
      const params = new URLSearchParams(searchParams.toString());
      if (params.get('symbol') !== symbol) {
        params.set('symbol', symbol);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      }
    }
  }, [symbol, router, pathname, searchParams, isInitialized]);

  // Load Data
  useEffect(() => {
    let ignore = false;

    const loadData = async () => {
      setLoading(true);
      setError('');
      setData([]); // Clear old data immediately to prevent stale UI
      setStats(null);
      setNews([]);
      setAnalystData([]);
      setOptionsSignal(null); // Clear signal too
      setTop3Options([]); // Clear discovery too

      const targetSymbol = symbol;
      console.log('[Dashboard] loadData triggered for symbol:', targetSymbol);

      if (!targetSymbol) {
        setLoading(false);
        return;
      }

      try {
        // Fetch OHLCV
        const response = await fetchOHLCV(targetSymbol, '1825', 'stocks', interval);
        const rawData = response.data;

        if (ignore) return;

        // Set company name
        setCompanyName(response.companyName || targetSymbol);

        if (!rawData || rawData.length === 0) {
          setError('Failed to load data. Invalid symbol or API error.');
          setData([]);
          setStats(null);
        } else {
          const withIndicators = calculateIndicators(rawData);
          const withPatterns = detectPatterns(withIndicators); // Detect patterns
          const computedStats = calculatePriceStats(rawData);

          setData(withPatterns); // Set data with patterns
          setStats(computedStats);
          setLastUpdated(new Date());

          // Determine simplistic trend for news generation
          const latest = withPatterns[withPatterns.length - 1]; // Use withPatterns
          let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';

          if (latest.ema50 && latest.close > latest.ema50) {
            trend = 'bullish';
          } else if (latest.ema50 && latest.close < latest.ema50) {
            trend = 'bearish';
          }

          // Neutralize if RSI is extreme (reversal warning)
          if (latest.rsi14) {
            if (latest.rsi14 > 70 && trend === 'bullish') trend = 'neutral'; // Overbought
            if (latest.rsi14 < 30 && trend === 'bearish') trend = 'neutral'; // Oversold
          }

          // Fetch News & Analyst Concurrent
          const [newsItems, analystItems] = await Promise.all([
            fetchStockNews(targetSymbol, trend),
            fetchAnalystRatings(targetSymbol)
          ]);

          if (!ignore) {
            setNews(newsItems);
            setAnalystData(analystItems);
          }
        }
      } catch (err) {
        if (!ignore) {
          setError('An unexpected error occurred.');
          setData([]);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    // Initial Load
    loadData();

    // 1. Synchronized Price Refresh (60s) — drives BOTH header LivePriceDisplay and Deep Dive
    const priceInterval = setInterval(() => {
      if (document.hidden || ignore || !isMarketActive()) return;
      setPriceRefreshKey(prev => prev + 1);
    }, REFRESH_INTERVALS.PRICE);

    // 2. Chart & Deep Dive Data (15 Minutes) - MEDIUM - Universal Auto-Refresh
    const dataInterval = setInterval(() => {
      if (!document.hidden && !ignore && isMarketActive()) {
        console.log('[Auto-Refresh] Fetching Chart & Deep Dive Data (15m)...');
        // Manual refresh triggers everything else
        handleManualRefresh();
      }
    }, REFRESH_INTERVALS.AUTO_REFRESH);

    // 3. News (2 Hours) - SLOW
    const newsInterval = setInterval(() => {
      if (!document.hidden && !ignore && isMarketActive()) {
        console.log('[Auto-Refresh] Fetching News (2h)...');
        fetchStockNews(symbol, 'neutral').then(setNews);
      }
    }, REFRESH_INTERVALS.NEWS);

    return () => {
      ignore = true;
      clearInterval(priceInterval);
      clearInterval(dataInterval);
      clearInterval(newsInterval);
    };
  }, [symbol, interval, isAuthenticated, refreshTrigger]);

  const chartData = data.slice(-viewScope);

  // Dynamic View Scope Buttons
  const renderViewControls = () => {
    if (interval === '1d') {
      return (
        <div className="flex space-x-2">
          <button onClick={() => setViewScope(90)} className={`px-3 py-1 text-xs rounded-full border ${viewScope === 90 ? 'bg-gray-700 text-white border-gray-500' : 'text-gray-100 border-gray-700 hover:border-gray-500'}`}>3M</button>
          <button onClick={() => setViewScope(365)} className={`px-3 py-1 text-xs rounded-full border ${viewScope === 365 ? 'bg-gray-700 text-white border-gray-500' : 'text-gray-100 border-gray-700 hover:border-gray-500'}`}>1Y</button>
          <button onClick={() => setViewScope(1825)} className={`px-3 py-1 text-xs rounded-full border ${viewScope === 1825 ? 'bg-gray-700 text-white border-gray-500' : 'text-gray-100 border-gray-700 hover:border-gray-500'}`}>5Y</button>
        </div>
      );
    }
    const setBars = (label: string, bars: number) => (
      <button key={label} onClick={() => setViewScope(bars)} className={`px-3 py-1 text-xs rounded-full border ${viewScope === bars ? 'bg-gray-700 text-white border-gray-500' : 'text-gray-100 border-gray-700 hover:border-gray-500'}`}>{label}</button>
    );

    if (interval === '15m') return <div className="flex space-x-2">{[setBars('1D', 96), setBars('3D', 288), setBars('1W', 672)]}</div>;
    if (interval === '1h') return <div className="flex space-x-2">{[setBars('3D', 72), setBars('1W', 168), setBars('1M', 720)]}</div>;
    return <div className="flex space-x-2">{[setBars('Short', 100), setBars('Med', 300), setBars('Long', 600)]}</div>;
  };

  // Determine Trend for Analyst Widget Display
  const latest = data[data.length - 1];
  let currentTrend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (latest && latest.ema50) {
    if (latest.close > latest.ema50) currentTrend = 'bullish';
    else if (latest.close < latest.ema50) currentTrend = 'bearish';
  }

  // Calculate Options Signal for Dashboard Widget
  // Now async, so we use a state effect
  const [optionsSignal, setOptionsSignal] = useState<OptionRecommendation | null>(null);
  const [top3Options, setTop3Options] = useState<OptionRecommendation[]>([]);

  useEffect(() => {
    let ignore = false;
    const fetchSignal = async () => {
      // Clear old data immediately to prevent stale UI during load
      setOptionsSignal(null);
      setTop3Options([]);

      if (latest && stats && latest.atr14) {
        try {
          // 1. Fetch Option Signal via API
          const sigRes = await fetch('/api/options/signal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              currentPrice: latest.close,
              atr: latest.atr14,
              trend: currentTrend,
              rsi: latest.rsi14 || 50,
              ema50: latest.ema50,
              indicators: latest,
              symbol: symbol,
              fundamentalConfirmations: analystData.filter(a => a.sentiment === (currentTrend === 'bullish' ? 'positive' : 'negative')).length,
              socialConfirmations: Math.floor(Math.abs(sentimentScore - 50) / 15) + 1
            })
          });
          if (sigRes.ok && !ignore) {
            const sig = await sigRes.json();
            setOptionsSignal(sig);
          }

          // 2. Fetch Top 3 Options via API
          if (symbol && !ignore) {
            const topRes = await fetch(`/api/options/discovery?symbol=${symbol}&price=${latest.close}&trend=${currentTrend}&rsi=${latest.rsi14 || 50}`);
            if (topRes.ok && !ignore) {
              const top = await topRes.json();
              setTop3Options(top);
            }
          }
        } catch (e) {
          if (!ignore) console.error('Failed to fetch options data from server:', e);
        }
      }
    };
    fetchSignal();
    return () => { ignore = true; };
  }, [latest, stats, currentTrend, analystData.length, sentimentScore, symbol, refreshTrigger]);

  // 4. Passive Tracking Update Trigger (Market Close)
  useEffect(() => {
    const checkAndTriggerUpdate = async () => {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const hour = now.getHours();

      // Trigger if it's after 4 PM and hasn't been triggered today
      if (hour >= 16) {
        const lastPassiveUpdate = localStorage.getItem('lastPassiveTrackingUpdate');
        if (lastPassiveUpdate !== today) {
          console.log('[Passive-Trigger] Market closed. Triggering performance tracking update...');
          try {
            const res = await fetch('/api/options/track/update');
            if (res.ok) {
              localStorage.setItem('lastPassiveTrackingUpdate', today);
              console.log('[Passive-Trigger] Performance tracking updated successfully.');
            }
          } catch (e) {
            console.error('[Passive-Trigger] Failed to trigger update:', e);
          }
        }
      }
    };

    // Slight delay to not compete with initial data load
    const timer = setTimeout(checkAndTriggerUpdate, 5000);
    return () => clearTimeout(timer);
  }, []);

  if (isAuthenticated === null) return <Loading message="Authenticating session..." />;

  if (!isAuthenticated) return <LoginOverlay onLoginSuccess={() => setIsAuthenticated(true)} />;

  return (
    <main className="flex h-screen bg-gray-900 overflow-hidden font-sans text-gray-100 relative">
      {/* Sidebar - Drawer on Mobile, Fixed Sidebar on Desktop */}
      <div
        className={`fixed inset-0 z-[100] transition-opacity duration-300 md:hidden ${isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsSidebarOpen(false)}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      </div>

      <div className={`
        fixed inset-y-0 left-0 z-[110] transition-transform duration-300 ease-in-out md:relative md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isSidebarOpen ? 'w-[18vw] min-w-[200px]' : 'w-0'} 
        h-full overflow-hidden flex-shrink-0 border-r border-gray-800
      `}>
        <Sidebar
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          symbol={symbol}
          setSymbol={setSymbol}
          stockInput={stockInput}
          setStockInput={setStockInput}
          interval={interval}
          setInterval={setIntervalState}
          data={data}
          loading={loading}
          currentPage="dashboard"
          stats={stats}
          sentimentScore={sentimentScore}
          onSectorClick={(sector) => {
            setSelectedSector(sector);
            // Auto-close sidebar on mobile after selection
            if (window.innerWidth < 768) {
              setIsSidebarOpen(false);
            }
          }}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Toggle Button for Sidebar when closed */}
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-[70] bg-blue-600/90 hover:bg-blue-500 p-2 pr-3 rounded-r-xl border-y border-r border-blue-400/50 text-white transition-all hover:pl-4 group shadow-[0_0_20px_rgba(37,99,235,0.4)] flex items-center gap-1 overflow-hidden"
            title="Open Sidebar"
          >
            <ChevronRight className="w-6 h-6 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Expand</span>
          </button>
        )}
        <div className="flex-1 p-4 md:p-6 flex flex-col overflow-y-auto w-full pt-16 md:pt-6 transition-all duration-300">
          <header className="flex flex-col gap-4 mb-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {/* LEFT: Ticker, Price */}
              <div className="flex flex-wrap items-center gap-4 md:gap-8 w-full md:w-auto">
                {/* 1. Ticker Selector */}
                <div className="flex items-center gap-2">
                  <div className="relative group">
                    <input
                      type="text"
                      value={stockInput}
                      onChange={(e) => setStockInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const trimmedInput = stockInput.trim().toUpperCase();
                          if (trimmedInput) {
                            setSymbol(trimmedInput);
                          }
                        }
                      }}
                      className="text-3xl md:text-4xl font-black bg-transparent border-none focus:outline-none text-white tracking-tighter uppercase w-24 md:w-32 placeholder-gray-700"
                      placeholder="TICKER"
                      disabled={loading}
                    />
                    <div className="absolute bottom-0 left-0 w-0 h-1 bg-blue-500 transition-all group-hover:w-full"></div>
                  </div>
                </div>
                {companyName && (
                  <span className="text-sm text-gray-100 font-medium hidden md:inline truncate max-w-[180px]">{companyName}</span>
                )}

                {/* 2. Price & Change Info */}
                <div className="flex flex-col">
                  <LivePriceDisplay
                    symbol={symbol}
                    fallbackPrice={stats?.currentPrice}
                    enabled={!loading}
                    showChange={true}
                    refreshKey={priceRefreshKey}
                  />
                  {lastUpdated && (
                    <span className="text-[10px] text-gray-400 font-mono mt-1">
                      Last Updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  )}
                </div>

                {/* 3. Mini Signals (Trend Only) & Analyst */}
                <div className="flex flex-row items-center gap-2 flex-wrap sm:flex-nowrap">
                  <HeaderFundamentals symbol={symbol} />
                  {data.length > 0 && <HeaderSignals latestData={data[data.length - 1]} showRSI={true} />}
                  <HeaderAnalyst symbol={symbol} analystNews={analystData} />
                </div>
              </div>

              <LivePriceDisplay
                symbol={symbol}
                enabled={true}
                refreshKey={priceRefreshKey}
                showChange={false}
                fallbackPrice={stats?.currentPrice}
                className="status-badge-only"
              />
            </div>
          </header>

          {loading ? (
            <Loading message="Fetching dashboard data..." />
          ) : (
            <div className="space-y-6">


              {/* ROW 1: Deep Dive (Left, 3/4) & AI Option Play + Price Stats (Right, 1/4) */}
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 mb-6">
                {/* Deep Dive - Takes 3/4 - FIRST in DOM = LEFT */}
                <div className="xl:col-span-3 overflow-x-auto pb-2 scrollbar-hide">
                  <div className="min-w-[600px] lg:min-w-0">
                    <DeepDiveContent
                      key={symbol}
                      symbol={symbol}
                      showOptionsFlow={false}
                      onRefresh={handleManualRefresh}
                      refreshKey={priceRefreshKey}
                    />
                  </div>
                </div>

                {/* Right Column - AI Option Play + Price Stats stacked vertically */}
                <div className="xl:col-span-1 space-y-6">
                  <div className="bg-gray-800/10 rounded-xl">
                    <h3 className="text-sm font-bold text-gray-100 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-blue-400" /> Tactical Option Play
                    </h3>
                    <OptionsSignal
                      data={optionsSignal}
                      loading={loading}
                      onRefresh={handleManualRefresh}
                      companyName={companyName}
                      underlyingPrice={latest?.close}
                    />
                  </div>

                  {/* Price Statistics - Below AI Option Play */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-100 uppercase tracking-wider mb-2 px-1 text-center lg:text-left">Price Statistics</h3>
                    <HighlightStats stats={stats} />
                  </div>
                </div>
              </div>

              {/* TOP 3 OPTIONS DISCOVERY (Moved below Deep Dive) */}
              <div className="space-y-6">
                <TopOptionsList
                  options={top3Options}
                  symbol={symbol || ''}
                  loading={loading || (top3Options.length === 0 && !error)}
                  companyName={companyName}
                  underlyingPrice={latest?.close}
                />
              </div>

              {/* ROW 5: Live News - BELOW AI Insight */}
              <div>
                <h3 className="text-sm font-bold text-gray-100 uppercase tracking-wider mb-4 px-1 text-center lg:text-left">Live Intelligence</h3>
                <NewsFeed news={news} loading={loading} />
              </div>
            </div>
          )}

          <div className="h-6"></div> {/* Bottom Spacer */}
        </div>

        {/* Sector Detail Modal */}
        <SectorDetailModal
          sector={selectedSector}
          onClose={() => setSelectedSector(null)}
          onSelectStock={(s) => {
            setStockInput(s);
            setSymbol(s);
          }}
        />
      </div>
    </main>
  );
}
