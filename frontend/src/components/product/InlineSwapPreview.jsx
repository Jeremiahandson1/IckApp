// Inline best-swap preview shown right under the score for low-scoring
// products — surfaces the top alternative without making the user scroll.

import { ArrowRightLeft } from 'lucide-react';

export default function InlineSwapPreview({ swapOptions, currentScore, onSwapClick }) {
  const best = swapOptions[0];
  const improvement = Math.round((best.total_score || 0) - (currentScore || 0));

  return (
    <div className="px-4 mt-3">
      <div className="bg-[#0d0d0d] rounded-sm p-4 shadow-sm border border-orange-100">
        <div className="flex items-center gap-2 mb-3">
          <ArrowRightLeft className="w-4 h-4 text-[#c8f135]" />
          <span className="text-sm font-semibold text-[#ccc]">Better Alternative</span>
        </div>
        <button
          onClick={() => onSwapClick(best)}
          className="w-full flex items-center gap-3 text-left active:bg-[#0a0a0a] rounded-sm transition-colors"
        >
          {best.image_url ? (
            <img src={best.image_url} alt="" className="w-12 h-12 rounded-sm object-cover bg-[#1e1e1e]"
              onError={(e) => { e.target.style.display = 'none'; }} />
          ) : (
            <div className="w-12 h-12 rounded-sm bg-[rgba(200,241,53,0.06)] flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5 text-[#c8f135]" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-[#f4f4f0] truncate">{best.name}</p>
            <p className="text-xs text-[#666]">{best.brand}</p>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-[#c8f135]">
              +{improvement}
            </div>
            <div className="text-[10px] text-[#c8f135] font-medium">points</div>
          </div>
        </button>
        {swapOptions.length > 1 && (
          <button
            onClick={() => document.getElementById('swaps-section')?.scrollIntoView({ behavior: 'smooth' })}
            className="mt-3 w-full text-center text-xs text-[#c8f135] font-medium"
          >
            +{swapOptions.length - 1} more alternatives ↓
          </button>
        )}
      </div>
    </div>
  );
}
