/**
 * Converts raw Robinhood MCP historical-bar JSON (scripts/backtest-data/raw/<SYMBOL>.json)
 * into OHLCVData[]-shaped JSON (scripts/backtest-data/<SYMBOL>.json) for use by the
 * lightweight technical-score backtest (scripts/backtest-technical-score.ts).
 *
 * Input shape (raw, from get_equity_historicals):
 *   { data: { results: [ { symbol, bars: [ { begins_at, open_price, close_price,
 *       high_price, low_price, volume, ... } ] } ] } }
 *   (AAPL.json's raw file omits the outer "data" wrapper in one spot historically —
 *   handled defensively below.)
 *
 * Output shape (OHLCVData[], matches types/financial.ts):
 *   [ { time: number (epoch ms), open, high, low, close, volume } ]
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SYMBOLS = ['AAPL', 'NVDA', 'LLY', 'JPM', 'XOM', 'GE', 'SPY'];
const RAW_DIR = path.join(__dirname, 'backtest-data', 'raw');
const OUT_DIR = path.join(__dirname, 'backtest-data');

interface RawBar {
  begins_at: string;
  open_price: string;
  close_price: string;
  high_price: string;
  low_price: string;
  volume: number;
}

interface OHLCVData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function extractBars(raw: any): RawBar[] {
  // Handle both the standard {data:{results:[{bars}]}} envelope and the
  // flattened {symbol, bars} shape seen in one legacy file.
  if (raw?.data?.results?.[0]?.bars) return raw.data.results[0].bars;
  if (raw?.bars) return raw.bars;
  throw new Error('Unrecognized raw bar JSON shape');
}

function convert(symbol: string): OHLCVData[] {
  const rawPath = path.join(RAW_DIR, `${symbol}.json`);
  const raw = JSON.parse(fs.readFileSync(rawPath, 'utf-8'));
  const bars = extractBars(raw);

  const out: OHLCVData[] = bars.map((bar) => {
    const time = new Date(bar.begins_at).getTime();
    const open = Number(bar.open_price);
    const high = Number(bar.high_price);
    const low = Number(bar.low_price);
    const close = Number(bar.close_price);
    const volume = Number(bar.volume);

    if (!Number.isFinite(time) || !Number.isFinite(open) || !Number.isFinite(high) ||
        !Number.isFinite(low) || !Number.isFinite(close) || !Number.isFinite(volume)) {
      throw new Error(`${symbol}: non-finite field in bar ${JSON.stringify(bar)}`);
    }
    return { time, open, high, low, close, volume };
  });

  // Sanity: strictly increasing time, no duplicate/out-of-order bars.
  for (let i = 1; i < out.length; i++) {
    if (out[i].time <= out[i - 1].time) {
      throw new Error(`${symbol}: bars not strictly increasing at index ${i}`);
    }
  }

  return out;
}

function main() {
  console.log('Converting backtest raw data -> OHLCVData[]...\n');
  const summary: Record<string, { bars: number; first: string; last: string }> = {};

  for (const symbol of SYMBOLS) {
    const converted = convert(symbol);
    const outPath = path.join(OUT_DIR, `${symbol}.json`);
    fs.writeFileSync(outPath, JSON.stringify(converted));
    summary[symbol] = {
      bars: converted.length,
      first: new Date(converted[0].time).toISOString().slice(0, 10),
      last: new Date(converted[converted.length - 1].time).toISOString().slice(0, 10),
    };
    console.log(`  ${symbol.padEnd(5)} -> ${converted.length} bars  [${summary[symbol].first} .. ${summary[symbol].last}]  ${outPath}`);
  }

  console.log('\nDone.');
}

main();
