import React from 'react';
import { EDState } from '../types';

interface ScoopWarningProps {
  state: EDState;
  threshold: number;
}

type Level = 'ok' | 'warning' | 'critical';

function getLevel(state: EDState, threshold: number): Level {
  if (state.estimatedFuelToNextScoop < 0) return 'critical';
  if (state.fuelPercent < threshold && state.nextScoopableIn >= 2) return 'warning';
  return 'ok';
}

export default function ScoopWarning({ state, threshold }: ScoopWarningProps) {
  const level = getLevel(state, threshold);

  if (level === 'ok') return null;

  const nextScoop = state.route.find((r) => r.scoopable);

  if (level === 'critical') {
    return (
      <div className="bg-ed-red bg-opacity-20 border border-ed-red rounded px-3 py-2 animate-pulse">
        <div className="flex items-center gap-2">
          <span className="text-ed-red font-bold text-xs">CRITICAL</span>
          <span className="text-red-300 text-xs">
            Cannot reach next scoopable star
          </span>
        </div>
        <div className="text-xs text-red-400 font-mono mt-0.5">
          Est. fuel at scoop:{' '}
          <span className="text-ed-red font-bold">
            {state.estimatedFuelToNextScoop.toFixed(2)}T
          </span>
          {nextScoop && (
            <span className="ml-2 text-slate-400">→ {nextScoop.system}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-ed-yellow bg-opacity-10 border border-ed-yellow rounded px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-ed-yellow font-bold text-xs">WARNING</span>
        <span className="text-yellow-300 text-xs">
          Low fuel — {state.nextScoopableIn} hop{state.nextScoopableIn !== 1 ? 's' : ''} to scoop
        </span>
      </div>
      <div className="text-xs text-yellow-500 font-mono mt-0.5">
        Est. fuel at scoop:{' '}
        <span className="text-ed-yellow font-bold">
          {state.estimatedFuelToNextScoop.toFixed(2)}T
        </span>
        {nextScoop && (
          <span className="ml-2 text-slate-400">→ {nextScoop.system}</span>
        )}
      </div>
    </div>
  );
}
