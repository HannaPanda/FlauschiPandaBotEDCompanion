import React from 'react';
import { RouteEntry } from '../types';

interface RouteListProps {
  route: RouteEntry[];
  remainingJumps: number;
}

export default function RouteList({ route, remainingJumps }: RouteListProps) {
  const display = route.slice(0, 5);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>ROUTE</span>
        <span className="font-mono text-ed-blue">{remainingJumps} JUMPS</span>
      </div>

      {display.length === 0 ? (
        <div className="text-xs text-slate-600 font-mono py-1">No route plotted</div>
      ) : (
        <div className="space-y-px">
          {display.map((hop, i) => (
            <RouteHop key={`${hop.system}-${i}`} hop={hop} index={i} />
          ))}
          {route.length > 5 && (
            <div className="text-xs text-slate-600 font-mono pl-1">
              +{route.length - 5} more
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RouteHop({ hop, index }: { hop: RouteEntry; index: number }) {
  return (
    <div className="flex items-center gap-2 py-0.5 px-1 rounded hover:bg-space-700">
      <span className="text-slate-600 font-mono text-xs w-4 shrink-0">{index + 1}</span>
      <span
        className={`text-xs shrink-0 font-bold ${
          hop.scoopable ? 'text-ed-green' : 'text-slate-500'
        }`}
        title={hop.scoopable ? 'Scoopable' : 'Not scoopable'}
      >
        {hop.scoopable ? '★' : '·'}
      </span>
      <span className="text-xs font-mono text-slate-300 truncate flex-1">{hop.system}</span>
      <span className="text-xs font-mono text-slate-600 shrink-0">{hop.starClass}</span>
      <span className="text-xs font-mono text-slate-600 shrink-0">
        {hop.distanceLy.toFixed(1)}ly
      </span>
    </div>
  );
}
