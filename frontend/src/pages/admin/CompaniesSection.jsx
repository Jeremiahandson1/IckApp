// Companies — behavior scores (click to edit inline), add/delete companies.

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { admin } from '../../utils/api';
import { Plus, Check, X, Trash2 } from 'lucide-react';
import {
  SectionHeader, SearchInput, Pagination, Table, Th, Td, Btn, LoadingRow,
  useConfirm, ExportButton, useDebounced,
} from './shared';

export default function CompaniesSection() {
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
