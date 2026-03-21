"use client";

import React from "react";
import { Target, ShieldAlert, ShieldCheck, Minus } from "lucide-react";
import InfoPopover from "./InfoPopover";

type DeployState = "DEPLOY" | "STANDBY" | "AVOID";

interface DecisionBannerProps {
  deployCapital: DeployState;
  positionSize: string;
  totalScore: number;
  mode: string;
  onModeChange: (mode: "TACTICAL" | "POSITIONAL") => void;
}

const INFO = [
  "The top-level verdict synthesized from all technical sub-scores.",
  "DEPLOY (score ≥ 60): Environment supports active exposure. RSI Divergence is a key confirming signal.",
  "STANDBY (45–60): Mixed signals — wait for confirmation or clearer sector rotation.",
  "AVOID (< 45): Risk/reward is unfavorable — preserve capital.",
  "Macro Event Risk: Alerts trigger if VIX > 22 and Yields (> 2.0%) or Dollar (> 0.6%) spike aggressively.",
  "Market Closed: Displays 'Settlement Cache' data from the most recent 4 PM ET close.",
];

const configs: Record<DeployState, { color: string; border: string; bg: string; icon: any; label: string }> = {
  DEPLOY:  { color: "text-[#00FF94]", border: "border-[#00FF94]/20", bg: "bg-[#00FF94]/5",  icon: ShieldCheck,  label: "CAPITAL READY" },
  STANDBY: { color: "text-[#FFB800]", border: "border-[#FFB800]/20", bg: "bg-[#FFB800]/5",  icon: Minus,        label: "HOLD & MONITOR" },
  AVOID:   { color: "text-[#FF2E2E]", border: "border-[#FF2E2E]/20", bg: "bg-[#FF2E2E]/5",  icon: ShieldAlert,  label: "PRESERVE CAPITAL" },
};

const DecisionBanner: React.FC<DecisionBannerProps> = ({
  deployCapital, positionSize, totalScore, mode, onModeChange
}) => {
  const cfg = configs[deployCapital];
  const Icon = cfg.icon;

  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} backdrop-blur-md p-5 flex flex-col gap-4`}>
      {/* Top row: verdict + mode toggle */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/50 font-bold">Market Readiness</span>
            <InfoPopover title="Market Readiness" bullets={INFO} />
          </div>
          <div className="flex items-center gap-3 mt-1">
            <Icon className={`w-6 h-6 ${cfg.color}`} />
            <span className={`text-2xl font-black tracking-tight ${cfg.color}`}>{deployCapital}</span>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex flex-col items-end gap-1.5">
          <span className="text-[10px] uppercase tracking-widest text-white/60 font-bold">Strategy</span>
          <div className="flex items-center bg-black/30 p-0.5 rounded-lg border border-white/10">
            {(["TACTICAL", "POSITIONAL"] as const).map(m => (
              <button key={m} onClick={() => onModeChange(m)}
                className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
                  mode === m ? `${cfg.color} bg-white/10` : "text-white/60 hover:text-white/80"
                }`}>
                {m === "TACTICAL" ? "Short-Term" : "Swing"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Position Size Row */}
      <div className="flex items-center justify-between border-t border-white/5 pt-4">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest text-white/60 font-bold">Execution Action</span>
          <div className={`text-xl font-black ${cfg.color}`}>{deployCapital === 'AVOID' ? 'NO TRADE' : 'ACTIVE'}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] uppercase tracking-widest text-white/60 font-bold">Position Size</span>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${cfg.border} ${cfg.bg}`}>
            <Target className={`w-3.5 h-3.5 ${cfg.color}`} />
            <span className={`text-xs font-bold ${cfg.color}`}>{positionSize}</span>
          </div>
        </div>
      </div>

      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-1000 ${
          deployCapital === "DEPLOY" ? "bg-[#00FF94]" : deployCapital === "STANDBY" ? "bg-[#FFB800]" : "bg-[#FF2E2E]"
        }`} style={{ width: `${totalScore}%` }} />
      </div>
    </div>
  );
};

export default DecisionBanner;
