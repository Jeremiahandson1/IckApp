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
  Search, Trash2, Edit2, Plus, X, AlertCircle, Check,
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

  useEffect(() => {
    if (user && !user.is_admin) navigate('/', { replace: true });
  }, [user, navigate]);

  if (!user?.is_admin) return null;

  const setSection = (key) => setParams({ section: key });
  const ActiveSection = SECTION_COMPONENTS[section] || DashboardSection;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f4f4f0] flex">
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
        <div className="px-4 mt-6 pt-4 border-t border-[#1e1e1e]">
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
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await admin.health());
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        actions={<SearchInput value={search} onChange={setSearch} placeholder="Email or name…" />}
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
                  <div className="flex items-center gap-2">
                    {u.email}
                    {u.is_admin && <span className="text-[9px] font-mono bg-[#c8f135]/15 text-[#c8f135] px-1.5 py-0.5 rounded">ADMIN</span>}
                  </div>
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
    </>
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

// ── Contributions (placeholder; existing review endpoints work) ───────────
function ContributionsSection() {
  return (
    <>
      <SectionHeader title="Contributions" subtitle="User-submitted product fixes" />
      <EmptyState message="Contribution review UI is in the legacy admin tab — wire it here once moderation flow is finalized." />
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
                    <Btn variant="danger" onClick={() => remove(r)}><Trash2 className="w-3 h-3" /></Btn>
                  </div>
                </Td>
              </tr>
            ))}
        </tbody>
      </Table>
      <Pagination page={page} total={data.total} limit={50} onPage={setPage} />
    </>
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

  return (
    <>
      <SectionHeader
        title="Companies"
        subtitle={`${data.total} total — click a score to edit inline`}
        actions={<SearchInput value={search} onChange={setSearch} placeholder="Company name…" />}
      />
      {confirmEl}

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
  audit:         AuditSection,
};
