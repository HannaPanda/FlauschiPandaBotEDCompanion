import React, { useEffect, useRef, useState } from 'react';
import { LogEntry } from '../types';

const MAX_DISPLAY = 200;

export default function Log() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (!('edApi' in window)) return;

    window.edApi.getLogHistory().then(setEntries);

    const unsub = window.edApi.onLogEntry((entry) => {
      setEntries((prev) => {
        const next = [...prev, entry];
        return next.length > MAX_DISPLAY ? next.slice(-MAX_DISPLAY) : next;
      });
    });

    return unsub;
  }, []);

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [entries, autoScroll]);

  // Detect manual scroll up → disable auto-scroll
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(atBottom);
  };

  return (
    <div className="flex flex-col h-full">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-2 font-mono text-xs"
      >
        {entries.length === 0 ? (
          <div className="text-slate-600 italic p-2">No log entries yet.</div>
        ) : (
          entries.map((e, i) => (
            <LogLine key={i} entry={e} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {!autoScroll && (
        <button
          onClick={() => {
            setAutoScroll(true);
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="shrink-0 text-xs text-ed-blue border-t border-space-600 py-1 hover:bg-space-700 transition-colors"
        >
          scroll to bottom
        </button>
      )}
    </div>
  );
}

function LogLine({ entry }: { entry: LogEntry }) {
  const levelColor =
    entry.level === 'error'
      ? 'text-red-400'
      : entry.level === 'warn'
      ? 'text-yellow-400'
      : 'text-slate-500';

  const msgColor =
    entry.level === 'error'
      ? 'text-red-300'
      : entry.level === 'warn'
      ? 'text-yellow-200'
      : 'text-slate-300';

  return (
    <div className="flex gap-2 py-px hover:bg-space-700 px-1 rounded">
      <span className="text-slate-600 shrink-0 tabular-nums">{entry.ts.slice(11, 19)}</span>
      <span className={`w-9 shrink-0 uppercase ${levelColor}`}>{entry.level}</span>
      <span className={`break-all ${msgColor}`}>{entry.msg}</span>
    </div>
  );
}
