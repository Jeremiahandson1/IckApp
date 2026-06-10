// Brand Aliases — map brand spellings to parent companies, with live
// match-count preview while typing a new alias.

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { admin } from '../../utils/api';
import { Plus, Trash2 } from 'lucide-react';
import {
  SectionHeader, SearchInput, Pagination, Table, Th, Td, Btn, LoadingRow,
  useConfirm, ExportButton, useDebounced,
} from './shared';

export default function BrandsSection() {
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
