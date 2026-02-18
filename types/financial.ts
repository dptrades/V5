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
  ema9?: number;
  ema21?: number;
  ema50?: number;
  ema200?: number;

  rsi14?: number;
  macd?: MACDOutput;
  bollinger?: BollingerBandsOutput;

  vwap?: number;
  atr14?: number;
  adx14?: number;

  fvg?: {
    type: 'BULLISH' | 'BEARISH' | 'NONE';
    gapLow: number;
    gapHigh: number;
  };

  pattern?: {
    name: 'Doji' | 'Hammer' | 'Shooting Star' | 'Bullish Engulfing' | 'Bearish Engulfing' | 'None';
    signal: 'bullish' | 'bearish' | 'neutral';
  };
}

export interface ChartDataPoints {
  date: string;
  price: number;
  // ... any other flat fields needed for Recharts
  [key: string]: string | number | undefined;
}
