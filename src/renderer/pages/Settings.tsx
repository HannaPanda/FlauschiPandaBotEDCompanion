import React, { useState, useEffect } from 'react';
import { AppSettings } from '../types';

interface SettingsProps {
  settings: AppSettings | null;
  onSave: (s: AppSettings) => Promise<void>;
  isElectron: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  journalPath: '',
  wsEnabled: false,
  wsUrl: 'wss://flauschipandabot.de/ed-integration',
  wsSecret: '',
  fuelWarningThreshold: 30,
  fuelLookaheadHops: 10,
  alwaysOnTop: true,
  opacity: 0.9,
  windowBounds: { x: 100, y: 100, w: 420, h: 620 },
};

export default function Settings({ settings, onSave, isElectron }: SettingsProps) {
  const [form, setForm] = useState<AppSettings>(settings ?? DEFAULT_SETTINGS);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [pathValid, setPathValid] = useState<boolean | null>(null);
  const [wsTestResult, setWsTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [wsTestLoading, setWsTestLoading] = useState(false);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaveStatus('idle');
  };

  const handleSave = async () => {
    try {
      await onSave(form);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
    }
  };

  const handleDetectPath = async () => {
    if (!isElectron) return;
    const detected = await window.edApi.detectPath();
    if (detected) {
      set('journalPath', detected);
      setPathValid(true);
    }
  };

  const handleVerifyPath = async () => {
    if (!isElectron) return;
    const valid = await window.edApi.verifyPath(form.journalPath);
    setPathValid(valid);
  };

  const handleTestWs = async () => {
    if (!isElectron) return;
    setWsTestLoading(true);
    setWsTestResult(null);
    const result = await window.edApi.testWs(form.wsUrl, form.wsSecret);
    setWsTestResult(result);
    setWsTestLoading(false);
  };

  return (
    <div className="h-full overflow-y-auto px-3 py-3 space-y-4">
      {/* Journal Path */}
      <Section title="JOURNAL PATH">
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={form.journalPath}
              onChange={(e) => { set('journalPath', e.target.value); setPathValid(null); }}
              className="flex-1 bg-space-700 border border-space-500 rounded px-2 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-ed-blue"
              placeholder="C:\Users\...\Saved Games\..."
            />
          </div>
          <div className="flex gap-2">
            <ActionButton onClick={handleDetectPath} disabled={!isElectron}>
              Auto-detect
            </ActionButton>
            <ActionButton onClick={handleVerifyPath} disabled={!isElectron || !form.journalPath}>
              Verify
            </ActionButton>
            {pathValid !== null && (
              <span className={`text-xs self-center ${pathValid ? 'text-ed-green' : 'text-ed-red'}`}>
                {pathValid ? 'Path exists' : 'Path not found'}
              </span>
            )}
          </div>
        </div>
      </Section>

      {/* WebSocket */}
      <Section title="WEBSOCKET">
        <div className="space-y-2">
          <Toggle
            label="Enable WebSocket streaming"
            checked={form.wsEnabled}
            onChange={(v) => set('wsEnabled', v)}
          />
          <div className="space-y-1.5">
            <label className="text-xs text-slate-500">Server URL</label>
            <input
              type="text"
              value={form.wsUrl}
              onChange={(e) => set('wsUrl', e.target.value)}
              disabled={!form.wsEnabled}
              className="w-full bg-space-700 border border-space-500 rounded px-2 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-ed-blue disabled:opacity-40"
              placeholder="wss://..."
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-slate-500">Secret</label>
            <input
              type="password"
              value={form.wsSecret}
              onChange={(e) => set('wsSecret', e.target.value)}
              disabled={!form.wsEnabled}
              className="w-full bg-space-700 border border-space-500 rounded px-2 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-ed-blue disabled:opacity-40"
              placeholder="••••••••"
            />
          </div>
          <div className="flex items-center gap-2">
            <ActionButton
              onClick={handleTestWs}
              disabled={!isElectron || !form.wsEnabled || !form.wsUrl || wsTestLoading}
            >
              {wsTestLoading ? 'Testing...' : 'Test Connection'}
            </ActionButton>
            {wsTestResult && (
              <span className={`text-xs ${wsTestResult.success ? 'text-ed-green' : 'text-ed-red'}`}>
                {wsTestResult.message}
              </span>
            )}
          </div>
        </div>
      </Section>

      {/* Thresholds */}
      <Section title="THRESHOLDS">
        <div className="space-y-3">
          <SliderField
            label="Fuel Warning Threshold"
            value={form.fuelWarningThreshold}
            min={5}
            max={80}
            step={5}
            unit="%"
            onChange={(v) => set('fuelWarningThreshold', v)}
          />
          <NumberField
            label="Lookahead Hops"
            value={form.fuelLookaheadHops}
            min={1}
            max={50}
            onChange={(v) => set('fuelLookaheadHops', v)}
          />
        </div>
      </Section>

      {/* UI */}
      <Section title="INTERFACE">
        <div className="space-y-3">
          <Toggle
            label="Always on top"
            checked={form.alwaysOnTop}
            onChange={(v) => set('alwaysOnTop', v)}
          />
          <SliderField
            label="Window opacity"
            value={Math.round(form.opacity * 100)}
            min={20}
            max={100}
            step={5}
            unit="%"
            onChange={(v) => set('opacity', v / 100)}
          />
        </div>
      </Section>

      {/* Save */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-ed-blue bg-opacity-20 border border-ed-blue text-ed-blue text-xs font-bold rounded hover:bg-opacity-30 transition-colors"
        >
          SAVE SETTINGS
        </button>
        {saveStatus === 'saved' && (
          <span className="text-xs text-ed-green">Saved successfully</span>
        )}
        {saveStatus === 'error' && (
          <span className="text-xs text-ed-red">Save failed</span>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-space-800 rounded border border-space-600 px-3 py-3 space-y-2">
      <div className="text-xs text-slate-500 font-bold tracking-widest mb-2">{title}</div>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-xs text-slate-300">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors ${
          checked ? 'bg-ed-blue' : 'bg-space-500'
        }`}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono text-ed-blue">
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-space-600 rounded appearance-none cursor-pointer accent-ed-blue"
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-400">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-16 bg-space-700 border border-space-500 rounded px-2 py-1 text-xs font-mono text-ed-blue text-center focus:outline-none focus:border-ed-blue"
      />
    </div>
  );
}

function ActionButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1 text-xs bg-space-700 border border-space-500 rounded text-slate-300 hover:border-ed-blue hover:text-ed-blue transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}
