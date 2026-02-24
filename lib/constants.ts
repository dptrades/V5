export const SECTOR_MAP: Record<string, string> = {
    // Information Technology
    NVDA: 'Information Technology', AMD: 'Information Technology', AAPL: 'Information Technology', MSFT: 'Information Technology',
    INTC: 'Information Technology', PLTR: 'Information Technology', TSM: 'Information Technology', AVGO: 'Information Technology', ORCL: 'Information Technology',
    CGNX: 'Information Technology', FSLY: 'Information Technology', IPGP: 'Information Technology', KEYS: 'Information Technology',
    ADBE: 'Information Technology', CRM: 'Information Technology', CSCO: 'Information Technology',
    QCOM: 'Information Technology', TXN: 'Information Technology', AMAT: 'Information Technology', INTU: 'Information Technology', IBM: 'Information Technology',

    // Consumer Discretionary
    TSLA: 'Consumer Discretionary', AMZN: 'Consumer Discretionary', HD: 'Consumer Discretionary', MCD: 'Consumer Discretionary',
    NKE: 'Consumer Discretionary', RIVN: 'Consumer Discretionary', LCID: 'Consumer Discretionary', GME: 'Consumer Discretionary',
    SPHR: 'Consumer Discretionary', CROX: 'Consumer Discretionary', DKNG: 'Consumer Discretionary',
    BKNG: 'Consumer Discretionary', SBUX: 'Consumer Discretionary', LOW: 'Consumer Discretionary', TJX: 'Consumer Discretionary', CMG: 'Consumer Discretionary',

    // Financials
    JPM: 'Financials', BAC: 'Financials', WFC: 'Financials', C: 'Financials',
    GS: 'Financials', MS: 'Financials', V: 'Financials', MA: 'Financials',
    COIN: 'Financials', HOOD: 'Financials', SOFI: 'Financials', PYPL: 'Financials',
    'BRK-B': 'Financials', BLK: 'Financials', AXP: 'Financials', SCHW: 'Financials', SPGI: 'Financials',

    // Communication Services
    META: 'Communication Services', GOOGL: 'Communication Services', NFLX: 'Communication Services', DIS: 'Communication Services',
    T: 'Communication Services', VZ: 'Communication Services', CMCSA: 'Communication Services', CHTR: 'Communication Services', TMUS: 'Communication Services', WBD: 'Communication Services',
    EA: 'Communication Services', TTWO: 'Communication Services', OMC: 'Communication Services', IPG: 'Communication Services', LYV: 'Communication Services',

    // Health Care
    LLY: 'Health Care', JNJ: 'Health Care', ABBV: 'Health Care', MRK: 'Health Care', PFE: 'Health Care', UNH: 'Health Care',
    TMO: 'Health Care', DHR: 'Health Care', ABT: 'Health Care', AMGN: 'Health Care',
    ISRG: 'Health Care', SYK: 'Health Care', MDT: 'Health Care', VRTX: 'Health Care', REGN: 'Health Care',

    // Energy
    XOM: 'Energy', CVX: 'Energy', OXY: 'Energy', COP: 'Energy', SLB: 'Energy',
    'CL=F': 'Energy', 'NG=F': 'Energy', EOG: 'Energy', MPC: 'Energy', PSX: 'Energy', VLO: 'Energy', HES: 'Energy',
    PXD: 'Energy', KMI: 'Energy', WMB: 'Energy', HAL: 'Energy', BKR: 'Energy',

    // Industrials (Including Defense/Aero)
    CAT: 'Industrials', BA: 'Industrials', GE: 'Industrials', UNP: 'Industrials',
    HON: 'Industrials', LMT: 'Industrials', RTX: 'Industrials', GD: 'Industrials', NOC: 'Industrials', TDG: 'Industrials',
    DE: 'Industrials', EMR: 'Industrials', ETN: 'Industrials',
    ADP: 'Industrials', WM: 'Industrials', CSX: 'Industrials',

    // Consumer Staples
    WMT: 'Consumer Staples', PG: 'Consumer Staples', COST: 'Consumer Staples', PEP: 'Consumer Staples', KO: 'Consumer Staples',
    PM: 'Consumer Staples', MO: 'Consumer Staples', TGT: 'Consumer Staples', EL: 'Consumer Staples', CL: 'Consumer Staples',
    KMB: 'Consumer Staples', MDLZ: 'Consumer Staples', SYY: 'Consumer Staples', ADM: 'Consumer Staples', HSY: 'Consumer Staples',

    // Materials
    'GC=F': 'Materials', 'SI=F': 'Materials',
    'HG=F': 'Materials', 'ALI=F': 'Materials',
    GLD: 'Materials', SLV: 'Materials', GDX: 'Materials', GDXJ: 'Materials',
    XLB: 'Materials', LIN: 'Materials', SHW: 'Materials', FCX: 'Materials', ECL: 'Materials', NEM: 'Materials', APD: 'Materials', NUE: 'Materials', DOW: 'Materials', CTVA: 'Materials', VMC: 'Materials',
    DD: 'Materials', PPG: 'Materials', MLM: 'Materials', CE: 'Materials',

    // Real Estate
    XLRE: 'Real Estate', PLD: 'Real Estate', AMT: 'Real Estate', EQIX: 'Real Estate', CCI: 'Real Estate', PSA: 'Real Estate', O: 'Real Estate', SPG: 'Real Estate', WELL: 'Real Estate', DLR: 'Real Estate', CSGP: 'Real Estate',
    VICI: 'Real Estate', AVB: 'Real Estate', EQR: 'Real Estate', INVH: 'Real Estate', MAA: 'Real Estate',

    // Utilities
    XLU: 'Utilities', NEE: 'Utilities', SO: 'Utilities', DUK: 'Utilities', SRE: 'Utilities', AEP: 'Utilities', D: 'Utilities', EXC: 'Utilities', XEL: 'Utilities', ED: 'Utilities', PEG: 'Utilities',
    AWK: 'Utilities', PCG: 'Utilities', WEC: 'Utilities', ES: 'Utilities', ETR: 'Utilities',

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
