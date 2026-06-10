// Users — searchable list with admin/trial/comp/delete actions, plus the
// detail drawer (stats, subscription, per-user audit, impersonation).

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { admin } from '../../utils/api';
import { getStoredToken, setStoredToken } from '../../utils/tokenStorage';
import { Trash2, X, LogIn } from 'lucide-react';
import {
  SectionHeader, SearchInput, Pagination, Table, Th, Td, Btn, LoadingRow,
  useConfirm, ExportButton, useDebounced,
} from './shared';

export default function UsersSection() {
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
                    // Park the admin token in sessionStorage so it can't
                    // outlive the session on disk; ImpersonationBanner
                    // restores it on exit.
                    const adminToken = getStoredToken('token');
                    if (adminToken) sessionStorage.setItem('admin_return_token', adminToken);
                    setStoredToken('token', r.token);
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
