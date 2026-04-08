import React from 'react';

interface ConnectionStatusProps {
  wsConnected: boolean;
  wsEnabled: boolean;
}

export default function ConnectionStatus({ wsConnected, wsEnabled }: ConnectionStatusProps) {
  if (!wsEnabled) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
        <span className="text-xs text-slate-600">WS disabled</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-1.5 h-1.5 rounded-full ${
          wsConnected ? 'bg-ed-green' : 'bg-ed-red animate-pulse'
        }`}
      />
      <span className={`text-xs ${wsConnected ? 'text-ed-green' : 'text-red-400'}`}>
        {wsConnected ? 'Live' : 'Disconnected'}
      </span>
    </div>
  );
}
