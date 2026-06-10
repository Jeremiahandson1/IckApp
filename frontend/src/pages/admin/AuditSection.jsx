// Audit Log — every gated admin mutation, filterable by action and admin.

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { admin } from '../../utils/api';
import {
  SectionHeader, SearchInput, Pagination, Table, Th, Td, LoadingRow, ExportButton,
} from './shared';

export default function AuditSection() {
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
