import React from 'react';
import { Clock } from 'lucide-react';

interface RefreshClockProps {
  countdown: number;
  total: number;
  label?: string;
  size?: 'sm' | 'md' | 'xs';
  color?: string;
  showLabel?: boolean;
}

export default function RefreshClock({
  countdown,
  total,
  label = "Refresh",
  size = 'sm',
  color = "#00FF94",
  showLabel = true
}: RefreshClockProps) {
  const progressPct = Math.min(100, (Math.max(0, total - countdown) / total) * 100);
  
  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;
  const timeStr = minutes > 0 
    ? `${minutes}:${seconds.toString().padStart(2, '0')}`
    : `${seconds}s`;

  const sizes = {
    xs: { svg: 16, r: 6, stroke: 1.5, text: 'text-[8px]', icon: 'w-2 h-2' },
    sm: { svg: 24, r: 10, stroke: 2, text: 'text-[10px]', icon: 'w-2.5 h-2.5' },
    md: { svg: 32, r: 14, stroke: 2.5, text: 'text-xs', icon: 'w-3.5 h-3.5' }
  };

  const s = sizes[size];
  const circumference = 2 * Math.PI * s.r;

  return (
    <div className={`flex items-center gap-2 px-2 py-1 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 transition-colors`}>
      <div className="relative" style={{ width: s.svg, height: s.svg }}>
        <svg className="transform -rotate-90" width={s.svg} height={s.svg}>
          <circle 
            cx={s.svg / 2} cy={s.svg / 2} r={s.r} 
            stroke="currentColor" strokeWidth={s.stroke} fill="transparent" 
            className="text-white/5" 
          />
          <circle 
            cx={s.svg / 2} cy={s.svg / 2} r={s.r} 
            stroke={color} strokeWidth={s.stroke} fill="transparent" 
            className="transition-all duration-1000"
            strokeDasharray={circumference} 
            strokeDashoffset={circumference * (1 - progressPct / 100)} 
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Clock className={`${s.icon} text-white/50`} />
        </div>
      </div>
      <div className="flex flex-col justify-center min-w-[32px]">
        <span className={`${s.text} font-bold tabular-nums leading-none text-white`}>
          {timeStr}
        </span>
        {showLabel && (
          <span className="text-[8px] text-white/40 uppercase tracking-tighter font-bold font-sans">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
