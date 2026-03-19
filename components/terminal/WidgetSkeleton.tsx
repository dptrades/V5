"use client";

import React from "react";

interface Props {
  className?: string;
  count?: number;
}

export const WidgetSkeleton = ({ className = "h-32", count = 1 }: Props) => {
  return (
    <div className="flex flex-col gap-3 w-full animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`bg-white/5 border border-white/5 rounded-xl ${className} w-full`}
        >
          <div className="h-full w-full bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 translate-x-[-100%] animate-[shimmer_2s_infinite]" />
        </div>
      ))}
    </div>
  );
};

export default WidgetSkeleton;
