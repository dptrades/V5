"use client";

import React from "react";
import { Sparkles, Target, Activity, Zap, Clock, ShieldCheck } from "lucide-react";
import InfoPopover from "./InfoPopover";

interface TechPoint {
  text: string;
  sentiment: "positive" | "negative" | "neutral";
}

interface AITerminalAssessmentProps {
  symbol: string;
  score?: number;
  signal?: string;
  executionAction?: "BUY" | "WAIT";
  entryPrice?: number;
  entryReason?: string;
  riskLevel?: "Low" | "Moderate" | "High" | "Extreme";
  techDetails?: {
    emas: TechPoint[];
    rsi: TechPoint;
    bb: TechPoint;
    fvg: TechPoint;
    options: TechPoint;
  };
  multiDivergence?: {
    h1?: { type: 'BULLISH' | 'BEARISH' | 'NONE' };
    daily?: { type: 'BULLISH' | 'BEARISH' | 'NONE' };
    weekly?: { type: 'BULLISH' | 'BEARISH' | 'NONE' };
  };
  // Fallback for old data if any
  assessment?: string;
  suggestedAction?: string;
}

const INFO = [
  "Expert AI Assessment powered by Gemini 1.5 Flash (Senior Strategist Logic).",
  "Left Panel: Strategic AI Signal, Tactical Score (0-10), and Execution Strategy.",
  "Right Panel: Technical Confluence Analysis covering EMAs, RSI, Gaps, and Bias.",
  "Multi-TF Divergence: Real-time RSI divergence tracking across Hourly (H1), Daily (D1), and Weekly (W1) timeframes.",
];

const getRiskColor = (level: string = "Moderate") => {
  switch (level) {
    case "Low":     return "text-[#00FF94]";
    case "Moderate":return "text-[#FFB800]";
    case "High":    return "text-[#FF2E2E]";
    case "Extreme": return "text-[#FF2E2E] animate-pulse";
    default:        return "text-white/70";
  }
};

const DivergenceBadge = ({ label, type }: { label: string, type?: 'BULLISH' | 'BEARISH' | 'NONE' }) => {
  const isBullish = type === 'BULLISH';
  const isBearish = type === 'BEARISH';
  const color = isBullish ? 'text-[#00FF94] border-[#00FF94]/30 bg-[#00FF94]/5' : isBearish ? 'text-[#FF2E2E] border-[#FF2E2E]/30 bg-[#FF2E2E]/5' : 'text-white/20 border-white/5 bg-white/5';
  
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${color} transition-all`}>
      <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
      <div className={`w-1.5 h-1.5 rounded-full ${isBullish ? 'bg-[#00FF94] shadow-[0_0_8px_rgba(0,255,148,0.5)]' : isBearish ? 'bg-[#FF2E2E] shadow-[0_0_8px_rgba(255,46,46,0.5)]' : 'bg-white/10'}`}></div>
      {(isBullish || isBearish) && <span className="text-[8px] font-black uppercase ml-1 animate-pulse">{type}</span>}
    </div>
  );
};

const AITerminalAssessment: React.FC<AITerminalAssessmentProps> = ({ 
  symbol, score = 5.0, signal = "NEUTRAL", executionAction = "WAIT", entryPrice = 0, entryReason = "", riskLevel = "Moderate", techDetails, assessment, suggestedAction, multiDivergence 
}) => {
  const isBullish = score >= 6.5;
  const isBearish = score <= 4;
  const scoreColor = isBullish ? "text-[#00FF94]" : isBearish ? "text-[#FF2E2E]" : "text-[#FFB800]";
  const borderColor = isBullish ? "border-[#00FF94]/20" : isBearish ? "border-[#FF2E2E]/20" : "border-[#FFB800]/20";
  const bgGlow = isBullish ? "shadow-[0_0_40px_-15px_rgba(0,255,148,0.15)]" : isBearish ? "shadow-[0_0_40px_-15px_rgba(255,46,46,0.15)]" : "";

  // If no techDetails (loading fallback), show the paragraph version
  if (!techDetails) {
    return (
      <div className="bg-[#0B0F17]/90 border border-white/5 rounded-3xl p-6 backdrop-blur-3xl flex flex-col gap-5 hover:border-white/10 transition-all group shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
              </div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Expert AI Assessment</h3>
            </div>
            <div className="flex items-center gap-3">
               <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/30 uppercase tracking-widest font-black">Risk:</span>
                <span className={`text-[11px] font-black uppercase ${getRiskColor(riskLevel)}`}>{riskLevel}</span>
              </div>
              <InfoPopover title="Assessment Info" bullets={INFO} />
            </div>
          </div>
          <p className="text-sm leading-relaxed text-white/70 font-bold italic">"{assessment || "Synchronizing with market internals..."}"</p>
          <div className="pt-6 mt-4 border-t border-white/5 flex items-center justify-between">
             <span className={`text-xs font-black uppercase tracking-widest ${isBullish ? 'text-[#00FF94]' : 'text-[#FFB800]'}`}>
               {suggestedAction || signal}
             </span>
             <div className="flex items-center gap-1.5 overflow-hidden w-24 bg-white/5 h-1 rounded-full">
                <div className="bg-indigo-500 h-full w-1/2 animate-[shimmer_2s_infinite]"></div>
             </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative bg-[#0B0F17]/90 backdrop-blur-3xl rounded-3xl border ${borderColor} p-6 lg:p-8 ${bgGlow} transition-all duration-1000 overflow-hidden shadow-2xl`}>
      {/* Carbon Texture Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
      
      <div className="relative z-10 flex flex-col lg:grid lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: PRIMARY SIGNAL & EXECUTION (4/12) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Header Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
              </div>
              <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Expert AI Assessment</h3>
            </div>
            <div className="flex items-center gap-2 bg-black/20 px-3 py-1 rounded-full border border-white/5">
              <span className="text-[9px] text-white/30 uppercase tracking-widest font-black">Risk Level</span>
              <span className={`text-[11px] font-black uppercase ${getRiskColor(riskLevel)}`}>{riskLevel}</span>
            </div>
          </div>

          {/* AI SIGNAL CARD */}
          <div className="bg-white/5 rounded-2xl p-6 border border-white/5 flex flex-col items-center text-center shadow-2xl relative group overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>
             <div className="text-[10px] font-black text-white/30 uppercase tracking-[0.25em] mb-4 relative z-10 italic">Quantitative Signal</div>
             {/* SMALLER SIGNAL TEXT FOR SOPHISTICATION */}
             <div className={`text-xl font-black ${scoreColor} tracking-[0.2em] mb-1 relative z-10 uppercase drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]`}>
               {signal}
             </div>
             <div className="text-6xl font-black text-white tracking-tighter relative z-10">
               {score.toFixed(1)}<span className="text-xl text-white/20 font-bold ml-1">/10</span>
             </div>
          </div>

          {/* NEW: MULTI-TIMEFRAME DIVERGENCE ANALYSIS */}
          <div className="bg-white/5 rounded-2xl p-5 border border-white/5 flex flex-col gap-4 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-2">
               <Activity className="w-3.5 h-3.5 text-indigo-400" />
               <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest italic">RSI Divergence Matrix</h4>
            </div>
            <div className="grid grid-cols-1 gap-2.5">
               <DivergenceBadge label="Hourly (H1)" type={multiDivergence?.h1?.type} />
               <DivergenceBadge label="Daily (D1)" type={multiDivergence?.daily?.type} />
               <DivergenceBadge label="Weekly (W1)" type={multiDivergence?.weekly?.type} />
            </div>
          </div>

          {/* EXECUTION STRATEGY */}
          <div className={`p-6 rounded-2xl border flex flex-col gap-4 shadow-2xl ${executionAction === 'BUY' ? 'bg-[#00FF94]/5 border-[#00FF94]/30' : 'bg-[#FFB800]/5 border-[#FFB800]/30'}`}>
            <div className="flex items-center gap-2">
              <Clock className={`w-4 h-4 ${executionAction === 'BUY' ? 'text-[#00FF94]' : 'text-[#FFB800]'}`} />
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Tactical Execution</span>
            </div>
            <div className={`text-xl font-black tracking-widest ${executionAction === 'BUY' ? 'text-[#00FF94]' : 'text-[#FFB800]'}`}>
              {executionAction === 'BUY' ? 'BUY / LONG' : 'STAY FLAT / WAIT'}
            </div>
            <div className="text-[11px] font-bold text-white/80 leading-relaxed bg-black/40 p-4 rounded-xl border border-white/5 backdrop-blur-md italic">
              {entryPrice > 0 ? `Target Entry: $${entryPrice.toFixed(2)}` : "Analyzing dynamic reversal levels..."}
            </div>
          </div>

          {/* TARGET PRICE */}
          <div className="bg-[#161B22]/50 rounded-2xl p-5 border border-white/5 flex flex-col gap-2 shadow-2xl backdrop-blur-md relative overflow-hidden">
            <div className="absolute bottom-0 right-0 p-2 opacity-5 scale-150">
                <Target className="w-12 h-12 text-blue-400" />
            </div>
            <div className="flex items-center gap-2 text-[9px] font-black text-white/30 uppercase tracking-widest relative z-10">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" /> Strategic Anchor Price
            </div>
            <div className="text-3xl font-black text-white relative z-10">${entryPrice > 0 ? entryPrice.toFixed(2) : "---"}</div>
          </div>
        </div>

        {/* RIGHT COLUMN: TECHNICAL CONFLUENCE & ENTRY LOGIC (8/12) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* TECHNICAL DETAIL BREAKDOWN */}
          <div className="bg-white/5 rounded-3xl p-6 lg:p-8 border border-white/5 flex-grow shadow-2xl relative overflow-hidden backdrop-blur-md">
            <div className="absolute top-0 right-0 p-6">
               <InfoPopover title="Analysis Logic" bullets={INFO} />
            </div>
            <div className="flex items-center gap-3 mb-8">
              <Activity className="w-5 h-5 text-indigo-400" />
              <h4 className="text-sm font-black text-white uppercase tracking-[0.2em] italic">Technical Confluence Matrix</h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
              {/* Trend Group */}
              <div className="space-y-8">
                <div className="space-y-5">
                  <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
                    Structural Trend (EMAs)
                  </div>
                  <div className="space-y-4">
                    {techDetails.emas.map((point, i) => (
                      <div key={i} className="flex items-start gap-3.5 group/item">
                        <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 shadow-[0_0_10px_rgba(0,0,0,0.8)] ${point.sentiment === 'positive' ? 'bg-[#00FF94]' : point.sentiment === 'negative' ? 'bg-[#FF2E2E]' : 'bg-white/10'}`}></div>
                        <span className="text-xs text-white/70 font-bold leading-relaxed group-hover/item:text-white transition-colors tracking-tight">{point.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-white/5">
                  <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
                    Momentum Assessment
                  </div>
                  <div className="flex items-start gap-3.5">
                    <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 shadow-[0_0_10px_rgba(0,0,0,0.8)] ${techDetails.rsi.sentiment === 'positive' ? 'bg-[#00FF94]' : techDetails.rsi.sentiment === 'negative' ? 'bg-[#FF2E2E]' : 'bg-[#FFB800]'}`}></div>
                    <span className="text-xs text-white/70 font-bold leading-relaxed tracking-tight">{techDetails.rsi.text}</span>
                  </div>
                </div>
              </div>

              {/* Volatility & Flow Group */}
              <div className="space-y-8">
                <div className="space-y-4">
                  <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
                    Volatility Regime
                  </div>
                  <div className="flex items-start gap-3.5">
                    <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 shadow-[0_0_10px_rgba(0,0,0,0.8)] ${techDetails.bb.sentiment === 'positive' ? 'bg-[#00FF94]' : techDetails.bb.sentiment === 'negative' ? 'bg-[#FF2E2E]' : 'bg-white/10'}`}></div>
                    <span className="text-xs text-white/70 font-bold leading-relaxed tracking-tight">{techDetails.bb.text}</span>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-white/5">
                  <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
                    Institutional Liquidity (FVG)
                  </div>
                  <div className="flex items-start gap-3.5">
                    <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 shadow-[0_0_10px_rgba(0,0,0,0.8)] ${techDetails.fvg.sentiment === 'positive' ? 'bg-[#00FF94]' : techDetails.fvg.sentiment === 'negative' ? 'bg-[#FF2E2E]' : 'bg-white/10'}`}></div>
                    <span className="text-xs text-white/70 font-bold leading-relaxed tracking-tight">{techDetails.fvg.text}</span>
                  </div>
                </div>
                
                <div className="space-y-4 pt-4 border-t border-white/5">
                  <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
                    Institutional Flow Bias
                  </div>
                  <div className="flex items-start gap-3.5">
                    <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 shadow-[0_0_10px_rgba(0,0,0,0.8)] ${techDetails.options.sentiment === 'positive' ? 'bg-[#00FF94]' : techDetails.options.sentiment === 'negative' ? 'bg-[#FF2E2E]' : 'bg-white/10'}`}></div>
                    <span className="text-xs text-white/70 font-bold leading-relaxed tracking-tight">{techDetails.options.text}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ENTRY PRICE LOGIC EXPLANATION */}
          <div className={`rounded-3xl p-6 border-l-4 shadow-2xl flex flex-col gap-3 relative overflow-hidden backdrop-blur-md group hover:translate-x-1 transition-transform ${isBullish ? 'bg-[#00FF94]/5 border-[#00FF94]/30' : isBearish ? 'bg-[#FF2E2E]/5 border-[#FF2E2E]/30' : 'bg-[#FFB800]/5 border-[#FFB800]/30'}`}>
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg ${isBullish ? 'bg-[#00FF94]/10' : isBearish ? 'bg-[#FF2E2E]/10' : 'bg-[#FFB800]/10'}`}>
                <Zap className={`w-4 h-4 ${isBullish ? 'text-[#00FF94]' : isBearish ? 'text-[#FF2E2E]' : 'text-[#FFB800]'}`} />
              </div>
              <h4 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">High-Conviction Entry Condition</h4>
            </div>
            <p className={`text-xs font-bold leading-relaxed italic pr-8 ${isBullish ? 'text-[#00FF94]/80' : isBearish ? 'text-[#FF2E2E]/80' : 'text-[#FFB800]/80'}`}>
              "{entryReason || assessment || "Await confluence confirmation for next high-probability setup."}"
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AITerminalAssessment;
