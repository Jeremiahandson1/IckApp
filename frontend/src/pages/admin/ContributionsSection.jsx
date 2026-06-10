// Contributions — review queue for user-submitted products.
// Approving inserts into the products catalog and re-scores.

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { admin } from '../../utils/api';
import { Check, X } from 'lucide-react';
import { SectionHeader, EmptyState, Btn, useConfirm } from './shared';

export default function ContributionsSection() {
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
