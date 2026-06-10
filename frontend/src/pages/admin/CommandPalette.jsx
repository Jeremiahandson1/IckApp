// Command palette (Cmd/Ctrl+K) — quick keyboard-driven jump-to-section.
// Receives the section list from the shell so it stays the single source of
// truth for what sections exist.

import { useState, useEffect, useMemo, useRef } from 'react';
import { Search } from 'lucide-react';

export default function CommandPalette({ open, onClose, onJump, sections }) {
  const [q, setQ] = useState('');
  const inputRef = useRef(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    if (open) {
      setQ('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const matches = useMemo(() => {
    const lower = q.toLowerCase().trim();
    if (!lower) return sections;
    return sections.filter(s => s.label.toLowerCase().includes(lower) || s.key.includes(lower));
  }, [q, sections]);

  useEffect(() => { setSelectedIdx(0); }, [q]);

  if (!open) return null;

  const onKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const m = matches[selectedIdx];
      if (m) { onJump(m.key); onClose(); }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-start justify-center pt-32 p-4" onClick={onClose}>
      <div className="bg-[#111] border border-[#2a2a2a] rounded-sm w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="px-3 py-2 border-b border-[#1e1e1e] flex items-center gap-2">
          <Search className="w-4 h-4 text-[#555]" />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Jump to section…"
            className="flex-1 bg-transparent text-sm text-[#ddd] outline-none placeholder:text-[#555]"
          />
          <kbd className="text-[10px] font-mono text-[#555] bg-[#1a1a1a] px-1.5 py-0.5 rounded">ESC</kbd>
        </div>
        <ul className="py-1 max-h-80 overflow-y-auto">
          {matches.length === 0 ? (
            <li className="px-3 py-3 text-sm text-[#666] text-center">No matches</li>
          ) : matches.map((m, i) => {
            const Icon = m.icon;
            const active = i === selectedIdx;
            return (
              <li key={m.key}>
                <button
                  onClick={() => { onJump(m.key); onClose(); }}
                  onMouseEnter={() => setSelectedIdx(i)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left ${
                    active ? 'bg-[#1a1a1a] text-[#c8f135]' : 'text-[#bbb]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {m.label}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="px-3 py-2 border-t border-[#1e1e1e] text-[10px] font-mono text-[#555] flex gap-3">
          <span><kbd className="bg-[#1a1a1a] px-1 rounded">↑↓</kbd> navigate</span>
          <span><kbd className="bg-[#1a1a1a] px-1 rounded">↵</kbd> select</span>
        </div>
      </div>
    </div>
  );
}
