const fs = require('fs');
let content = fs.readFileSync('app/performance/page.tsx.bak', 'utf8');

// 1. Add Trash2 to lucide imports
content = content.replace("Zap, Info", "Zap, Info, Trash2");

// 2. Add handleDelete function
const deleteFunc = `
    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to stop tracking this option?')) return;

        try {
            const res = await fetch(\`/api/options/tracked/\${encodeURIComponent(id)}\`, {
                method: 'DELETE',
            });
            if (res.ok) {
                setTrackedOptions(prev => prev.filter(o => o.id !== id));
            } else {
                alert('Failed to delete tracked option');
            }
        } catch (e) {
            console.error('Error deleting option:', e);
            alert('An error occurred while deleting');
        }
    };
`;
content = content.replace("fetchTracked();\n    }, []);", "fetchTracked();\n    }, []);\n" + deleteFunc);

// 3. Add delete button and relative class to card
const cardStartTarget = '<div key={option.id} className="bg-gray-800/40 border border-gray-700/50 rounded-3xl p-6 backdrop-blur-sm hover:border-blue-500/30 transition-all group">';
const cardStartReplacement = `<div key={option.id} className="bg-gray-800/40 border border-gray-700/50 rounded-3xl p-6 backdrop-blur-sm hover:border-blue-500/30 transition-all group relative">
                                        <button
                                            onClick={() => handleDelete(option.id)}
                                            className="absolute top-4 right-4 p-2 bg-gray-900/50 border border-gray-700/50 rounded-xl text-gray-500 hover:text-rose-400 hover:border-rose-500/50 transition-colors z-10 opacity-0 group-hover:opacity-100"
                                            title="Stop Tracking"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>`;
content = content.replace(cardStartTarget, cardStartReplacement);

// 4. Update the "Premium Trend" label to include locks
const trendTarget = '<span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Premium Trend</span>';
const trendReplacement = `<span className="text-[10px] text-gray-500 uppercase font-black tracking-widest flex items-center gap-2">
                                                    Premium Trend
                                                    {(option.status === 'PROFIT' || option.status === 'LOSS') && (
                                                        <span className={\`px-1.5 py-0.5 rounded text-[8px] border \${option.status === 'PROFIT' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}\`}>
                                                            LOCKED
                                                        </span>
                                                    )}
                                                </span>`;
content = content.replace(trendTarget, trendReplacement);

fs.writeFileSync('app/performance/page.tsx', content);
console.log('Done modifying.');
