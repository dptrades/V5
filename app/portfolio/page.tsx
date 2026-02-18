'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    ArrowLeft,
    RefreshCw,
    TrendingUp,
    TrendingDown,
    DollarSign,
    Activity,
    Play,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Clock,
    ChevronRight
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { useRouter } from 'next/navigation';
import LoginOverlay from '../../components/LoginOverlay';

interface Position {
    symbol: string;
    qty: number;
    avgPrice: number;
    currentPrice: number;
    marketValue: number;
    unrealizedPL: number;
    unrealizedPLPercent: number;
}

interface Order {
    id: string;
    symbol: string;
    side: 'buy' | 'sell';
    qty: number;
    status: string;
    filledPrice: number | null;
    createdAt: string;
}

interface PortfolioData {
    account: {
        equity: number;
        buyingPower: number;
        cash: number;
        portfolioValue: number;
    };
    positions: Position[];
    recentOrders: Order[];
}

interface TradeResult {
    symbol: string;
    status: string;
    orderId?: string;
    qty?: number;
    estimatedCost?: number;
    reason?: string;
}

export default function PortfolioPage() {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
    const [loading, setLoading] = useState(true);
    const [executing, setExecuting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tradeResults, setTradeResults] = useState<TradeResult[] | null>(null);
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
    const [symbol, setSymbol] = useState('SPY');
    const [stockInput, setStockInput] = useState('');
    const router = useRouter();

    useEffect(() => {
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

    const fetchPortfolio = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/auto-trade');
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to fetch portfolio');
            }
            const data = await response.json();
            setPortfolio(data);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to fetch portfolio');
        } finally {
            setLoading(false);
        }
    }, []);

    const executeTrades = async () => {
        setExecuting(true);
        setTradeResults(null);
        setError(null);
        try {
            const response = await fetch('/api/auto-trade', {
                method: 'POST'
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to execute trades');
            }

            if (data.trades) {
                setTradeResults(data.trades);
            }

            // Refresh portfolio after trades
            await fetchPortfolio();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to execute trades');
        } finally {
            setExecuting(false);
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
            fetchPortfolio();
        }
    }, [isAuthenticated, fetchPortfolio]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(value);
    };

    const formatPercent = (value: number) => {
        const sign = value >= 0 ? '+' : '';
        return `${sign}${value.toFixed(2)}%`;
    };

    const handleReset = async () => {
        if (!confirm('Are you sure? This will close all positions and cancel all orders.')) return;

        setLoading(true);
        try {
            const response = await fetch('/api/admin/reset-portfolio', { method: 'POST' });
            if (!response.ok) throw new Error('Reset failed');

            // Refresh after reset
            await fetchPortfolio();
        } catch (e) {
            setError('Failed to reset portfolio');
        } finally {
            setLoading(false);
        }
    };

    const handleTestEmail = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/admin/test-email', { method: 'POST' });
            const data = await response.json();

            if (data.success) {
                alert('Test email sent! Check your inbox.');
            } else {
                setError(data.error || 'Failed to send test email');
            }
        } catch (e) {
            setError('Failed to trigger test email');
        } finally {
            setLoading(false);
        }
    };

    if (isAuthenticated === null) return null;

    if (!isAuthenticated) {
        return <LoginOverlay onLoginSuccess={() => setIsAuthenticated(true)} />;
    }

    return (
        <div className="flex h-screen bg-gray-900 text-white font-sans overflow-hidden">
            {/* Sidebar with "portfolio" active */}
            <div className={`
                fixed inset-y-0 left-0 z-[110] transition-transform duration-300 ease-in-out md:relative md:translate-x-0
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                ${isSidebarOpen ? 'w-[280px]' : 'w-0'} 
                h-full overflow-hidden flex-shrink-0
            `}>
                <Sidebar
                    currentPage="portfolio"
                    symbol={symbol}
                    setSymbol={(s) => {
                        setSymbol(s);
                        router.push(`/?symbol=${s}`);
                    }}
                    stockInput={stockInput}
                    setStockInput={setStockInput}
                    isOpen={isSidebarOpen}
                    setIsOpen={setIsSidebarOpen}
                    interval="1d"
                    setInterval={() => { }}
                    data={[]}
                    loading={false}
                    stats={null}
                    sentimentScore={50}
                    onSectorClick={() => { }}
                />
            </div>

            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                {/* Toggle Button for Sidebar when closed */}
                {!isSidebarOpen && (
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-[70] bg-blue-600/90 hover:bg-blue-500 p-2 pr-3 rounded-r-xl border-y border-r border-blue-400/50 text-white transition-all hover:pl-4 group shadow-[0_0_20px_rgba(37,99,235,0.4)] flex items-center gap-1 overflow-hidden"
                        title="Open Sidebar"
                    >
                        <ChevronRight className="w-6 h-6 animate-pulse" />
                    </button>
                )}

                <div className="flex-1 overflow-y-auto">
                    {/* Header */}
                    <header className="p-6 bg-gray-900/50 border-b border-gray-800 sticky top-0 z-10 backdrop-blur-md">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Link href="/" className="text-gray-100 hover:text-white transition-colors">
                                    <ArrowLeft className="w-5 h-5" />
                                </Link>
                                <div>
                                    <h1 className="text-xl font-bold">Paper Trading Portfolio</h1>
                                    <p className="text-sm text-gray-100">Automated trades via Alpaca</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleTestEmail}
                                    disabled={loading || executing}
                                    className="px-3 py-2 text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                                >
                                    Test Email
                                </button>
                                <button
                                    onClick={handleReset}
                                    disabled={loading || executing}
                                    className="px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                                >
                                    Reset Portfolio
                                </button>
                                <button
                                    onClick={fetchPortfolio}
                                    disabled={loading}
                                    className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                    Refresh
                                </button>
                                <button
                                    onClick={executeTrades}
                                    disabled={executing || loading}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-semibold transition-colors disabled:opacity-50"
                                >
                                    <Play className="w-4 h-4" />
                                    {executing ? 'Executing...' : 'Execute Trades'}
                                </button>
                            </div>
                        </div>
                    </header>

                    <div className="p-6">
                        {/* Error Banner */}
                        {error && (
                            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-3">
                                <AlertTriangle className="w-5 h-5 text-red-400" />
                                <span className="text-red-400">{error}</span>
                            </div>
                        )}

                        {/* Trade Results */}
                        {tradeResults && (
                            <div className="mb-6 p-4 bg-blue-500/20 border border-blue-500/50 rounded-lg">
                                <h3 className="font-semibold mb-3 flex items-center gap-2">
                                    <Activity className="w-4 h-4" />
                                    Trade Execution Results
                                </h3>
                                <div className="space-y-2">
                                    {tradeResults.map((result, idx) => (
                                        <div key={idx} className="flex items-center justify-between text-sm py-1 border-b border-gray-700 last:border-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold w-12">{result.symbol}</span>
                                                {result.status.includes('success') || result.status === 'submitted' ? (
                                                    <CheckCircle className="w-3 h-3 text-green-400" />
                                                ) : (
                                                    <XCircle className="w-3 h-3 text-red-400" />
                                                )}
                                                <span className={result.status.includes('success') || result.status === 'submitted' ? 'text-green-400' : 'text-red-400'}>
                                                    {result.qty} shares
                                                </span>
                                            </div>
                                            <div className="text-gray-200 text-xs">
                                                {result.status.includes('success') || result.status === 'submitted' ? (
                                                    `Success ($${result.estimatedCost?.toFixed(2)})`
                                                ) : (
                                                    result.reason
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {loading && !portfolio ? (
                            <div className="flex items-center justify-center h-64">
                                <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                            </div>
                        ) : portfolio ? (
                            <>
                                {/* Account Overview */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                                    <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-sm">
                                        <p className="text-gray-200 text-xs mb-1 uppercase tracking-wider font-semibold">Portfolio Value</p>
                                        <p className="text-2xl font-bold">{formatCurrency(portfolio.account.portfolioValue)}</p>
                                    </div>
                                    <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-sm">
                                        <p className="text-gray-200 text-xs mb-1 uppercase tracking-wider font-semibold">Equity</p>
                                        <p className="text-2xl font-bold">{formatCurrency(portfolio.account.equity)}</p>
                                    </div>
                                    <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-sm">
                                        <p className="text-gray-200 text-xs mb-1 uppercase tracking-wider font-semibold">Cash</p>
                                        <p className="text-2xl font-bold">{formatCurrency(portfolio.account.cash)}</p>
                                    </div>
                                    <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-sm">
                                        <p className="text-gray-200 text-xs mb-1 uppercase tracking-wider font-semibold">Buying Power</p>
                                        <p className="text-2xl font-bold text-blue-400">{formatCurrency(portfolio.account.buyingPower)}</p>
                                    </div>
                                </div>

                                {/* Positions */}
                                <div className="mb-8">
                                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                        <Activity className="w-4 h-4 text-blue-400" />
                                        Current Positions
                                    </h2>
                                    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-sm">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-gray-900/30 border-b border-gray-700 text-gray-200 text-xs uppercase font-bold tracking-wider">
                                                        <th className="py-3 px-4">Symbol</th>
                                                        <th className="py-3 px-4">Qty</th>
                                                        <th className="py-3 px-4">Price</th>
                                                        <th className="py-3 px-4">Market Value</th>
                                                        <th className="py-3 px-4">P/L ($)</th>
                                                        <th className="py-3 px-4">P/L (%)</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-700">
                                                    {portfolio.positions.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={6} className="py-12 text-center text-gray-300 font-medium">No open positions. Click "Execute Trades" to start.</td>
                                                        </tr>
                                                    ) : (
                                                        portfolio.positions.map((pos) => (
                                                            <tr key={pos.symbol} className="hover:bg-gray-700/30 transition-colors">
                                                                <td className="py-3 px-4 font-bold text-blue-400">{pos.symbol}</td>
                                                                <td className="py-3 px-4 font-mono">{pos.qty}</td>
                                                                <td className="py-3 px-4 font-mono">{formatCurrency(pos.currentPrice)}</td>
                                                                <td className="py-3 px-4 font-mono">{formatCurrency(pos.marketValue)}</td>
                                                                <td className={`py-3 px-4 font-mono ${pos.unrealizedPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                    {pos.unrealizedPL >= 0 ? '+' : ''}{formatCurrency(pos.unrealizedPL)}
                                                                </td>
                                                                <td className={`py-3 px-4 font-mono ${pos.unrealizedPLPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                    {formatPercent(pos.unrealizedPLPercent)}
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                {/* Recent Orders */}
                                <div className="mb-8">
                                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-purple-400" />
                                        Recent Orders
                                    </h2>
                                    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-sm">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-gray-900/30 border-b border-gray-700 text-gray-200 text-xs uppercase font-bold tracking-wider">
                                                        <th className="py-3 px-4">Symbol</th>
                                                        <th className="py-3 px-4">Side</th>
                                                        <th className="py-3 px-4">Qty</th>
                                                        <th className="py-3 px-4">Status</th>
                                                        <th className="py-3 px-4">Price</th>
                                                        <th className="py-3 px-4">Date</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-700">
                                                    {portfolio.recentOrders.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={6} className="py-12 text-center text-gray-300 font-medium">No recent orders.</td>
                                                        </tr>
                                                    ) : (
                                                        portfolio.recentOrders.map((order) => (
                                                            <tr key={order.id} className="hover:bg-gray-700/30 transition-colors text-sm">
                                                                <td className="py-3 px-4 font-bold">{order.symbol}</td>
                                                                <td className={`py-3 px-4 uppercase font-bold ${order.side === 'buy' ? 'text-blue-400' : 'text-orange-400'}`}>
                                                                    {order.side}
                                                                </td>
                                                                <td className="py-3 px-4 font-mono">{order.qty}</td>
                                                                <td className="py-3 px-4">
                                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${order.status === 'filled' ? 'bg-green-500/20 text-green-400' :
                                                                        order.status === 'canceled' ? 'bg-red-500/20 text-red-400' :
                                                                            'bg-blue-500/20 text-blue-400'
                                                                        }`}>
                                                                        {order.status}
                                                                    </span>
                                                                </td>
                                                                <td className="py-3 px-4 font-mono text-gray-200">
                                                                    {order.filledPrice ? formatCurrency(order.filledPrice) : '-'}
                                                                </td>
                                                                <td className="py-3 px-4 text-gray-200 text-xs font-mono">
                                                                    {new Date(order.createdAt).toLocaleString()}
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                {/* Trade Settings Info */}
                                <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700 border-dashed">
                                    <h3 className="text-sm font-bold mb-3 uppercase tracking-wider text-gray-200">Trade Configuration</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div className="flex flex-col">
                                            <span className="text-gray-200 text-xs">Position Size</span>
                                            <span className="font-bold text-white">$250</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-gray-200 text-xs">Stop Loss</span>
                                            <span className="font-bold text-red-400">-15%</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-gray-200 text-xs">Profit Target</span>
                                            <span className="font-bold text-green-400">+25%</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-gray-200 text-xs">Max Portfolio Risk</span>
                                            <span className="font-bold text-white">$1000 Total</span>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : null}
                    </div>
                </div>
            </main>
        </div>
    );
}
