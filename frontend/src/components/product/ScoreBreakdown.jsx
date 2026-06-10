// "Why this score?" — the collapsible 5-dimension breakdown. Weights shown
// here must match the backend scoring model: harmful 40%, banned 20%,
// transparency 15%, processing 15%, company 10%.

import { useState } from 'react';
import {
  Info, ChevronDown, ChevronUp, ShieldAlert, AlertTriangle, Beaker,
  ShoppingCart, Check,
} from 'lucide-react';
import { ScoreBar } from '../common/ScoreBadge';
import { getScoreExplanation } from '../../utils/helpers';

export default function ScoreBreakdown({ product, expanded, onToggle }) {
  const explanation = getScoreExplanation(product);
  return (
    <div className="px-4 mt-6">
      <div className="card overflow-hidden">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between p-4"
        >
          <div className="flex items-center gap-3">
            <Info className="w-5 h-5 text-[#c8f135]" />
            <div className="text-left">
              <span className="font-semibold text-[#f4f4f0]">Why this score?</span>
              {explanation.summary && (
                <p className="text-xs text-[#888] mt-0.5 line-clamp-1">{explanation.summary}</p>
              )}
            </div>
          </div>
          {expanded ? <ChevronUp className="w-5 h-5 text-[#888]" /> : <ChevronDown className="w-5 h-5 text-[#888]" />}
        </button>

        {expanded && (
          <div className="px-4 pb-4 border-t border-[#2a2a2a] pt-4">
            <div className="space-y-1">
              <ScoreItem
                icon={ShieldAlert}
                label="Harmful Ingredients"
                score={product.harmful_ingredients_score ?? 50}
                weight="40%"
                detail={explanation.harmful_detail}
                items={explanation.harmful_items}
                type="harmful"
              />
              <ScoreItem
                icon={AlertTriangle}
                label="Banned Elsewhere"
                score={product.banned_elsewhere_score ?? 50}
                weight="20%"
                detail={explanation.banned_detail}
                items={explanation.banned_items}
                type="banned"
              />
              <ScoreItem
                icon={Info}
                label="Transparency"
                score={product.transparency_score ?? 50}
                weight="15%"
                detail={explanation.transparency_detail}
                items={explanation.transparency_items}
                type="transparency"
              />
              <ScoreItem
                icon={Beaker}
                label="Processing Level"
                score={product.processing_score ?? 50}
                weight="15%"
                detail={explanation.processing_detail}
                items={explanation.processing_items}
                type="processing"
              />
              <ScoreItem
                icon={ShoppingCart}
                label="Company Behavior"
                score={product.company_behavior_score ?? 50}
                weight="10%"
                detail={explanation.company_detail}
                items={explanation.company_items}
                type="company"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreItem({ icon: Icon, label, score, weight, detail, items = [], type }) {
  const [open, setOpen] = useState(false);
  const hasDetail = (items && items.length > 0) || detail;
  const detailColor = score >= 70 ? '#5a9a4a' : score >= 40 ? '#b08a5e' : '#c45a4a';

  return (
    <div className="py-3 border-b border-[#1e1e1e] last:border-0">
      <button
        onClick={() => hasDetail && setOpen(!open)}
        className="w-full flex items-start gap-3 text-left"
      >
        <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: detailColor }} />
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-sm text-[#ccc]">{label}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium" style={{ color: detailColor }}>{Math.round(score)}/100</span>
              <span className="text-[10px] text-[#555]">{weight}</span>
            </div>
          </div>
          <ScoreBar score={score} />
          {detail && (
            <p className="text-xs mt-1.5" style={{ color: '#999', fontWeight: 300, lineHeight: 1.4 }}>
              {detail}
            </p>
          )}
        </div>
        {hasDetail && items.length > 0 && (
          <ChevronDown className={`w-4 h-4 text-[#555] flex-shrink-0 mt-0.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      {open && items.length > 0 && (
        <div className="mt-2 ml-7 space-y-1.5">
          {type === 'harmful' && items.map((item, i) => (
            <div key={i} className="p-2 rounded-sm" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#ddd]">{item.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-sm" style={{
                  background: item.severity >= 8 ? 'rgba(239,68,68,0.15)' : item.severity >= 5 ? 'rgba(245,158,11,0.15)' : 'rgba(107,114,128,0.15)',
                  color: item.severity >= 8 ? '#f87171' : item.severity >= 5 ? '#fbbf24' : '#9ca3af',
                  fontFamily: 'var(--font-mono)', letterSpacing: '1px'
                }}>
                  {item.severity}/10
                </span>
              </div>
              {item.effect && <p className="text-[11px] text-[#888] mt-1" style={{ lineHeight: 1.4 }}>{item.effect}</p>}
              {item.why && <p className="text-[11px] text-[#666] mt-0.5 italic">Used as: {item.why}</p>}
            </div>
          ))}

          {type === 'banned' && items.map((item, i) => (
            <div key={i} className="p-2 rounded-sm" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
              <span className="text-xs font-medium text-[#ddd]">{item.name}</span>
              <p className="text-[11px] text-[#e88] mt-0.5">
                Banned in: {item.countries.join(', ')}
              </p>
            </div>
          ))}

          {type === 'transparency' && items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 py-0.5">
              {item.present ? (
                <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
              ) : (
                <span className="w-3.5 h-3.5 flex items-center justify-center text-[#555] flex-shrink-0">✕</span>
              )}
              <span className={`text-xs ${item.present ? 'text-[#aaa]' : 'text-[#666]'}`}>
                {item.label}{item.partial ? ' (partial)' : ''}
              </span>
            </div>
          ))}

          {type === 'processing' && items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
              <span className="text-xs text-[#aaa]">{item}</span>
            </div>
          ))}

          {type === 'company' && items.map((item, i) => (
            <div key={i} className="flex items-start gap-2 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0 mt-1.5" />
              <span className="text-xs text-[#aaa]" style={{ lineHeight: 1.4 }}>{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
