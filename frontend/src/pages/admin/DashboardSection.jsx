// Dashboard — system health snapshot, external service status, activity feed.

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { admin } from '../../utils/api';
import { AlertCircle } from 'lucide-react';
import { SectionHeader, StatCard, EmptyState, Btn } from './shared';

export default function DashboardSection() {
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
