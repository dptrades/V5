export const SECTOR_MAP: Record<string, string> = {
    // Information Technology
    NVDA: 'Information Technology', AMD: 'Information Technology', AAPL: 'Information Technology', MSFT: 'Information Technology',
    META: 'Communication Services', GOOGL: 'Communication Services', INTC: 'Information Technology',
    PLTR: 'Information Technology', TSM: 'Information Technology', AVGO: 'Information Technology', ORCL: 'Information Technology',
    CGNX: 'Information Technology', FSLY: 'Information Technology', IPGP: 'Information Technology',
    // Consumer Discretionary
    TSLA: 'Consumer Discretionary', AMZN: 'Consumer Discretionary', HD: 'Consumer Discretionary', MCD: 'Consumer Discretionary',
    NKE: 'Consumer Discretionary', RIVN: 'Consumer Discretionary', LCID: 'Consumer Discretionary', GME: 'Consumer Discretionary',
    SPHR: 'Consumer Discretionary', CROX: 'Consumer Discretionary', DKNG: 'Consumer Discretionary',
    // Financials
    JPM: 'Financials', BAC: 'Financials', WFC: 'Financials', C: 'Financials',
    GS: 'Financials', MS: 'Financials', V: 'Financials', MA: 'Financials',
    COIN: 'Financials', HOOD: 'Financials', SOFI: 'Financials', PYPL: 'Financials',
    'BRK-B': 'Financials', BLK: 'Financials',
    // Communication Services
    NFLX: 'Communication Services', DIS: 'Communication Services', T: 'Communication Services', VZ: 'Communication Services',
    // Health Care
    LLY: 'Health Care', JNJ: 'Health Care', ABBV: 'Health Care', MRK: 'Health Care', PFE: 'Health Care', UNH: 'Health Care',
    TMO: 'Health Care',
    // Energy
    XOM: 'Energy', CVX: 'Energy', OXY: 'Energy', COP: 'Energy', SLB: 'Energy',
    'CL=F': 'Energy', 'NG=F': 'Energy',
    // Industrials
    CAT: 'Industrials', BA: 'Industrials', GE: 'Industrials', UNP: 'Industrials',
    HON: 'Industrials',
    // Consumer Staples
    WMT: 'Consumer Staples', PG: 'Consumer Staples', COST: 'Consumer Staples', PEP: 'Consumer Staples', KO: 'Consumer Staples',
    // Materials
    'GC=F': 'Materials', 'SI=F': 'Materials',
    'HG=F': 'Materials', 'ALI=F': 'Materials',
    GLD: 'Materials', SLV: 'Materials', GDX: 'Materials', GDXJ: 'Materials',
    XLB: 'Materials',
    // Real Estate
    XLRE: 'Real Estate',
    // Utilities
    XLU: 'Utilities',

    // ETF / Proxy / High Beta Stocks (mapped to sectors)
    MSTR: 'Information Technology', MARA: 'Information Technology',

    // Indices (Hidden from Heatmap)
    SPY: 'Indices', QQQ: 'Indices', IWM: 'Indices', DIA: 'Indices',
    '^GSPC': 'Indices', '^IXIC': 'Indices',

    // Sector ETFs (Internal mapping)
    XLK: 'Information Technology', XLF: 'Financials', XLE: 'Energy', XLY: 'Consumer Discretionary',
    XLP: 'Consumer Staples', XLV: 'Health Care', XLI: 'Industrials', XLC: 'Communication Services',

    // Market Internals
    '^VIX': 'Internals',
    'DX-Y.NYB': 'Internals',

    // Bonds & Forex
    '^TNX': 'Bonds', '^TYX': 'Bonds', '^FVX': 'Bonds',
    'EURUSD=X': 'Forex', 'JPY=X': 'Forex', 'GBPUSD=X': 'Forex', 'CAD=X': 'Forex',

    // Extended Tech
    ADBE: 'Information Technology', CRM: 'Information Technology', CSCO: 'Information Technology',
    QCOM: 'Information Technology', TXN: 'Information Technology', AMAT: 'Information Technology', INTU: 'Information Technology',
};

// Dynamic Sector Map Helper
import { getDynamicSectorMap } from './sector-service';

export const SCANNER_WATCHLIST = Object.keys(SECTOR_MAP);

export async function getSectorMap(): Promise<Record<string, string>> {
    try {
        return await getDynamicSectorMap();
    } catch (e) {
        console.warn("⚠️ Dynamic Sector Map failed, falling back to static map.");
        return SECTOR_MAP;
    }
}
