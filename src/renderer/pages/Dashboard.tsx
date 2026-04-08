import React from 'react';
import { EDState, AppSettings, ExobioScan } from '../types';
import FuelBar from '../components/FuelBar';
import RouteList from '../components/RouteList';
import ScoopWarning from '../components/ScoopWarning';
import ConnectionStatus from '../components/ConnectionStatus';

interface DashboardProps {
  state: EDState;
  settings: AppSettings | null;
}

export default function Dashboard({ state, settings }: DashboardProps) {
  const threshold = settings?.fuelWarningThreshold ?? 30;
  const wsEnabled = settings?.wsEnabled ?? false;

  return (
    <div className="h-full overflow-y-auto px-3 py-3 space-y-3">
      <SystemInfo state={state} />

      <div className="bg-space-800 rounded border border-space-600 px-3 py-2">
        <FuelBar
          current={state.fuelCurrent}
          capacity={state.fuelCapacity}
          percent={state.fuelPercent}
          reserve={state.fuelReserve}
          isScooping={state.isScooping}
        />
      </div>

      <ScoopWarning state={state} threshold={threshold} />

      <JumpInfo state={state} />

      {state.fssBodyCount > 0 && <FssProgress state={state} />}

      {state.activeExobioScans.length > 0 && <ExobioPanel scans={state.activeExobioScans} />}

      <div className="bg-space-800 rounded border border-space-600 px-3 py-2">
        <RouteList route={state.route} remainingJumps={state.remainingJumps} />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-600 px-1">
        <ConnectionStatus wsConnected={state.wsConnected} wsEnabled={wsEnabled} />
        {state.lastFuelUsed > 0 && (
          <span className="font-mono">~{state.lastFuelUsed.toFixed(2)}T/jump</span>
        )}
      </div>
    </div>
  );
}

function SystemInfo({ state }: { state: EDState }) {
  return (
    <div className="bg-space-800 rounded border border-space-600 px-3 py-2">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-slate-500">SYSTEM</div>
          <div className="text-sm font-bold text-ed-blue font-mono tracking-wide">
            {state.currentSystem}
          </div>
          {state.population === 0 && state.currentSystem !== 'Unknown' && (
            <div className="text-xs text-ed-green font-mono">UNINHABITED</div>
          )}
          {state.systemAllegiance && (
            <div className="text-xs text-slate-600">{state.systemAllegiance}</div>
          )}
        </div>
        <div className="text-right">
          {state.currentStarClass && (
            <div className="flex items-center gap-1 justify-end">
              <span className={`text-xs font-bold ${state.currentScoopable ? 'text-ed-green' : 'text-slate-500'}`}>
                {state.currentScoopable ? '★' : '·'} {state.currentStarClass}
              </span>
            </div>
          )}
          {state.shipName && (
            <div className="text-xs text-slate-400 font-mono">{state.shipName}</div>
          )}
          {state.shipType && (
            <div className="text-xs text-slate-600">{state.shipType}</div>
          )}
        </div>
      </div>
      {state.currentBody && state.currentBody !== state.currentSystem && (
        <div className="mt-1 text-xs text-slate-500 font-mono truncate">
          @ {state.currentBody}
        </div>
      )}
    </div>
  );
}

function JumpInfo({ state }: { state: EDState }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Stat
        label="JUMP RANGE"
        value={`${state.jumpRangeMax.toFixed(1)} ly`}
      />
      <Stat
        label="NEXT SCOOP"
        value={
          state.route.length === 0 ? '—'
          : state.nextScoopableIn === 0 ? 'Here'
          : `${state.nextScoopableIn} hop${state.nextScoopableIn !== 1 ? 's' : ''}`
        }
        sub={
          state.estimatedFuelToNextScoop !== 0
            ? `~${Math.max(0, state.estimatedFuelToNextScoop).toFixed(2)}T`
            : ''
        }
        valueColor={
          state.estimatedFuelToNextScoop < 0 ? 'text-ed-red'
          : state.nextScoopableIn >= 3 ? 'text-ed-yellow'
          : 'text-slate-200'
        }
      />
    </div>
  );
}

function FssProgress({ state }: { state: EDState }) {
  const pct = Math.round(state.fssProgress * 100);
  const complete = state.fssProgress >= 1.0;
  return (
    <div className="bg-space-800 rounded border border-space-600 px-3 py-2">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-400">FSS</span>
        <span className={`font-mono font-bold ${complete ? 'text-ed-green' : 'text-ed-blue'}`}>
          {pct}% {complete ? '✓' : ''}
        </span>
      </div>
      <div className="h-1.5 bg-space-700 rounded overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${complete ? 'bg-ed-green' : 'bg-ed-blue'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-600 font-mono mt-0.5">
        <span>{state.fssBodyCount} bodies</span>
        <span>{state.fssNonBodyCount} signals</span>
      </div>
    </div>
  );
}

function ExobioPanel({ scans }: { scans: ExobioScan[] }) {
  return (
    <div className="bg-space-800 rounded border border-space-600 px-3 py-2">
      <div className="text-xs text-slate-400 mb-1">EXOBIOLOGY</div>
      <div className="space-y-1">
        {scans.map((scan, i) => (
          <ExobioRow key={`${scan.species}-${i}`} scan={scan} />
        ))}
      </div>
    </div>
  );
}

function ExobioRow({ scan }: { scan: ExobioScan }) {
  const dots = [1, 2, 3].map((n) => (
    <span
      key={n}
      className={`inline-block w-2 h-2 rounded-full mr-0.5 ${
        n <= scan.samplesCollected
          ? scan.completed ? 'bg-ed-green' : 'bg-ed-blue'
          : 'bg-space-600'
      }`}
    />
  ));

  return (
    <div className="flex items-center gap-2">
      <div className="flex shrink-0">{dots}</div>
      <span className={`text-xs font-mono truncate flex-1 ${scan.completed ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
        {scan.speciesLocalised || scan.species || scan.genusLocalised}
      </span>
      {!scan.completed && (
        <span className="text-xs text-slate-600 shrink-0">{scan.bodyName}</span>
      )}
    </div>
  );
}

function Stat({
  label, value, sub, valueColor = 'text-slate-200',
}: {
  label: string; value: string; sub?: string; valueColor?: string;
}) {
  return (
    <div className="bg-space-800 rounded border border-space-600 px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`font-mono font-bold text-sm ${valueColor}`}>{value}</div>
      {sub && <div className="text-xs text-slate-600 font-mono">{sub}</div>}
    </div>
  );
}
