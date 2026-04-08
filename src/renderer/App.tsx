import React, { useEffect, useState } from 'react';
import { EDState, AppSettings, DEFAULT_STATE } from './types';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';

type Tab = 'dashboard' | 'settings';

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && 'edApi' in window;

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [state, setState] = useState<EDState>(DEFAULT_STATE);
  const [wsStatus, setWsStatus] = useState<string>('disconnected');
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    if (!isElectron) return;

    // Load initial settings
    window.edApi.getSettings().then(setSettings);

    // Subscribe to state updates
    const unsub1 = window.edApi.onStateUpdate((s) => setState(s));
    const unsub2 = window.edApi.onWsStatus((s) => setWsStatus(s));

    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  const handleSaveSettings = async (s: AppSettings) => {
    if (!isElectron) return;
    await window.edApi.saveSettings(s);
    setSettings(s);
  };

  return (
    <div className="flex flex-col h-screen bg-space-900 text-slate-200 select-none overflow-hidden">
      {/* Title bar */}
      <TitleBar wsStatus={wsStatus} tab={tab} onTabChange={setTab} />

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'dashboard' ? (
          <Dashboard state={state} settings={settings} />
        ) : (
          <Settings
            settings={settings}
            onSave={handleSaveSettings}
            isElectron={isElectron}
          />
        )}
      </div>
    </div>
  );
}

function TitleBar({
  wsStatus,
  tab,
  onTabChange,
}: {
  wsStatus: string;
  tab: string;
  onTabChange: (t: 'dashboard' | 'settings') => void;
}) {
  const handleMinimize = () => {
    if ('edApi' in window) window.edApi.minimize();
  };
  const handleClose = () => {
    if ('edApi' in window) window.edApi.closeWindow();
  };

  return (
    <div className="drag-region flex items-center justify-between px-3 py-2 bg-space-800 border-b border-space-600 shrink-0">
      {/* Logo + title */}
      <div className="flex items-center gap-2">
        <span className="text-ed-orange font-bold text-sm tracking-widest">ED</span>
        <span className="text-slate-400 text-xs">COMPANION</span>
      </div>

      {/* Tabs */}
      <div className="no-drag flex gap-1">
        <TabButton active={tab === 'dashboard'} onClick={() => onTabChange('dashboard')}>
          DASHBOARD
        </TabButton>
        <TabButton active={tab === 'settings'} onClick={() => onTabChange('settings')}>
          SETTINGS
        </TabButton>
      </div>

      {/* Controls */}
      <div className="no-drag flex items-center gap-2">
        <WsIndicator status={wsStatus} />
        <button
          onClick={handleMinimize}
          className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-slate-200 text-xs"
          title="Minimize"
        >
          &#8722;
        </button>
        <button
          onClick={handleClose}
          className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-red-400 text-xs"
          title="Hide to tray"
        >
          &#10005;
        </button>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-xs font-mono tracking-wider transition-colors ${
        active
          ? 'text-ed-blue border-b border-ed-blue'
          : 'text-slate-500 hover:text-slate-300'
      }`}
    >
      {children}
    </button>
  );
}

function WsIndicator({ status }: { status: string }) {
  const color =
    status === 'connected'
      ? 'bg-ed-green'
      : status === 'reconnecting'
      ? 'bg-ed-yellow animate-pulse'
      : 'bg-red-500';

  const label =
    status === 'connected' ? 'WS' : status === 'reconnecting' ? 'WS...' : 'WS';

  return (
    <div className="flex items-center gap-1" title={`WebSocket: ${status}`}>
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}
