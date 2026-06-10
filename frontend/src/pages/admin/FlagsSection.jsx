// Feature Flags — runtime kill-switches, toggled without redeploying.

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { admin } from '../../utils/api';
import { SectionHeader, Btn } from './shared';

export default function FlagsSection() {
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
