import { Newspaper, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { NewsItem } from '../lib/news';
import DataSourceIndicator from './ui/DataSourceIndicator';

interface NewsFeedProps {
    news: NewsItem[];
    loading?: boolean;
}

export default function NewsFeed({ news, loading = false }: NewsFeedProps) {
    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mt-6 shadow-lg">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <Newspaper className="w-5 h-5 text-purple-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Live News & Analysis</h3>
                <div className="ml-auto">
                    <DataSourceIndicator source="StockNews AI" />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    Array(3).fill(0).map((_, i) => (
                        <div key={i} className="h-24 bg-gray-800 rounded-lg animate-pulse"></div>
                    ))
                ) : (
                    news.slice(0, 6).map((item) => (
                        <a
                            key={item.id}
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group p-4 bg-gray-800/40 hover:bg-gray-800 rounded-lg border border-gray-800 hover:border-gray-700 transition-all cursor-pointer block"
                        >
                            <div className="flex justify-between items-start">
                                <span className="text-[10px] font-bold tracking-wider text-gray-200 uppercase">{item.source} • {item.time}</span>
                                {item.sentiment === 'positive' && <ArrowUpRight className="w-4 h-4 text-green-500" />}
                                {item.sentiment === 'negative' && <ArrowDownRight className="w-4 h-4 text-red-500" />}
                                {item.sentiment === 'neutral' && <Minus className="w-4 h-4 text-gray-200" />}
                            </div>
                            <h4 className="text-sm font-medium text-gray-100 mt-2 group-hover:text-blue-400 transition-colors line-clamp-2">
                                {item.title}
                            </h4>
                        </a>
                    ))
                )}
            </div>
        </div>
    );
}
