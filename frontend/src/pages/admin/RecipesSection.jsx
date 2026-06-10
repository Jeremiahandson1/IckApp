// Recipes — searchable/filterable list with inline edit modal and delete.

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { admin } from '../../utils/api';
import { Check, X, Edit2, Trash2 } from 'lucide-react';
import {
  SectionHeader, SearchInput, Pagination, Table, Th, Td, Btn, LoadingRow,
  useConfirm, ExportButton, useDebounced,
} from './shared';

export default function RecipesSection() {
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
