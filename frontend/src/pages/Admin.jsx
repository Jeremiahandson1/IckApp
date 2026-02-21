import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import api from '../utils/api';

// ── Tab constants ─────────────────────────────────────────────────────────────
const TABS = ['Dashboard', 'Users', 'Contributions', 'Products'];

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [tab, setTab] = useState('Dashboard');

  // Redirect non-admins
  useEffect(() => {
    if (user && !user.is_admin) navigate('/', { replace: true });
  }, [user]);

  if (!user?.is_admin) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-20">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4">
        <h1 className="text-xl font-bold">Admin</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800 bg-gray-900 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4">
        {tab === 'Dashboard'    && <DashboardTab showToast={showToast} />}
        {tab === 'Users'        && <UsersTab showToast={showToast} />}
        {tab === 'Contributions'&& <ContributionsTab showToast={showToast} />}
        {tab === 'Products'     && <ProductsTab showToast={showToast} />}
      </div>
    </div>
  );
}

// ── Dashboard tab ─────────────────────────────────────────────────────────────
function DashboardTab({ showToast }) {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/health')
      .then(setHealth)
      .catch(() => showToast('Failed to load health data', 'error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!health)  return <p className="text-gray-400">No data.</p>;

  const cards = [
    { label: 'Total Users',       value: health.users?.total,          sub: `+${health.users?.new_7d} this week` },
    { label: 'Total Products',    value: health.products?.total,       sub: `${health.products?.scored} scored` },
    { label: 'Scans (24h)',       value: health.scans?.last_24h,       sub: `${health.scans?.total} all time` },
    { label: 'Active Pantry Items', value: health.pantry?.active,      sub: `${health.pantry?.total} total` },
    { label: 'Recipes',           value: health.recipes?.total,        sub: null },
    { label: 'Sightings',         value: health.sightings?.total,      sub: `${health.sightings?.recent} recent` },
    { label: 'Flyer Items',       value: health.flyer_availability?.total, sub: `${health.flyer_availability?.active} active` },
    { label: 'Curated Items',     value: health.curated_availability?.total, sub: null },
  ];

  const pending = health.contributions?.pending || 0;

  return (
    <div className="space-y-6">
      {pending > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 text-orange-300 text-sm">
          ⚠️ {pending} product contribution{pending !== 1 ? 's' : ''} pending review
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {cards.map(c => (
          <div key={c.label} className="bg-gray-900 rounded-xl p-4">
            <p className="text-2xl font-bold">{c.value ?? '—'}</p>
            <p className="text-sm text-gray-400 mt-1">{c.label}</p>
            {c.sub && <p className="text-xs text-gray-500 mt-0.5">{c.sub}</p>}
          </div>
        ))}
      </div>

      {health.subscriptions?.length > 0 && (
        <div className="bg-gray-900 rounded-xl p-4">
          <h3 className="font-semibold mb-3">Subscriptions</h3>
          <div className="space-y-2">
            {health.subscriptions.map((s, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-400 capitalize">{s.plan} / {s.status}</span>
                <span className="font-medium">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Users tab ─────────────────────────────────────────────────────────────────
function UsersTab({ showToast }) {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionUser, setActionUser] = useState(null); // user being actioned

  const limit = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit });
      if (search) params.set('search', search);
      const res = await api.get(`/admin/users?${params}`);
      setUsers(res.users);
      setTotal(res.total);
    } catch {
      showToast('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const toggleAdmin = async (u) => {
    try {
      await api.put(`/admin/users/${u.id}/admin`, { is_admin: !u.is_admin });
      showToast(`${u.email} ${!u.is_admin ? 'promoted to' : 'removed from'} admin`, 'success');
      load();
    } catch (err) {
      showToast(err.message || 'Failed', 'error');
    }
  };

  const grantTrial = async (u, days) => {
    try {
      await api.post(`/admin/users/${u.id}/grant-trial`, { days });
      showToast(`Granted ${days}-day trial to ${u.email}`, 'success');
      setActionUser(null);
      load();
    } catch (err) {
      showToast(err.message || 'Failed', 'error');
    }
  };

  const pages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search by email or name..."
          className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium"
        >
          Search
        </button>
      </form>

      <p className="text-sm text-gray-400">{total} users{search ? ` matching "${search}"` : ''}</p>

      {loading ? <Spinner /> : (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="bg-gray-900 rounded-xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{u.name || '(no name)'}</p>
                  <p className="text-sm text-gray-400 truncate">{u.email}</p>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {u.is_admin && <Badge color="orange">Admin</Badge>}
                    {u.sub_status === 'active' && <Badge color="green">{u.plan}</Badge>}
                    <Badge color="gray">{u.pantry_count} pantry</Badge>
                    <Badge color="gray">{u.total_products_scanned ?? 0} scans</Badge>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setActionUser(u)}
                    className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-xs font-medium"
                  >
                    Actions
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex gap-2 justify-center">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 bg-gray-800 rounded-lg text-sm disabled:opacity-40">← Prev</button>
          <span className="px-3 py-1.5 text-sm text-gray-400">{page} / {pages}</span>
          <button disabled={page === pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 bg-gray-800 rounded-lg text-sm disabled:opacity-40">Next →</button>
        </div>
      )}

      {/* Action modal */}
      {actionUser && (
        <Modal onClose={() => setActionUser(null)} title={actionUser.email}>
          <div className="space-y-3">
            <button
              onClick={() => { toggleAdmin(actionUser); setActionUser(null); }}
              className="w-full py-3 bg-gray-800 rounded-xl text-sm font-medium text-left px-4"
            >
              {actionUser.is_admin ? '🔴 Remove Admin' : '🟢 Make Admin'}
            </button>
            <div className="text-xs text-gray-500 px-1">Grant free trial</div>
            {[7, 14, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => grantTrial(actionUser, d)}
                className="w-full py-3 bg-gray-800 rounded-xl text-sm font-medium text-left px-4"
              >
                🎁 Grant {d}-day trial
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Contributions tab ─────────────────────────────────────────────────────────
function ContributionsTab({ showToast }) {
  const [contribs, setContribs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/products/admin/contributions?status=${filter}`);
      setContribs(res.contributions || []);
    } catch {
      showToast('Failed to load contributions', 'error');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const approve = async (id) => {
    try {
      await api.put(`/products/admin/contributions/${id}/approve`);
      showToast('Contribution approved and product added', 'success');
      setContribs(c => c.filter(x => x.id !== id));
    } catch (err) {
      showToast(err.message || 'Failed to approve', 'error');
    }
  };

  const reject = async (id, reason) => {
    try {
      await api.put(`/products/admin/contributions/${id}/reject`, { reason });
      showToast('Contribution rejected', 'success');
      setContribs(c => c.filter(x => x.id !== id));
    } catch (err) {
      showToast(err.message || 'Failed to reject', 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex gap-2">
        {['pending', 'approved', 'rejected'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-colors ${
              filter === f ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : contribs.length === 0 ? (
        <p className="text-gray-400 text-sm py-8 text-center">No {filter} contributions.</p>
      ) : (
        <div className="space-y-4">
          {contribs.map(c => (
            <div key={c.id} className="bg-gray-900 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-sm text-gray-400">{c.brand} · UPC: {c.upc}</p>
                </div>
                <Badge color={c.status === 'pending' ? 'orange' : c.status === 'approved' ? 'green' : 'red'}>
                  {c.status}
                </Badge>
              </div>
              {c.ingredients_text && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Ingredients</p>
                  <p className="text-sm text-gray-300 line-clamp-3">{c.ingredients_text}</p>
                </div>
              )}
              {c.image_url && (
                <img src={c.image_url} alt={c.name} className="w-16 h-16 object-cover rounded-lg" />
              )}
              <p className="text-xs text-gray-500">
                Submitted by {c.submitter_email || 'anonymous'} · {new Date(c.created_at).toLocaleDateString()}
              </p>
              {c.status === 'pending' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => approve(c.id)}
                    className="flex-1 py-2 bg-green-600 text-white rounded-xl text-sm font-medium"
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => reject(c.id, 'Rejected by admin')}
                    className="flex-1 py-2 bg-red-700 text-white rounded-xl text-sm font-medium"
                  >
                    ✕ Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Products tab ──────────────────────────────────────────────────────────────
function ProductsTab({ showToast }) {
  const [gaps, setGaps] = useState(null);
  const [loading, setLoading] = useState(true);
  const [flagging, setFlagging] = useState(false);
  const [minScore, setMinScore] = useState(75);
  const [flagResult, setFlagResult] = useState(null);

  useEffect(() => {
    api.get('/admin/products/gaps')
      .then(setGaps)
      .catch(() => showToast('Failed to load product gaps', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const autoFlag = async () => {
    setFlagging(true);
    try {
      const res = await api.post('/admin/products/auto-flag-clean', { min_score: minScore });
      setFlagResult(res);
      showToast(`Flagged ${res.flagged} products as clean alternatives`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed', 'error');
    } finally {
      setFlagging(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      {/* Data gaps */}
      {gaps && (
        <div className="bg-gray-900 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold">Data Gaps</h3>
          <div className="grid grid-cols-3 gap-3">
            <GapStat label="Missing Score" value={gaps.no_score} color="red" />
            <GapStat label="Missing Image" value={gaps.no_image} color="yellow" />
            <GapStat label="Missing Ingredients" value={gaps.no_ingredients} color="orange" />
          </div>

          {gaps.samples?.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Recent products with gaps</p>
              <div className="space-y-2">
                {gaps.samples.map(p => (
                  <div key={p.upc} className="flex justify-between items-center text-sm">
                    <div className="min-w-0">
                      <p className="truncate">{p.name || '(unnamed)'}</p>
                      <p className="text-xs text-gray-500">{p.upc}</p>
                    </div>
                    <div className="flex gap-2 shrink-0 ml-2">
                      {p.total_score == null && <Badge color="red">no score</Badge>}
                      {!p.image_url && <Badge color="yellow">no image</Badge>}
                      {p.missing_ingredients && <Badge color="orange">no ingr.</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Auto-flag clean alternatives */}
      <div className="bg-gray-900 rounded-xl p-4 space-y-4">
        <h3 className="font-semibold">Auto-Flag Clean Alternatives</h3>
        <p className="text-sm text-gray-400">
          Mark all products above a score threshold as clean alternatives, making them available as swap suggestions.
        </p>
        <div className="flex gap-3 items-center">
          <label className="text-sm text-gray-300">Min score</label>
          <input
            type="number"
            value={minScore}
            onChange={e => setMinScore(parseInt(e.target.value))}
            min={0}
            max={100}
            className="w-20 px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            onClick={autoFlag}
            disabled={flagging}
            className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium disabled:opacity-50"
          >
            {flagging ? 'Running...' : 'Run'}
          </button>
        </div>

        {flagResult && (
          <div className="bg-green-900/30 border border-green-800 rounded-xl p-3 text-sm text-green-300">
            ✓ Flagged {flagResult.flagged} products
            {flagResult.products?.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-green-400 max-h-40 overflow-auto">
                {flagResult.products.map(p => (
                  <li key={p.upc}>{p.name} — score {p.total_score}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared components ─────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
    </div>
  );
}

function Badge({ color, children }) {
  const colors = {
    orange: 'bg-orange-500/20 text-orange-300',
    green:  'bg-green-500/20 text-green-300',
    red:    'bg-red-500/20 text-red-300',
    yellow: 'bg-yellow-500/20 text-yellow-300',
    gray:   'bg-gray-700 text-gray-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[color] || colors.gray}`}>
      {children}
    </span>
  );
}

function GapStat({ label, value, color }) {
  const colors = { red: 'text-red-400', yellow: 'text-yellow-400', orange: 'text-orange-400' };
  return (
    <div className="bg-gray-800 rounded-xl p-3 text-center">
      <p className={`text-2xl font-bold ${colors[color]}`}>{value ?? '—'}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function Modal({ onClose, title, children }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50 p-4">
      <div className="bg-gray-950 rounded-2xl p-6 w-full max-w-sm space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold truncate">{title}</h3>
          <button onClick={onClose} className="text-gray-400 text-lg leading-none">✕</button>
        </div>
        {children}
        <button onClick={onClose} className="w-full py-3 bg-gray-800 text-gray-400 rounded-xl text-sm">Cancel</button>
      </div>
    </div>
  );
}
