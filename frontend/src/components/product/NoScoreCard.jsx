// Shown in place of the ScoreRing when a product can't be scored.
//
// The point of this card: a missing ingredient list is NOT a bad product. The
// old behaviour computed a low number anyway (harmful 30 / banned 35 → ~35
// total → "ICK"), so absence of data looked like evidence of harm. Now the
// backend returns null for dimensions it can't assess, total_score is null,
// and we say plainly that we don't know — in neutral grey, with no number.

import { useState } from 'react';
import { HelpCircle, Send, Check, X } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../contexts/ToastContext';
import { getUnknownDimensions, DIMENSION_LABELS } from '../../utils/helpers';

const GREY = '#8a8a8a';

export default function NoScoreCard({ product }) {
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [ingredients, setIngredients] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const unknown = getUnknownDimensions(product);
  const shortName = product.name?.split(' ').slice(0, 3).join(' ') || 'This product';

  // What we do and don't have, so "not enough info" is specific rather than vague.
  const signals = [
    { label: 'Ingredient list', present: !!(product.ingredients && product.ingredients.trim().length >= 3) },
    { label: 'Nutrition data', present: !!product.nutrition_facts && Object.keys(
        typeof product.nutrition_facts === 'string'
          ? (() => { try { return JSON.parse(product.nutrition_facts); } catch { return {}; } })()
          : product.nutrition_facts
      ).length > 0 },
    { label: 'Processing level (NOVA)', present: !!product.nova_group },
    { label: 'Nutri-Score grade', present: !!product.nutriscore_grade },
    { label: 'Brand identified', present: !!(product.brand && product.brand !== 'Unknown Brand' && product.brand !== 'Unknown') },
  ];

  const submitIngredients = async () => {
    setSubmitting(true);
    try {
      await api.post('/products/contribute', {
        upc: product.upc,
        name: product.name,
        brand: product.brand,
        ingredients_text: ingredients.trim(),
      });
      setSubmitted(true);
      setShowForm(false);
      toast.success('Thanks! We\'ll review and score it.');
    } catch {
      toast.error('Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="flex flex-col items-center py-6 px-4"
      style={{ background: 'rgba(138,138,138,0.06)', border: `1px solid rgba(138,138,138,0.2)` }}
    >
      {/* Dashed ring with a question mark — deliberately not a number, and
          deliberately not on the red→green scale. */}
      <div className="relative" style={{ width: 140, height: 140 }}>
        <svg width={140} height={140}>
          <circle
            cx={70} cy={70} r={62}
            fill="none" strokeWidth={8}
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="6 10"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <HelpCircle className="w-12 h-12" style={{ color: GREY }} strokeWidth={1.5} />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '2px',
            color: 'var(--muted)',
            marginTop: '6px',
          }}>NO SCORE</span>
        </div>
      </div>

      <div
        className="mt-3 px-4 py-1 text-center"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '20px',
          letterSpacing: '3px',
          color: GREY,
          textTransform: 'uppercase',
        }}
      >
        Not Enough Info
      </div>

      <p style={{
        marginTop: '6px',
        fontSize: '13px',
        color: 'var(--muted)',
        textAlign: 'center',
        maxWidth: '280px',
        fontWeight: 300,
        lineHeight: 1.5,
      }}>
        No one has published an ingredient list for {shortName}, so we won't pretend
        to judge it. <strong style={{ color: '#bbb', fontWeight: 500 }}>This isn't a bad
        score — it's no score.</strong>
      </p>

      {/* What we have vs. what's missing */}
      <div className="w-full max-w-[280px] mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <p style={{
          fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '2px',
          color: '#666', textTransform: 'uppercase', marginBottom: '8px',
        }}>
          What we could find
        </p>
        {signals.map((s, i) => (
          <div key={i} className="flex items-center gap-2 py-0.5">
            {s.present
              ? <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
              : <X className="w-3.5 h-3.5 text-[#555] flex-shrink-0" />}
            <span className={`text-xs ${s.present ? 'text-[#aaa]' : 'text-[#666]'}`}>{s.label}</span>
          </div>
        ))}
        {unknown.length > 0 && (
          <p className="text-[11px] text-[#666] mt-2" style={{ lineHeight: 1.4 }}>
            Unscored dimensions: {unknown.map(k => DIMENSION_LABELS[k]).join(', ')}.
          </p>
        )}
      </div>

      {/* Turn the dead end into data */}
      {submitted ? (
        <p className="text-xs text-[#c8f135] mt-4">Submitted — thanks for helping.</p>
      ) : showForm ? (
        <div className="w-full max-w-[280px] mt-4">
          <textarea
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            placeholder="Type the ingredients exactly as they appear on the label, separated by commas"
            rows={3}
            className="w-full px-3 py-2 rounded-sm border border-[#333] bg-[#0d0d0d] text-xs text-[#f4f4f0] placeholder-[#555]"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={submitIngredients}
              disabled={submitting || ingredients.trim().length < 3}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#1e1e1e] text-[#ccc] rounded-sm text-xs font-medium disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-2 text-[#666] text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="mt-4 text-xs font-medium"
          style={{ color: 'var(--ick-green)' }}
        >
          Have the label? Add the ingredients →
        </button>
      )}
    </div>
  );
}
