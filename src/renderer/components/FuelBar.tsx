import React from 'react';

interface FuelBarProps {
  current: number;
  capacity: number;
  percent: number;
  reserve: number;
  isScooping: boolean;
}

export default function FuelBar({ current, capacity, percent, reserve, isScooping }: FuelBarProps) {
  const clampedPct = Math.max(0, Math.min(100, percent));

  const barColor =
    clampedPct > 50
      ? 'bg-ed-green'
      : clampedPct > 25
      ? 'bg-ed-yellow'
      : 'bg-ed-red';

  const textColor =
    clampedPct > 50
      ? 'text-ed-green'
      : clampedPct > 25
      ? 'text-ed-yellow'
      : 'text-ed-red';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">FUEL</span>
        <div className="flex items-center gap-2">
          {isScooping && (
            <span className="text-ed-blue text-xs animate-pulse">SCOOPING</span>
          )}
          <span className={`font-bold font-mono ${textColor}`}>
            {clampedPct.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Bar */}
      <div className="relative h-4 bg-space-700 rounded overflow-hidden border border-space-500">
        <div
          className={`h-full transition-all duration-500 ${barColor} opacity-80`}
          style={{ width: `${clampedPct}%` }}
        />
        {/* Tick marks */}
        {[25, 50, 75].map((tick) => (
          <div
            key={tick}
            className="absolute top-0 bottom-0 w-px bg-space-900 opacity-40"
            style={{ left: `${tick}%` }}
          />
        ))}
      </div>

      {/* Values */}
      <div className="flex justify-between text-xs text-slate-500 font-mono">
        <span>
          {current.toFixed(2)} / {capacity.toFixed(2)} T
        </span>
        <span className="text-slate-600">RES {reserve.toFixed(2)}</span>
      </div>
    </div>
  );
}
