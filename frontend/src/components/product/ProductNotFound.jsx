// Product-not-found screen with the contribute form so users can help fill
// the database.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Send } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../contexts/ToastContext';

export default function ProductNotFound({ upc }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [contributeName, setContributeName] = useState('');
  const [contributeBrand, setContributeBrand] = useState('');
  const [contributing, setContributing] = useState(false);

  return (
    <div className="min-h-screen pb-24" style={{ background: '#0a0a0a' }}>
      <div style={{ background: '#0d0d0d', borderBottom: '1px solid var(--border)' }}>
        <div className="px-4 py-4 flex items-center pt-safe">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full active:scale-90 transition-transform" aria-label="Go back">
            <ArrowLeft className="w-6 h-6 text-[#888]" />
          </button>
        </div>
      </div>
      <div className="px-6 pt-12 max-w-md mx-auto text-center">
        <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-6">
          <Search className="w-10 h-10 text-amber-400" />
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', letterSpacing: '1px', color: '#f4f4f0' }}>
          PRODUCT NOT FOUND
        </h1>
        <p className="text-[#888] mt-2 mb-6">
          UPC <span className="font-mono text-xs bg-[#1e1e1e] px-2 py-1 rounded text-[#bbb]">{upc}</span> isn't in our database yet.
        </p>

        {/* Contribute form */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-sm p-5 text-left">
          <div className="flex items-center gap-2 mb-3">
            <Send className="w-5 h-5 text-amber-400" />
            <h3 className="font-semibold text-[#f4f4f0]">Help us add it</h3>
          </div>
          <div className="space-y-2">
            <input
              type="text" value={contributeName}
              onChange={(e) => setContributeName(e.target.value)}
              placeholder="Product name (e.g. Cheerios)"
              className="w-full px-3 py-2.5 rounded-sm border border-[#333] bg-[#0d0d0d] text-sm text-[#f4f4f0] placeholder-[#555]"
            />
            <input
              type="text" value={contributeBrand}
              onChange={(e) => setContributeBrand(e.target.value)}
              placeholder="Brand (e.g. General Mills)"
              className="w-full px-3 py-2.5 rounded-sm border border-[#333] bg-[#0d0d0d] text-sm text-[#f4f4f0] placeholder-[#555]"
            />
            <button
              onClick={async () => {
                setContributing(true);
                try {
                  await api.post('/products/contribute', { upc, name: contributeName, brand: contributeBrand });
                  toast.success('Thanks! We\'ll add this product soon.');
                  setContributeName('');
                  setContributeBrand('');
                } catch (e) {
                  toast.error('Failed to submit');
                }
                setContributing(false);
              }}
              disabled={contributing || !contributeName.trim()}
              className="w-full py-2.5 bg-amber-500 text-white rounded-sm text-sm font-medium disabled:opacity-50"
            >
              {contributing ? 'Submitting...' : 'Submit Product'}
            </button>
          </div>
        </div>

        <button
          onClick={() => navigate('/scan')}
          className="mt-6 px-6 py-3 bg-[#1e1e1e] text-[#bbb] rounded-sm font-medium text-sm"
        >
          Back to Scanner
        </button>
      </div>
    </div>
  );
}
