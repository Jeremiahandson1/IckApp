// Subscriptions — filterable list with per-plan/status summary and +30d extend.

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { admin } from '../../utils/api';
import { SectionHeader, Pagination, Table, Th, Td, Btn, LoadingRow, ExportButton } from './shared';

export default function SubscriptionsSection() {
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
