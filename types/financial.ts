export interface OHLCVData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}


export interface MACDOutput {
  MACD?: number;
  signal?: number;
  histogram?: number;
}

export interface BollingerBandsOutput {
  middle?: number;
  upper?: number;
  lower?: number;
  pb?: number;
}

export interface IndicatorData extends OHLCVData {
  timeframe?: string;
  ema9?: number;
  ema21?: number;
  ema50?: number;
  ema100?: number;
  ema200?: number;

  rsi14?: number;
  macd?: MACDOutput;
  bollinger?: BollingerBandsOutput;

  vwap?: number;
  atr14?: number;
  adx14?: number;
  squeeze?: boolean;
  keltner?: {
    upper: number;
    middle: number;
    lower: number;
  };

  fvg?: {
    type: 'BULLISH' | 'BEARISH' | 'NONE';
    gapLow: number;
    gapHigh: number;
  };

  pattern?: {
    name: 'Doji' | 'Hammer' | 'Shooting Star' | 'Bullish Engulfing' | 'Bearish Engulfing' | 'Morning Star' | 'Evening Star' | 'Piercing Line' | 'Dark Cloud Cover' | 'None';
    signal: 'bullish' | 'bearish' | 'neutral';
  };
  divergence?: {
    type: 'BULLISH' | 'BEARISH' | 'NONE';
    price?: number;
    rsi?: number;
  };
}

export interface ChartDataPoints {
  date: string;
  price: number;
  // ... any other flat fields needed for Recharts
  [key: string]: string | number | undefined;
}


export interface ConfluenceResult {
    bullScore: number;
    bearScore: number;
    bullSignals: string[];
    bearSignals: string[];
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    strength: number; // 0-100 normalized tech score
}

export interface MultiTimeframeConfluenceResult {
    score: number;
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    reasons: string[];
    executionAction: 'BUY' | 'WAIT';
    executionReasons: string[];
    timeframeDetails: {
        [key: string]: {
            score: number;
            trend: string;
            signals: string[];
        };
    };
}

export interface NewsItem {
    id: string;
    title: string;
    source: string;
    time: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    url: string;
}
