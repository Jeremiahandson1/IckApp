// Shared primitives for the admin console — table scaffolding, buttons,
// confirm dialog, pagination, CSV export. Every section imports from here so
// the console stays visually consistent.

import { useState, useEffect } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { admin } from '../../utils/api';
import { Search, ChevronLeft, ChevronRight, Download } from 'lucide-react';

export function SectionHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-end justify-between mb-5 pb-4 border-b border-[#1e1e1e]">
      <div>
        <h1 className="text-2xl font-bold text-[#f4f4f0]">{title}</h1>
        {subtitle && <p className="text-sm text-[#888] mt-1">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </div>
  );
}

export function StatCard({ label, value, hint }) {
  return (
    <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-sm p-4">
      <p className="text-xs uppercase tracking-wider text-[#666]">{label}</p>
      <p className="text-2xl font-bold text-[#f4f4f0] mt-1">
        {typeof value === 'number' ? value.toLocaleString() : (value ?? '—')}
      </p>
      {hint && <p className="text-xs text-[#666] mt-1">{hint}</p>}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', autoFocus = false }) {
  return (
    <div className="relative flex-1 max-w-sm">
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full pl-9 pr-3 py-2 bg-[#0d0d0d] border border-[#2a2a2a] rounded-sm text-sm text-[#ddd] placeholder:text-[#555] focus:outline-none focus:border-[#c8f135]/40"
      />
    </div>
  );
}

export function Pagination({ page, total, limit, onPage }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-3 text-sm">
      <p className="text-[#666]">
        Page {page} of {pages} ({total.toLocaleString()} total)
      </p>
      <div className="flex gap-1">
        <button
          onClick={() => onPage(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="px-2 py-1 bg-[#1a1a1a] hover:bg-[#222] text-[#bbb] rounded-sm disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPage(Math.min(pages, page + 1))}
          disabled={page >= pages}
          className="px-2 py-1 bg-[#1a1a1a] hover:bg-[#222] text-[#bbb] rounded-sm disabled:opacity-30"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function EmptyState({ message = 'Nothing here yet.' }) {
  return (
    <div className="bg-[#0d0d0d] border border-dashed border-[#2a2a2a] rounded-sm p-10 text-center text-[#666]">
      {message}
    </div>
  );
}

export function LoadingRow({ cols = 4 }) {
  return (
    <tr className="border-b border-[#1a1a1a]">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-3 bg-[#1a1a1a] rounded-sm animate-pulse" style={{ width: `${30 + (i * 13) % 60}%` }} />
        </td>
      ))}
    </tr>
  );
}

export function Table({ children, className = '' }) {
  return (
    <div className={`bg-[#0d0d0d] border border-[#1e1e1e] rounded-sm overflow-x-auto ${className}`}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className = '' }) {
  return (
    <th className={`px-3 py-2 text-left text-[10px] font-mono uppercase tracking-wider text-[#666] bg-[#111] border-b border-[#1e1e1e] ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = '' }) {
  return (
    <td className={`px-3 py-2 text-[#ddd] border-b border-[#1a1a1a] ${className}`}>
      {children}
    </td>
  );
}

export function Btn({ children, variant = 'default', size = 'sm', ...props }) {
  const base = 'inline-flex items-center gap-1.5 rounded-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const sizes = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-3 py-2 text-sm' };
  const variants = {
    default: 'bg-[#1a1a1a] hover:bg-[#222] text-[#ddd] border border-[#2a2a2a]',
    primary: 'bg-[#c8f135] hover:bg-[#b8e125] text-[#0a0a0a]',
    danger:  'bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30',
    ghost:   'text-[#888] hover:text-[#ddd] hover:bg-[#1a1a1a]',
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]}`} {...props}>
      {children}
    </button>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div className="bg-[#111] border border-[#2a2a2a] rounded-sm max-w-md w-full mx-4 p-5" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-[#f4f4f0]">{title}</h3>
        <p className="text-sm text-[#bbb] mt-2 mb-4">{message}</p>
        <div className="flex justify-end gap-2">
          <Btn onClick={onCancel}>Cancel</Btn>
          <Btn variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Btn>
        </div>
      </div>
    </div>
  );
}

export function useConfirm() {
  const [state, setState] = useState({ open: false });
  const confirm = (opts) => new Promise(resolve => {
    setState({ open: true, ...opts, _resolve: resolve });
  });
  const onConfirm = () => { state._resolve?.(true);  setState({ open: false }); };
  const onCancel  = () => { state._resolve?.(false); setState({ open: false }); };
  return [confirm, <ConfirmDialog key="cd" {...state} onConfirm={onConfirm} onCancel={onCancel} />];
}

export function ExportButton({ resource }) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const click = async () => {
    setBusy(true);
    try {
      await admin.exportCsv(resource);
      showToast(`Exported ${resource} CSV`, 'success');
    } catch (e) {
      showToast(e.message || 'Export failed', 'error');
    } finally { setBusy(false); }
  };
  return (
    <Btn onClick={click} disabled={busy}>
      <Download className="w-3.5 h-3.5" />
      {busy ? 'Exporting…' : 'Export CSV'}
    </Btn>
  );
}

// Debounce hook for search inputs
export function useDebounced(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
