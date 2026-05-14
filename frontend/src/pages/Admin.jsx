// Admin console — sidebar shell + 9 sections.
//
// Sections use a shared DataTable for visual consistency. Every mutation
// fires a toast and is logged server-side to admin_actions for audit.
//
// URL state: ?section=brands maps to active section, so back/forward works.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { admin } from '../utils/api';
import {
  LayoutDashboard, Users as UsersIcon, CreditCard, Inbox,
  ChefHat, Building2, Tag, ToggleLeft, History, ChevronLeft, ChevronRight,
  Search, Trash2, Edit2, Plus, X, AlertCircle, Check, Download,
  Command as CommandIcon, LogIn, Megaphone, Mail, Bell, Send,
} from 'lucide-react';

const SECTIONS = [
  { key: 'dashboard',     label: 'Dashboard',      icon: LayoutDashboard },
  { key: 'users',         label: 'Users',          icon: UsersIcon },
  { key: 'subscriptions', label: 'Subscriptions',  icon: CreditCard },
  { key: 'contributions', label: 'Contributions',  icon: Inbox },
  { key: 'recipes',       label: 'Recipes',        icon: ChefHat },
  { key: 'companies',     label: 'Companies',      icon: Building2 },
  { key: 'brands',        label: 'Brand Aliases',  icon: Tag },
  { key: 'flags',         label: 'Feature Flags',  icon: ToggleLeft },
  { key: 'broadcast',     label: 'Broadcast',      icon: Megaphone },
  { key: 'audit',         label: 'Audit Log',      icon: History },
];

// ══════════════════════════════════════════════════════════════════════════
// SHELL
// ══════════════════════════════════════════════════════════════════════════

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const section = params.get('section') || 'dashboard';
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    if (user && !user.is_admin) navigate('/', { replace: true });
  }, [user, navigate]);

  // Global Cmd/Ctrl+K → open palette
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!user?.is_admin) return null;

  const setSection = (key) => setParams({ section: key });
  const ActiveSection = SECTION_COMPONENTS[section] || DashboardSection;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f4f4f0] flex">
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onJump={setSection}
      />
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-[#0d0d0d] border-r border-[#1e1e1e] py-4">
        <div className="px-4 mb-6">
          <p className="text-xs text-[#666] font-mono uppercase tracking-wider">Ick Admin</p>
          <p className="text-sm text-[#bbb] mt-0.5">{user.email}</p>
        </div>
        <nav className="space-y-0.5">
          {SECTIONS.map(s => {
            const Icon = s.icon;
            const active = s.key === section;
            return (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-[rgba(200,241,53,0.08)] text-[#c8f135] border-l-2 border-[#c8f135]'
                    : 'text-[#888] hover:text-[#ddd] hover:bg-[#1a1a1a] border-l-2 border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                {s.label}
              </button>
            );
          })}
        </nav>
        <div className="px-4 mt-6 pt-4 border-t border-[#1e1e1e] space-y-2">
          <button
            onClick={() => setPaletteOpen(true)}
            className="w-full flex items-center gap-2 text-xs text-[#666] hover:text-[#ddd]"
          >
            <CommandIcon className="w-3 h-3" />
            Quick jump
            <kbd className="ml-auto text-[10px] font-mono bg-[#1a1a1a] px-1.5 py-0.5 rounded">⌘K</kbd>
          </button>
          <button
            onClick={() => navigate('/')}
            className="text-xs text-[#666] hover:text-[#ddd]"
          >
            ← Back to app
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 p-6 max-w-[1400px]">
        <ActiveSection />
      </main>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ══════════════════════════════════════════════════════════════════════════

function SectionHeader({ title, subtitle, actions }) {
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

function StatCard({ label, value, hint }) {
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

function SearchInput({ value, onChange, placeholder = 'Search…', autoFocus = false }) {
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

function Pagination({ page, total, limit, onPage }) {
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

function EmptyState({ message = 'Nothing here yet.' }) {
  return (
    <div className="bg-[#0d0d0d] border border-dashed border-[#2a2a2a] rounded-sm p-10 text-center text-[#666]">
      {message}
    </div>
  );
}

function LoadingRow({ cols = 4 }) {
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

function Table({ children, className = '' }) {
  return (
    <div className={`bg-[#0d0d0d] border border-[#1e1e1e] rounded-sm overflow-x-auto ${className}`}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

function Th({ children, className = '' }) {
  return (
    <th className={`px-3 py-2 text-left text-[10px] font-mono uppercase tracking-wider text-[#666] bg-[#111] border-b border-[#1e1e1e] ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = '' }) {
  return (
    <td className={`px-3 py-2 text-[#ddd] border-b border-[#1a1a1a] ${className}`}>
      {children}
    </td>
  );
}

function Btn({ children, variant = 'default', size = 'sm', ...props }) {
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

function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }) {
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

function useConfirm() {
  const [state, setState] = useState({ open: false });
  const confirm = (opts) => new Promise(resolve => {
    setState({ open: true, ...opts, _resolve: resolve });
  });
  const onConfirm = () => { state._resolve?.(true);  setState({ open: false }); };
  const onCancel  = () => { state._resolve?.(false); setState({ open: false }); };
  return [confirm, <ConfirmDialog key="cd" {...state} onConfirm={onConfirm} onCancel={onCancel} />];
}

function ExportButton({ resource }) {
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

// ── Command palette (Cmd/Ctrl+K) ──────────────────────────────────────────
// Quick keyboard-driven jump-to-section + simple actions. Listens for the
// shortcut globally inside the Admin shell. Renders a small modal with a
// search input; matches are sections by name. Hitting Enter on a match
// navigates via setSection.
function CommandPalette({ open, onClose, onJump }) {
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
    if (!lower) return SECTIONS;
    return SECTIONS.filter(s => s.label.toLowerCase().includes(lower) || s.key.includes(lower));
  }, [q]);

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

// Debounce hook for search inputs
function useDebounced(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

// ══════════════════════════════════════════════════════════════════════════
// SECTIONS
// ══════════════════════════════════════════════════════════════════════════

// ── Dashboard ─────────────────────────────────────────────────────────────
function DashboardSection() {
  const [data, setData] = useState(null);
  const [external, setExternal] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [h, ext, audit] = await Promise.all([
        admin.health(),
        admin.externalHealth().catch(() => null),
        admin.audit.list({ page: 1, limit: 10 }).catch(() => null),
      ]);
      setData(h);
      setExternal(ext);
      setActivity(audit?.actions || []);
    } catch {
      showToast('Failed to load dashboard', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) return <SectionHeader title="Dashboard" />;
  if (!data) return <EmptyState message="Dashboard data unavailable." />;

  const pendingContribs = data.contributions?.pending || 0;

  return (
    <>
      <SectionHeader
        title="Dashboard"
        subtitle="System health snapshot — refresh to update."
        actions={<Btn onClick={load}>Refresh</Btn>}
      />

      {pendingContribs > 0 && (
        <div className="mb-5 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-sm flex items-center gap-2 text-sm text-amber-300">
          <AlertCircle className="w-4 h-4" />
          {pendingContribs} product contribution{pendingContribs !== 1 ? 's' : ''} pending review.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Users"    value={data.users?.total}    hint={`+${data.users?.new_24h || 0} in 24h`} />
        <StatCard label="Products" value={data.products?.total} hint={`${data.products?.with_company || 0} with company`} />
        <StatCard label="Scans"    value={data.scans?.total}    hint={`${data.scans?.last_24h || 0} in 24h`} />
        <StatCard label="Pantry"   value={data.pantry?.active}  hint={`${data.pantry?.total || 0} total`} />
        <StatCard label="Recipes"  value={data.recipes?.total}  hint={`${data.recipes?.wikibooks || 0} from Wikibooks`} />
        <StatCard label="Companies"     value={data.companies?.total} />
        <StatCard label="Brand Aliases" value={data.brand_aliases?.total} />
        <StatCard label="Audit (24h)"   value={data.audit?.last_24h} hint={`${data.audit?.total || 0} all-time`} />
      </div>

      {/* External service health badges */}
      <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-sm p-4 mb-4">
        <h3 className="text-sm font-semibold mb-3">External services</h3>
        {external ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {external.services.map(s => (
              <div key={s.name} className="bg-[#111] border border-[#1e1e1e] rounded-sm px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    s.ok ? 'bg-green-400' :
                    s.error === 'no_api_key' ? 'bg-[#555]' :
                    'bg-red-400'
                  }`} />
                  <span className="text-xs font-mono text-[#bbb] uppercase">{s.name.replace(/_/g, ' ')}</span>
                </div>
                <p className="text-[10px] text-[#666] mt-1 font-mono">
                  {s.ok ? `${s.ms}ms · HTTP ${s.status}` :
                   s.error === 'no_api_key' ? 'not configured' :
                   `failed · ${s.error || `HTTP ${s.status}`}`}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[#666]">Service health unavailable.</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-sm p-4">
          <h3 className="text-sm font-semibold mb-3">Subscriptions</h3>
          {data.subscriptions?.length === 0 ? (
            <p className="text-xs text-[#666]">No subscriptions yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {data.subscriptions?.map(s => (
                <li key={`${s.plan}-${s.status}`} className="flex justify-between text-[#bbb]">
                  <span>{s.plan} / {s.status}</span>
                  <span className="font-mono text-[#888]">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-sm p-4">
          <h3 className="text-sm font-semibold mb-3">Feature flags</h3>
          <p className="text-sm text-[#bbb]">
            <span className="text-[#c8f135]">{data.flags?.on || 0}</span> on /{' '}
            <span className="text-[#666]">{data.flags?.off || 0}</span> off
          </p>
        </div>
      </div>

      {/* Activity feed */}
      <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-sm p-4">
        <h3 className="text-sm font-semibold mb-3">Recent admin activity</h3>
        {activity.length === 0 ? (
          <p className="text-xs text-[#666]">No activity yet — actions taken in this admin will appear here.</p>
        ) : (
          <ul className="space-y-1.5">
            {activity.map(a => (
              <li key={a.id} className="text-xs flex items-center gap-2 text-[#888]">
                <span className="text-[#555] font-mono w-32 flex-shrink-0">
                  {new Date(a.created_at).toLocaleString()}
                </span>
                <span className="text-[#bbb]">{a.admin_email || '(deleted)'}</span>
                <span className="font-mono text-[10px] bg-[#1a1a1a] text-[#c8f135] px-1.5 py-0.5 rounded">
                  {a.action}
                </span>
                {a.target_type && (
                  <span className="text-[#666]">on {a.target_type}/{a.target_id || '*'}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

// ── Users ─────────────────────────────────────────────────────────────────
function UsersSection() {
  const { showToast } = useToast();
  const [confirm, confirmEl] = useConfirm();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 300);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ users: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [drawerUserId, setDrawerUserId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await admin.users.list({ search: debouncedSearch, page, limit: 25 }));
    } catch { showToast('Failed to load users', 'error'); }
    finally { setLoading(false); }
  }, [debouncedSearch, page, showToast]);

  useEffect(() => { setPage(1); }, [debouncedSearch]);
  useEffect(() => { load(); }, [load]);

  const toggleAdmin = async (u) => {
    const ok = await confirm({
      title: u.is_admin ? 'Revoke admin?' : 'Grant admin?',
      message: `${u.is_admin ? 'Revoke' : 'Grant'} admin access for ${u.email}?`,
      confirmLabel: u.is_admin ? 'Revoke' : 'Grant',
      danger: u.is_admin,
    });
    if (!ok) return;
    try {
      await admin.users.setAdmin(u.id, !u.is_admin);
      showToast(`Admin ${u.is_admin ? 'revoked' : 'granted'}`, 'success');
      load();
    } catch (e) { showToast(e.message || 'Failed', 'error'); }
  };

  const grantTrial = async (u, days) => {
    try {
      await admin.users.grantTrial(u.id, days);
      showToast(`Granted ${days}-day trial`, 'success');
      load();
    } catch (e) { showToast(e.message || 'Failed', 'error'); }
  };

  const compPremium = async (u) => {
    const ok = await confirm({
      title: 'Comp lifetime premium?',
      message: `Give ${u.email} lifetime premium with no expiry?`,
      confirmLabel: 'Comp',
    });
    if (!ok) return;
    try {
      await admin.users.compPremium(u.id);
      showToast('Lifetime premium granted', 'success');
      load();
    } catch (e) { showToast(e.message || 'Failed', 'error'); }
  };

  const deleteUser = async (u) => {
    const ok = await confirm({
      title: 'Delete user?',
      message: `Permanently delete ${u.email} and all their data? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await admin.users.remove(u.id);
      showToast('User deleted', 'success');
      load();
    } catch (e) { showToast(e.message || 'Failed', 'error'); }
  };

  return (
    <>
      <SectionHeader
        title="Users"
        subtitle={`${data.total.toLocaleString()} total`}
        actions={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="Email or name…" />
            <ExportButton resource="users" />
          </>
        }
      />
      {confirmEl}

      <Table>
        <thead>
          <tr>
            <Th>Email</Th>
            <Th>Name</Th>
            <Th>Scans</Th>
            <Th>Subscription</Th>
            <Th>Joined</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {loading && data.users.length === 0
            ? Array.from({ length: 6 }).map((_, i) => <LoadingRow key={i} cols={6} />)
            : data.users.map(u => (
              <tr key={u.id} className="hover:bg-[#111]">
                <Td>
                  <button onClick={() => setDrawerUserId(u.id)} className="flex items-center gap-2 hover:text-[#c8f135]">
                    {u.email}
                    {u.is_admin && <span className="text-[9px] font-mono bg-[#c8f135]/15 text-[#c8f135] px-1.5 py-0.5 rounded">ADMIN</span>}
                  </button>
                </Td>
                <Td className="text-[#888]">{u.name || '—'}</Td>
                <Td className="font-mono text-[#888]">{u.scans}</Td>
                <Td>
                  {u.sub_status === 'active' ? (
                    <span className="text-[#c8f135] text-xs font-mono">{u.sub_plan}</span>
                  ) : (
                    <span className="text-[#666] text-xs">free</span>
                  )}
                </Td>
                <Td className="text-[#666] text-xs">{new Date(u.created_at).toLocaleDateString()}</Td>
                <Td>
                  <div className="flex gap-1">
                    <Btn variant="ghost" onClick={() => toggleAdmin(u)}>{u.is_admin ? 'Un-admin' : 'Admin'}</Btn>
                    <Btn variant="ghost" onClick={() => grantTrial(u, 30)}>+30d</Btn>
                    <Btn variant="ghost" onClick={() => compPremium(u)}>Comp</Btn>
                    <Btn variant="danger" onClick={() => deleteUser(u)}><Trash2 className="w-3 h-3" /></Btn>
                  </div>
                </Td>
              </tr>
            ))}
        </tbody>
      </Table>
      <Pagination page={page} total={data.total} limit={25} onPage={setPage} />

      {drawerUserId && (
        <UserDetailDrawer userId={drawerUserId} onClose={() => setDrawerUserId(null)} onMutated={load} />
      )}
    </>
  );
}

// User detail drawer — opens when a user row is clicked. Shows stats +
// per-user audit history + the same admin actions inline.
function UserDetailDrawer({ userId, onClose, onMutated }) {
  const { showToast } = useToast();
  const [confirm, confirmEl] = useConfirm();
  const [detail, setDetail] = useState(null);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, a] = await Promise.all([
        admin.users.get(userId),
        admin.users.audit(userId).catch(() => ({ actions: [] })),
      ]);
      setDetail(d);
      setAudit(a.actions || []);
    } catch (e) {
      showToast(e.message || 'Failed to load user', 'error');
    } finally { setLoading(false); }
  }, [userId, showToast]);

  useEffect(() => { load(); }, [load]);

  const doAction = async (label, fn, refresh = true) => {
    try {
      await fn();
      showToast(label, 'success');
      if (refresh) { load(); onMutated?.(); }
    } catch (e) { showToast(e.message || 'Failed', 'error'); }
  };

  if (!detail && !loading) return null;

  const u = detail?.user;
  const s = detail?.stats;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex justify-end" onClick={onClose}>
      {confirmEl}
      <div className="bg-[#111] border-l border-[#2a2a2a] w-full max-w-lg h-full overflow-y-auto"
           onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[#1e1e1e] flex justify-between items-center sticky top-0 bg-[#111]">
          <h3 className="font-semibold">User detail</h3>
          <button onClick={onClose} className="text-[#666] hover:text-[#ddd]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading || !u ? (
          <div className="p-5"><p className="text-[#666] text-sm">Loading…</p></div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Identity */}
            <div>
              <p className="text-sm font-mono text-[#888]">{u.email}</p>
              <p className="text-lg font-semibold text-[#f4f4f0] mt-0.5">{u.name || '(no name)'}</p>
              <div className="flex gap-2 mt-2">
                {u.is_admin && <span className="text-[10px] font-mono bg-[#c8f135]/15 text-[#c8f135] px-1.5 py-0.5 rounded">ADMIN</span>}
                {u.email_verified_at && <span className="text-[10px] font-mono bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded">VERIFIED</span>}
                {u.zip_code && <span className="text-[10px] font-mono bg-[#1a1a1a] text-[#bbb] px-1.5 py-0.5 rounded">ZIP {u.zip_code}</span>}
              </div>
              <p className="text-[10px] text-[#555] mt-2 font-mono">
                joined {new Date(u.created_at).toLocaleString()}
              </p>
            </div>

            {/* Stats */}
            <div>
              <p className="text-xs font-mono text-[#666] uppercase mb-2">Activity</p>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Scans"           value={s?.scans} />
                <Stat label="Pantry items"    value={s?.pantry} />
                <Stat label="Recipes viewed"  value={s?.recipes_viewed} />
                <Stat label="Contributions"   value={s?.contributions} />
                <Stat label="Family memberships" value={s?.family_memberships} />
              </div>
            </div>

            {/* Subscription */}
            <div>
              <p className="text-xs font-mono text-[#666] uppercase mb-2">Subscription</p>
              {u.sub_plan ? (
                <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-sm p-3 text-sm">
                  <p><span className="text-[#888]">Plan:</span> <span className="text-[#c8f135] font-mono">{u.sub_plan}</span></p>
                  <p><span className="text-[#888]">Status:</span> {u.sub_status}</p>
                  {u.trial_ends_at && <p><span className="text-[#888]">Trial ends:</span> {new Date(u.trial_ends_at).toLocaleString()}</p>}
                  {u.expires_at && <p><span className="text-[#888]">Expires:</span> {new Date(u.expires_at).toLocaleString()}</p>}
                </div>
              ) : (
                <p className="text-sm text-[#666]">Free tier (no subscription record).</p>
              )}
            </div>

            {/* Actions */}
            <div>
              <p className="text-xs font-mono text-[#666] uppercase mb-2">Actions</p>
              <div className="flex flex-wrap gap-2">
                <Btn onClick={async () => {
                  const ok = await confirm({
                    title: u.is_admin ? 'Revoke admin?' : 'Grant admin?',
                    message: `${u.is_admin ? 'Revoke' : 'Grant'} admin access for ${u.email}?`,
                    danger: u.is_admin, confirmLabel: u.is_admin ? 'Revoke' : 'Grant',
                  });
                  if (ok) doAction(u.is_admin ? 'Admin revoked' : 'Admin granted',
                    () => admin.users.setAdmin(u.id, !u.is_admin));
                }}>
                  {u.is_admin ? 'Revoke admin' : 'Grant admin'}
                </Btn>
                <Btn onClick={() => doAction('30-day trial granted', () => admin.users.grantTrial(u.id, 30))}>
                  Grant 30-day trial
                </Btn>
                <Btn onClick={async () => {
                  const ok = await confirm({
                    title: 'Comp lifetime premium?',
                    message: `Give ${u.email} lifetime premium with no expiry?`, confirmLabel: 'Comp',
                  });
                  if (ok) doAction('Lifetime premium granted', () => admin.users.compPremium(u.id));
                }}>
                  Comp lifetime
                </Btn>
                <Btn onClick={async () => {
                  const ok = await confirm({
                    title: 'Cancel subscription?',
                    message: `Cancel subscription for ${u.email}? They'll fall back to free tier.`,
                    confirmLabel: 'Cancel sub', danger: true,
                  });
                  if (ok) doAction('Subscription cancelled', () => admin.users.cancelSub(u.id));
                }}>
                  Cancel subscription
                </Btn>
                <Btn variant="primary" onClick={async () => {
                  const ok = await confirm({
                    title: 'Impersonate user?',
                    message: `Generate a short-lived session for ${u.email}? You'll be logged in as them. Action is audited.`,
                    confirmLabel: 'Impersonate',
                  });
                  if (!ok) return;
                  try {
                    const r = await admin.users.impersonate(u.id);
                    // Store original admin token so we can return
                    const adminToken = localStorage.getItem('token');
                    if (adminToken) localStorage.setItem('admin_return_token', adminToken);
                    localStorage.setItem('token', r.token);
                    showToast('Impersonating — page will reload', 'success');
                    setTimeout(() => { window.location.href = '/'; }, 500);
                  } catch (e) { showToast(e.message || 'Failed', 'error'); }
                }}>
                  <LogIn className="w-3.5 h-3.5" /> Impersonate
                </Btn>
                <Btn variant="danger" onClick={async () => {
                  const ok = await confirm({
                    title: 'Delete user?',
                    message: `Permanently delete ${u.email} and ALL their data. This cannot be undone.`,
                    confirmLabel: 'Delete', danger: true,
                  });
                  if (ok) {
                    await doAction('User deleted', () => admin.users.remove(u.id), false);
                    onClose();
                    onMutated?.();
                  }
                }}>
                  <Trash2 className="w-3.5 h-3.5" /> Delete user
                </Btn>
              </div>
            </div>

            {/* Audit on this user */}
            <div>
              <p className="text-xs font-mono text-[#666] uppercase mb-2">Recent admin actions on this user</p>
              {audit.length === 0 ? (
                <p className="text-sm text-[#666]">No prior admin actions logged.</p>
              ) : (
                <ul className="space-y-1.5">
                  {audit.map(a => (
                    <li key={a.id} className="text-xs flex items-center gap-2 text-[#888]">
                      <span className="text-[#555] font-mono w-28 flex-shrink-0">
                        {new Date(a.created_at).toLocaleDateString()}
                      </span>
                      <span className="font-mono text-[10px] bg-[#1a1a1a] text-[#c8f135] px-1.5 py-0.5 rounded">
                        {a.action}
                      </span>
                      <span className="text-[#666] truncate">{a.admin_email}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-sm p-2.5">
      <p className="text-[10px] font-mono text-[#666] uppercase">{label}</p>
      <p className="text-lg font-bold">{value ?? 0}</p>
    </div>
  );
}

// ── Subscriptions ─────────────────────────────────────────────────────────
function SubscriptionsSection() {
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState({ plan: '', status: '' });
  const [data, setData] = useState({ subscriptions: [], total: 0, summary: [] });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await admin.subscriptions.list({ ...filter, page, limit: 25 }));
    } catch { showToast('Failed to load', 'error'); }
    finally { setLoading(false); }
  }, [filter, page, showToast]);

  useEffect(() => { load(); }, [load]);

  const extend = async (s, days) => {
    try {
      await admin.subscriptions.extend(s.user_id, days);
      showToast(`Extended by ${days} days`, 'success');
      load();
    } catch (e) { showToast(e.message || 'Failed', 'error'); }
  };

  return (
    <>
      <SectionHeader
        title="Subscriptions"
        subtitle={`${data.total} matching`}
        actions={
          <div className="flex gap-2">
            <select value={filter.plan} onChange={e => { setFilter(f => ({ ...f, plan: e.target.value })); setPage(1); }}
                    className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-sm px-2 py-1.5 text-sm text-[#ddd]">
              <option value="">All plans</option>
              <option value="trial">Trial</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="comp">Comp</option>
              <option value="free">Free</option>
            </select>
            <select value={filter.status} onChange={e => { setFilter(f => ({ ...f, status: e.target.value })); setPage(1); }}
                    className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-sm px-2 py-1.5 text-sm text-[#ddd]">
              <option value="">Any status</option>
              <option value="active">Active</option>
              <option value="cancelled">Cancelled</option>
              <option value="expired">Expired</option>
            </select>
            <ExportButton resource="subscriptions" />
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        {data.summary?.map(s => (
          <div key={`${s.plan}-${s.status}`} className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-sm px-3 py-2">
            <p className="text-[10px] uppercase font-mono text-[#666]">{s.plan} / {s.status}</p>
            <p className="text-lg font-bold">{s.n}</p>
          </div>
        ))}
      </div>

      <Table>
        <thead>
          <tr>
            <Th>Email</Th>
            <Th>Plan</Th>
            <Th>Status</Th>
            <Th>Trial ends</Th>
            <Th>Expires</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {loading && data.subscriptions.length === 0
            ? Array.from({ length: 6 }).map((_, i) => <LoadingRow key={i} cols={6} />)
            : data.subscriptions.map(s => (
              <tr key={s.user_id} className="hover:bg-[#111]">
                <Td>{s.email}</Td>
                <Td><span className="text-xs font-mono text-[#c8f135]">{s.plan}</span></Td>
                <Td>
                  <span className={`text-xs ${s.status === 'active' ? 'text-green-400' : 'text-[#888]'}`}>
                    {s.status}
                  </span>
                </Td>
                <Td className="text-[#666] text-xs">{s.trial_ends_at ? new Date(s.trial_ends_at).toLocaleDateString() : '—'}</Td>
                <Td className="text-[#666] text-xs">{s.expires_at ? new Date(s.expires_at).toLocaleDateString() : '—'}</Td>
                <Td>
                  <Btn variant="ghost" onClick={() => extend(s, 30)}>+30d</Btn>
                </Td>
              </tr>
            ))}
        </tbody>
      </Table>
      <Pagination page={page} total={data.total} limit={25} onPage={setPage} />
    </>
  );
}

// ── Contributions ─────────────────────────────────────────────────────────
function ContributionsSection() {
  const { showToast } = useToast();
  const [confirm, confirmEl] = useConfirm();
  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await admin.contributions.list(status);
      setItems(Array.isArray(list) ? list : []);
    } catch { showToast('Failed to load contributions', 'error'); }
    finally { setLoading(false); }
  }, [status, showToast]);

  useEffect(() => { load(); }, [load]);

  const approve = async (c) => {
    const ok = await confirm({
      title: 'Approve contribution?',
      message: `Insert "${c.name}" (UPC ${c.upc}) into the products catalog and re-score?`,
      confirmLabel: 'Approve',
    });
    if (!ok) return;
    try {
      await admin.contributions.approve(c.id);
      showToast('Contribution approved + product inserted', 'success');
      load();
    } catch (e) { showToast(e.message || 'Failed', 'error'); }
  };

  const reject = async (c) => {
    try {
      await admin.contributions.reject(c.id, rejectReason || 'No reason provided');
      showToast('Contribution rejected', 'success');
      setRejectingId(null);
      setRejectReason('');
      load();
    } catch (e) { showToast(e.message || 'Failed', 'error'); }
  };

  return (
    <>
      <SectionHeader
        title="Contributions"
        subtitle={`${items.length} ${status}`}
        actions={
          <div className="flex gap-1">
            {['pending', 'approved', 'rejected'].map(s => (
              <button key={s} onClick={() => setStatus(s)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-sm ${
                        s === status
                          ? 'bg-[#c8f135] text-[#0a0a0a]'
                          : 'bg-[#1a1a1a] text-[#888] hover:text-[#ddd]'
                      }`}>
                {s}
              </button>
            ))}
          </div>
        }
      />
      {confirmEl}

      {loading && items.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 bg-[#0d0d0d] border border-[#1e1e1e] rounded-sm animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState message={`No ${status} contributions.`} />
      ) : (
        <div className="space-y-3">
          {items.map(c => (
            <div key={c.id} className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-sm p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-medium text-[#f4f4f0]">{c.name || '(no name)'}</p>
                  <p className="text-xs text-[#888] mt-0.5">
                    {c.brand && <>brand: <span className="text-[#bbb]">{c.brand}</span> · </>}
                    UPC: <span className="font-mono">{c.upc}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#666]">
                    {c.submitted_by_email || 'anonymous'}
                  </p>
                  <p className="text-[10px] text-[#555] font-mono">
                    {new Date(c.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {c.ingredients_text && (
                <div className="mt-3 text-xs text-[#bbb] bg-[#111] p-2 rounded-sm border border-[#1a1a1a]">
                  <p className="text-[#666] uppercase font-mono text-[10px] mb-1">Ingredients</p>
                  {c.ingredients_text}
                </div>
              )}

              {c.image_url && (
                <a href={c.image_url} target="_blank" rel="noopener noreferrer"
                   className="text-[10px] text-[#c8f135] mt-2 inline-block">
                  View submitted image ↗
                </a>
              )}

              {status === 'pending' && (
                rejectingId === c.id ? (
                  <div className="mt-3 flex gap-2">
                    <input
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      placeholder="Reason for rejection (optional)"
                      className="flex-1 bg-[#111] border border-[#2a2a2a] rounded-sm px-2 py-1.5 text-sm text-[#ddd]"
                      autoFocus
                    />
                    <Btn variant="danger" onClick={() => reject(c)}>Confirm reject</Btn>
                    <Btn onClick={() => { setRejectingId(null); setRejectReason(''); }}>Cancel</Btn>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <Btn variant="primary" onClick={() => approve(c)}>
                      <Check className="w-3 h-3" /> Approve + insert
                    </Btn>
                    <Btn variant="danger" onClick={() => setRejectingId(c.id)}>
                      <X className="w-3 h-3" /> Reject
                    </Btn>
                  </div>
                )
              )}
              {status !== 'pending' && c.reviewed_at && (
                <p className="mt-2 text-[10px] text-[#666] font-mono">
                  reviewed {new Date(c.reviewed_at).toLocaleString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Recipes ───────────────────────────────────────────────────────────────
function RecipesSection() {
  const { showToast } = useToast();
  const [confirm, confirmEl] = useConfirm();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState({ source: '', kid_friendly: '' });
  const [data, setData] = useState({ recipes: [], total: 0, source_breakdown: [] });
  const [loading, setLoading] = useState(true);
  const [editingRecipe, setEditingRecipe] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await admin.recipes.list({
        search: debouncedSearch, ...filter, page, limit: 50,
      }));
    } catch { showToast('Failed to load recipes', 'error'); }
    finally { setLoading(false); }
  }, [debouncedSearch, filter, page, showToast]);

  useEffect(() => { setPage(1); }, [debouncedSearch, filter]);
  useEffect(() => { load(); }, [load]);

  const remove = async (r) => {
    const ok = await confirm({
      title: 'Delete recipe?',
      message: `Permanently delete "${r.name}"?`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await admin.recipes.remove(r.id);
      showToast('Recipe deleted', 'success');
      load();
    } catch (e) { showToast(e.message || 'Failed', 'error'); }
  };

  return (
    <>
      <SectionHeader
        title="Recipes"
        subtitle={`${data.total.toLocaleString()} matching`}
        actions={
          <div className="flex gap-2 items-center">
            <SearchInput value={search} onChange={setSearch} placeholder="Recipe name…" />
            <select value={filter.source}
                    onChange={e => setFilter(f => ({ ...f, source: e.target.value }))}
                    className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-sm px-2 py-1.5 text-sm text-[#ddd]">
              <option value="">All sources</option>
              {data.source_breakdown?.map(s => (
                <option key={s.source} value={s.source === '(null)' ? '' : s.source}>
                  {s.source} ({s.n})
                </option>
              ))}
            </select>
            <ExportButton resource="recipes" />
          </div>
        }
      />
      {confirmEl}

      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Source</Th>
            <Th>Time</Th>
            <Th>Difficulty</Th>
            <Th>Ingredients</Th>
            <Th>Kid-friendly</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {loading && data.recipes.length === 0
            ? Array.from({ length: 8 }).map((_, i) => <LoadingRow key={i} cols={7} />)
            : data.recipes.map(r => (
              <tr key={r.id} className="hover:bg-[#111]">
                <Td>
                  <div className="flex items-center gap-2">
                    {r.image_url && <span className="text-[10px] text-[#c8f135]">🖼</span>}
                    {r.name}
                  </div>
                </Td>
                <Td>
                  <span className="text-[10px] font-mono text-[#888] bg-[#1a1a1a] px-1.5 py-0.5 rounded">
                    {r.source || '?'}
                  </span>
                </Td>
                <Td className="text-[#888]">{r.total_time_minutes ? `${r.total_time_minutes}m` : '—'}</Td>
                <Td className="text-[#888] capitalize">{r.difficulty || '—'}</Td>
                <Td className="font-mono text-[#888]">{r.ing_count}</Td>
                <Td>{r.kid_friendly ? <Check className="w-4 h-4 text-green-400" /> : <X className="w-4 h-4 text-[#444]" />}</Td>
                <Td>
                  <div className="flex gap-1">
                    {r.source_url && (
                      <a href={r.source_url} target="_blank" rel="noopener noreferrer"
                         className="text-[10px] text-[#666] hover:text-[#c8f135] px-2 py-1">↗</a>
                    )}
                    <Btn variant="ghost" onClick={() => setEditingRecipe(r)}><Edit2 className="w-3 h-3" /></Btn>
                    <Btn variant="danger" onClick={() => remove(r)}><Trash2 className="w-3 h-3" /></Btn>
                  </div>
                </Td>
              </tr>
            ))}
        </tbody>
      </Table>
      <Pagination page={page} total={data.total} limit={50} onPage={setPage} />

      {editingRecipe && (
        <RecipeEditModal
          recipe={editingRecipe}
          onClose={() => setEditingRecipe(null)}
          onSaved={() => { setEditingRecipe(null); load(); }}
        />
      )}
    </>
  );
}

// Recipe edit modal — small focused form for the fields admins actually
// need to fix. Full ingredients/instructions edit is intentionally raw
// JSON since the schema is JSONB and a structured editor is overkill.
function RecipeEditModal({ recipe, onClose, onSaved }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({
    name: recipe.name || '',
    description: recipe.description || '',
    replaces_category: recipe.replaces_category || '',
    kid_friendly: !!recipe.kid_friendly,
    dietary_tags: Array.isArray(recipe.dietary_tags) ? recipe.dietary_tags.join(', ') : '',
    vs_store_bought: recipe.vs_store_bought || '',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await admin.recipes.update(recipe.id, {
        name: form.name,
        description: form.description || null,
        replaces_category: form.replaces_category || null,
        kid_friendly: form.kid_friendly,
        dietary_tags: form.dietary_tags
          ? form.dietary_tags.split(',').map(s => s.trim()).filter(Boolean)
          : [],
        vs_store_bought: form.vs_store_bought || null,
      });
      showToast('Recipe updated', 'success');
      onSaved();
    } catch (e) {
      showToast(e.message || 'Failed to save', 'error');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-[#111] border border-[#2a2a2a] rounded-sm w-full max-w-2xl max-h-[90vh] overflow-y-auto"
           onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[#1e1e1e] flex justify-between items-center">
          <h3 className="font-semibold text-[#f4f4f0]">Edit recipe #{recipe.id}</h3>
          <button onClick={onClose} className="text-[#666] hover:text-[#ddd]">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs text-[#888] mb-1 block">Name</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-sm px-2.5 py-1.5 text-sm text-[#ddd]"
            />
          </div>
          <div>
            <label className="text-xs text-[#888] mb-1 block">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-sm px-2.5 py-1.5 text-sm text-[#ddd]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#888] mb-1 block">Replaces category</label>
              <input
                value={form.replaces_category}
                onChange={e => setForm(f => ({ ...f, replaces_category: e.target.value }))}
                placeholder="e.g. boxed_mac"
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-sm px-2.5 py-1.5 text-sm text-[#ddd]"
              />
            </div>
            <div>
              <label className="text-xs text-[#888] mb-1 block">Dietary tags (comma-separated)</label>
              <input
                value={form.dietary_tags}
                onChange={e => setForm(f => ({ ...f, dietary_tags: e.target.value }))}
                placeholder="vegetarian, gluten-free"
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-sm px-2.5 py-1.5 text-sm text-[#ddd]"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-[#888] mb-1 block">Vs. store-bought (one-line pitch)</label>
            <input
              value={form.vs_store_bought}
              onChange={e => setForm(f => ({ ...f, vs_store_bought: e.target.value }))}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-sm px-2.5 py-1.5 text-sm text-[#ddd]"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-[#bbb]">
            <input
              type="checkbox"
              checked={form.kid_friendly}
              onChange={e => setForm(f => ({ ...f, kid_friendly: e.target.checked }))}
              className="w-4 h-4 accent-[#c8f135]"
            />
            Kid-friendly
          </label>
        </div>
        <div className="px-5 py-3 border-t border-[#1e1e1e] flex justify-end gap-2">
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Btn>
        </div>
      </div>
    </div>
  );
}

// ── Companies ─────────────────────────────────────────────────────────────
function CompaniesSection() {
  const { showToast } = useToast();
  const [confirm, confirmEl] = useConfirm();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ companies: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);  // {id, behavior_score}
  const [adding, setAdding] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: '', behavior_score: 50, controversies: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await admin.companies.list({ search: debouncedSearch, page, limit: 50 }));
    } catch { showToast('Failed to load companies', 'error'); }
    finally { setLoading(false); }
  }, [debouncedSearch, page, showToast]);

  useEffect(() => { setPage(1); }, [debouncedSearch]);
  useEffect(() => { load(); }, [load]);

  const saveScore = async (c) => {
    try {
      await admin.companies.update(c.id, { behavior_score: editing.behavior_score });
      showToast(`Updated ${c.name} score → ${editing.behavior_score}`, 'success');
      setEditing(null);
      load();
    } catch (e) { showToast(e.message || 'Failed', 'error'); }
  };

  const remove = async (c) => {
    const ok = await confirm({
      title: `Delete ${c.name}?`,
      message: `Removes the company and breaks all ${c.product_count} linked products. They'll fall back to the neutral 50/100 score.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await admin.companies.remove(c.id);
      showToast('Company deleted', 'success');
      load();
    } catch (e) { showToast(e.message || 'Failed', 'error'); }
  };

  const createCompany = async () => {
    if (!newCompany.name) { showToast('Name required', 'error'); return; }
    try {
      await admin.companies.create({
        name: newCompany.name,
        behavior_score: newCompany.behavior_score,
        controversies: newCompany.controversies || null,
      });
      showToast(`Created "${newCompany.name}"`, 'success');
      setAdding(false);
      setNewCompany({ name: '', behavior_score: 50, controversies: '' });
      load();
    } catch (e) { showToast(e.message || 'Failed', 'error'); }
  };

  return (
    <>
      <SectionHeader
        title="Companies"
        subtitle={`${data.total} total — click a score to edit inline`}
        actions={
          <div className="flex gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Company name…" />
            <ExportButton resource="companies" />
            <Btn variant="primary" onClick={() => setAdding(a => !a)}>
              <Plus className="w-4 h-4" /> New company
            </Btn>
          </div>
        }
      />
      {confirmEl}

      {adding && (
        <div className="bg-[#0d0d0d] border border-[#c8f135]/30 rounded-sm p-4 mb-4 space-y-3">
          <h3 className="text-sm font-semibold">Add company</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#888] mb-1 block">Name</label>
              <input
                value={newCompany.name}
                onChange={e => setNewCompany(s => ({ ...s, name: e.target.value }))}
                placeholder="e.g. Beyond Meat"
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-sm px-2.5 py-1.5 text-sm text-[#ddd]"
              />
            </div>
            <div>
              <label className="text-xs text-[#888] mb-1 block">Behavior score (0-100)</label>
              <input
                type="number" min="0" max="100"
                value={newCompany.behavior_score}
                onChange={e => setNewCompany(s => ({ ...s, behavior_score: parseInt(e.target.value, 10) || 0 }))}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-sm px-2.5 py-1.5 text-sm text-[#ddd]"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-[#888] mb-1 block">Controversies (optional)</label>
            <textarea
              value={newCompany.controversies}
              onChange={e => setNewCompany(s => ({ ...s, controversies: e.target.value }))}
              placeholder="One-line summary or JSON array of strings"
              rows={2}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-sm px-2.5 py-1.5 text-sm text-[#ddd]"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Btn onClick={() => setAdding(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={createCompany}>Create</Btn>
          </div>
        </div>
      )}

      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th className="w-24">Behavior Score</Th>
            <Th className="w-20">Products</Th>
            <Th className="w-20">Aliases</Th>
            <Th>Controversies</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {loading && data.companies.length === 0
            ? Array.from({ length: 8 }).map((_, i) => <LoadingRow key={i} cols={6} />)
            : data.companies.map(c => {
              const isEditing = editing?.id === c.id;
              const score = isEditing ? editing.behavior_score : c.behavior_score;
              const scoreColor = score >= 70 ? 'text-green-400' : score >= 50 ? 'text-amber-400' : 'text-red-400';
              return (
                <tr key={c.id} className="hover:bg-[#111]">
                  <Td className="font-medium">{c.name}</Td>
                  <Td>
                    {isEditing ? (
                      <div className="flex gap-1 items-center">
                        <input
                          type="number" min="0" max="100"
                          value={editing.behavior_score}
                          onChange={e => setEditing(s => ({ ...s, behavior_score: parseInt(e.target.value, 10) || 0 }))}
                          className="w-14 bg-[#0d0d0d] border border-[#c8f135]/40 rounded-sm px-1.5 py-0.5 text-sm"
                          autoFocus
                        />
                        <Btn variant="primary" onClick={() => saveScore(c)}><Check className="w-3 h-3" /></Btn>
                        <Btn variant="ghost" onClick={() => setEditing(null)}><X className="w-3 h-3" /></Btn>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditing({ id: c.id, behavior_score: c.behavior_score ?? 50 })}
                        className={`font-mono font-bold ${scoreColor} hover:underline`}
                      >
                        {c.behavior_score ?? '—'}
                      </button>
                    )}
                  </Td>
                  <Td className="font-mono text-[#888]">{c.product_count}</Td>
                  <Td className="font-mono text-[#888]">{c.alias_count}</Td>
                  <Td className="text-[#888] text-xs max-w-md truncate">{c.controversies || '—'}</Td>
                  <Td>
                    <Btn variant="danger" onClick={() => remove(c)}><Trash2 className="w-3 h-3" /></Btn>
                  </Td>
                </tr>
              );
            })}
        </tbody>
      </Table>
      <Pagination page={page} total={data.total} limit={50} onPage={setPage} />
    </>
  );
}

// ── Brand Aliases ─────────────────────────────────────────────────────────
function BrandsSection() {
  const { showToast } = useToast();
  const [confirm, confirmEl] = useConfirm();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ aliases: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newAlias, setNewAlias] = useState({ display: '', company_id: '' });
  const [preview, setPreview] = useState(null);
  const [companies, setCompanies] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await admin.brandAliases.list({ search: debouncedSearch, page, limit: 50 }));
    } catch { showToast('Failed to load', 'error'); }
    finally { setLoading(false); }
  }, [debouncedSearch, page, showToast]);

  useEffect(() => { setPage(1); }, [debouncedSearch]);
  useEffect(() => { load(); }, [load]);

  // Load companies list for the add-alias dropdown
  useEffect(() => {
    if (!adding) return;
    admin.companies.list({ limit: 200 }).then(d => setCompanies(d.companies || []));
  }, [adding]);

  // Live preview of matching products as user types
  useEffect(() => {
    if (!newAlias.display) { setPreview(null); return; }
    const t = setTimeout(async () => {
      try { setPreview(await admin.brandAliases.preview(newAlias.display)); } catch {/*ignore*/}
    }, 250);
    return () => clearTimeout(t);
  }, [newAlias.display]);

  const create = async () => {
    if (!newAlias.display || !newAlias.company_id) {
      showToast('Display name + company required', 'error'); return;
    }
    try {
      const r = await admin.brandAliases.create({
        alias_display: newAlias.display,
        company_id: parseInt(newAlias.company_id, 10),
      });
      showToast(`Alias added — ${r.products_matched} products matched`, 'success');
      setAdding(false);
      setNewAlias({ display: '', company_id: '' });
      setPreview(null);
      load();
    } catch (e) { showToast(e.message || 'Failed', 'error'); }
  };

  const remove = async (a) => {
    const ok = await confirm({
      title: 'Delete alias?',
      message: `Remove "${a.alias_display}"? Linked products keep their company assignment.`,
      confirmLabel: 'Delete', danger: true,
    });
    if (!ok) return;
    try {
      await admin.brandAliases.remove(a.alias);
      showToast('Alias deleted', 'success');
      load();
    } catch (e) { showToast(e.message || 'Failed', 'error'); }
  };

  return (
    <>
      <SectionHeader
        title="Brand Aliases"
        subtitle={`${data.total} aliases mapped to companies`}
        actions={
          <div className="flex gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Alias or company…" />
            <ExportButton resource="brand_aliases" />
            <Btn variant="primary" onClick={() => setAdding(a => !a)}>
              <Plus className="w-4 h-4" /> Add alias
            </Btn>
          </div>
        }
      />
      {confirmEl}

      {adding && (
        <div className="bg-[#0d0d0d] border border-[#c8f135]/30 rounded-sm p-4 mb-4 space-y-3">
          <h3 className="text-sm font-semibold">Add brand alias</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#888] mb-1 block">Display name</label>
              <input
                value={newAlias.display}
                onChange={e => setNewAlias(s => ({ ...s, display: e.target.value }))}
                placeholder='e.g. "KitKat" or "Trader Joe&apos;s"'
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-sm px-2.5 py-1.5 text-sm text-[#ddd]"
              />
            </div>
            <div>
              <label className="text-xs text-[#888] mb-1 block">Parent company</label>
              <select
                value={newAlias.company_id}
                onChange={e => setNewAlias(s => ({ ...s, company_id: e.target.value }))}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-sm px-2 py-1.5 text-sm text-[#ddd]"
              >
                <option value="">Select…</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name} (score {c.behavior_score})</option>
                ))}
              </select>
            </div>
          </div>
          {preview && (
            <p className="text-xs text-[#888]">
              Normalized form: <span className="font-mono text-[#c8f135]">{preview.normalized}</span>{' '}
              — would match <span className="text-[#c8f135] font-bold">{preview.count}</span> unmatched products
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Btn onClick={() => { setAdding(false); setPreview(null); }}>Cancel</Btn>
            <Btn variant="primary" onClick={create}>Create alias</Btn>
          </div>
        </div>
      )}

      <Table>
        <thead>
          <tr>
            <Th>Display</Th>
            <Th>Normalized</Th>
            <Th>Company</Th>
            <Th>Score</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {loading && data.aliases.length === 0
            ? Array.from({ length: 8 }).map((_, i) => <LoadingRow key={i} cols={5} />)
            : data.aliases.map(a => (
              <tr key={a.alias} className="hover:bg-[#111]">
                <Td>{a.alias_display}</Td>
                <Td className="font-mono text-[#666] text-xs">{a.alias}</Td>
                <Td>{a.company_name}</Td>
                <Td className="font-mono text-[#888]">{a.behavior_score}</Td>
                <Td>
                  <Btn variant="danger" onClick={() => remove(a)}><Trash2 className="w-3 h-3" /></Btn>
                </Td>
              </tr>
            ))}
        </tbody>
      </Table>
      <Pagination page={page} total={data.total} limit={50} onPage={setPage} />
    </>
  );
}

// ── Feature Flags ─────────────────────────────────────────────────────────
function FlagsSection() {
  const { showToast } = useToast();
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await admin.flags.list();
      setFlags(d.flags || []);
    } catch { showToast('Failed to load flags', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (f) => {
    try {
      await admin.flags.toggle(f.key, !f.enabled);
      showToast(`${f.key} ${!f.enabled ? 'enabled' : 'disabled'}`, 'success');
      load();
    } catch (e) { showToast(e.message || 'Failed', 'error'); }
  };

  return (
    <>
      <SectionHeader
        title="Feature Flags"
        subtitle="Toggle runtime kill-switches without redeploying. Changes propagate within 30 seconds."
        actions={<Btn onClick={load}>Refresh</Btn>}
      />

      <div className="space-y-2">
        {loading && flags.length === 0
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 bg-[#0d0d0d] border border-[#1e1e1e] rounded-sm animate-pulse" />
            ))
          : flags.map(f => (
            <div key={f.key} className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-sm p-4 flex items-center justify-between">
              <div>
                <p className="font-mono text-sm text-[#f4f4f0]">{f.key}</p>
                <p className="text-xs text-[#888] mt-0.5">{f.description}</p>
                {f.updated_at && (
                  <p className="text-[10px] text-[#555] mt-1 font-mono">
                    last updated {new Date(f.updated_at).toLocaleString()}
                  </p>
                )}
              </div>
              <button
                onClick={() => toggle(f)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  f.enabled ? 'bg-[#c8f135]' : 'bg-[#2a2a2a]'
                }`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${
                  f.enabled ? 'left-6' : 'left-0.5'
                }`} />
              </button>
            </div>
          ))}
      </div>
    </>
  );
}

// ── Audit Log ─────────────────────────────────────────────────────────────
function AuditSection() {
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState({ action: '', admin_email: '' });
  const [data, setData] = useState({ actions: [], total: 0, action_summary: [] });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await admin.audit.list({ ...filter, page, limit: 50 }));
    } catch { showToast('Failed to load audit log', 'error'); }
    finally { setLoading(false); }
  }, [filter, page, showToast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [filter]);

  return (
    <>
      <SectionHeader
        title="Audit Log"
        subtitle={`${data.total.toLocaleString()} actions logged`}
        actions={
          <div className="flex gap-2">
            <select value={filter.action}
                    onChange={e => setFilter(f => ({ ...f, action: e.target.value }))}
                    className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-sm px-2 py-1.5 text-sm text-[#ddd]">
              <option value="">All actions</option>
              {data.action_summary?.map(a => (
                <option key={a.action} value={a.action}>{a.action} ({a.n})</option>
              ))}
            </select>
            <SearchInput value={filter.admin_email}
                         onChange={v => setFilter(f => ({ ...f, admin_email: v }))}
                         placeholder="Admin email…" />
            <ExportButton resource="audit" />
          </div>
        }
      />

      <Table>
        <thead>
          <tr>
            <Th>When</Th>
            <Th>Who</Th>
            <Th>Action</Th>
            <Th>Target</Th>
            <Th>Details</Th>
          </tr>
        </thead>
        <tbody>
          {loading && data.actions.length === 0
            ? Array.from({ length: 8 }).map((_, i) => <LoadingRow key={i} cols={5} />)
            : data.actions.length === 0
              ? <tr><td colSpan={5} className="px-3 py-10 text-center text-[#666]">No audit entries yet.</td></tr>
              : data.actions.map(a => (
                <tr key={a.id} className="hover:bg-[#111]">
                  <Td className="text-[#888] text-xs whitespace-nowrap">
                    {new Date(a.created_at).toLocaleString()}
                  </Td>
                  <Td className="text-[#ddd] text-xs">{a.admin_email || '(deleted)'}</Td>
                  <Td>
                    <span className="text-[10px] font-mono bg-[#1a1a1a] text-[#c8f135] px-1.5 py-0.5 rounded">
                      {a.action}
                    </span>
                  </Td>
                  <Td className="text-[#888] text-xs">
                    {a.target_type ? `${a.target_type}/${a.target_id || '*'}` : '—'}
                  </Td>
                  <Td className="font-mono text-[10px] text-[#666] max-w-md truncate">
                    {a.details ? JSON.stringify(a.details) : '—'}
                  </Td>
                </tr>
              ))}
        </tbody>
      </Table>
      <Pagination page={page} total={data.total} limit={50} onPage={setPage} />
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// SECTION REGISTRY
// ══════════════════════════════════════════════════════════════════════════

const SECTION_COMPONENTS = {
  dashboard:     DashboardSection,
  users:         UsersSection,
  subscriptions: SubscriptionsSection,
  contributions: ContributionsSection,
  recipes:       RecipesSection,
  companies:     CompaniesSection,
  brands:        BrandsSection,
  flags:         FlagsSection,
  broadcast:     BroadcastSection,
  audit:         AuditSection,
};

// ══════════════════════════════════════════════════════════════════════════
// BROADCAST — compose email + push announcements
// ══════════════════════════════════════════════════════════════════════════

function BroadcastSection() {
  const { showToast } = useToast();
  const [segments, setSegments] = useState({});
  const [segment, setSegment] = useState('all');
  const [channels, setChannels] = useState({ email: true, push: false });
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  useEffect(() => {
    admin.broadcast.segments().then(r => setSegments(r.segments || {})).catch(() => {});
  }, []);

  const SEGMENT_LABELS = {
    all:      'All users',
    verified: 'Email verified',
    premium:  'Premium (active)',
    trial:    'Active trials',
    free:     'Free users',
  };

  const canSend =
    body.trim() &&
    (channels.email || channels.push) &&
    (!channels.email || subject.trim());

  async function onSend() {
    const channelList = Object.entries(channels).filter(([, v]) => v).map(([k]) => k);
    const targetCount = segments[segment] ?? 0;
    if (!window.confirm(
      `Send to ${targetCount} ${SEGMENT_LABELS[segment]} via ${channelList.join(' + ')}?`
    )) return;

    setSending(true);
    setLastResult(null);
    try {
      const r = await admin.broadcast.send({ subject, body, segment, channels: channelList });
      setLastResult(r);
      showToast(`Sent to ${r.recipients} recipients`, 'success');
      setSubject('');
      setBody('');
    } catch (e) {
      showToast(e.message || 'Broadcast failed', 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <SectionHeader title="Broadcast" subtitle="Send a message to a user segment over email and/or push." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-5">
          <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-sm p-4">
            <p className="text-xs uppercase tracking-wider text-[#666] font-mono">Audience</p>
            <div className="grid grid-cols-1 gap-2 mt-2">
              {Object.keys(SEGMENT_LABELS).map(k => (
                <label key={k}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition ${
                    segment === k
                      ? 'border-[#c8f135] bg-[#c8f135]/10'
                      : 'border-[#2a2a2a] hover:border-[#3a3a3a]'
                  }`}>
                  <span className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={segment === k}
                      onChange={() => setSegment(k)}
                      className="accent-[#c8f135]"
                    />
                    {SEGMENT_LABELS[k]}
                  </span>
                  <span className="text-xs text-[#888] font-mono">
                    {segments[k] != null ? `${segments[k].toLocaleString()} users` : '…'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-sm p-4">
            <p className="text-xs uppercase tracking-wider text-[#666] font-mono">Channels</p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition ${
                channels.email ? 'border-[#c8f135] bg-[#c8f135]/10' : 'border-[#2a2a2a]'
              }`}>
                <input type="checkbox" checked={channels.email}
                  onChange={e => setChannels(c => ({ ...c, email: e.target.checked }))}
                  className="accent-[#c8f135]" />
                <Mail className="w-4 h-4" /> <span className="text-sm">Email</span>
              </label>
              <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition ${
                channels.push ? 'border-[#c8f135] bg-[#c8f135]/10' : 'border-[#2a2a2a]'
              }`}>
                <input type="checkbox" checked={channels.push}
                  onChange={e => setChannels(c => ({ ...c, push: e.target.checked }))}
                  className="accent-[#c8f135]" />
                <Bell className="w-4 h-4" /> <span className="text-sm">Push</span>
              </label>
            </div>
          </div>
        </div>

        <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-sm p-4">
          <p className="text-xs uppercase tracking-wider text-[#666] font-mono">
            Subject {channels.email && <span className="text-[#c8f135]">*</span>}
          </p>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="What's the message about?"
            maxLength={140}
            className="w-full mt-2 px-3 py-2 bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg text-sm focus:border-[#c8f135] outline-none"
          />
          <div className="text-xs text-[#666] mt-1 font-mono">{subject.length}/140</div>

          <p className="text-xs uppercase tracking-wider text-[#666] font-mono mt-4">Body</p>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Plain text. Newlines are preserved."
            rows={10}
            maxLength={4000}
            className="w-full mt-2 px-3 py-2 bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg text-sm focus:border-[#c8f135] outline-none resize-none font-mono"
          />
          <div className="text-xs text-[#666] mt-1 font-mono">{body.length}/4000</div>

          <button
            onClick={onSend}
            disabled={!canSend || sending}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#c8f135] text-[#0a0a0a] font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#d4ff48]"
          >
            <Send className="w-4 h-4" />
            {sending ? 'Sending…' : `Send to ${segments[segment]?.toLocaleString() ?? '…'} users`}
          </button>

          {lastResult && (
            <div className="mt-4 p-3 bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg text-xs font-mono text-[#bbb] space-y-1">
              <div>Recipients: {lastResult.recipients}</div>
              {lastResult.email && (
                <div>Email — sent: {lastResult.email.sent}, failed: {lastResult.email.failed}</div>
              )}
              {lastResult.push && (
                <div>
                  Push — sent: {lastResult.push.sent}, expired: {lastResult.push.expired},
                  no-sub: {lastResult.push.no_sub}, failed: {lastResult.push.failed}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
