// Condition View — toggle plus dual-score pills (Normal vs each condition,
// condition score capped at normal) and expandable per-condition flags.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';

const CONDITION_ICONS = { thyroid: '🦋', diabetes: '🩸', heart: '❤️', kidney: '🫘', celiac: '🌾' };

export default function ConditionView({
  totalScore, conditionViewOn, onToggle, userConditions,
  conditionScores, conditionLoading, conditionError,
}) {
  const navigate = useNavigate();

  return (
    <div className="px-4 mt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[#888]" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '2px', textTransform: 'uppercase' }}>
          Condition View
        </span>
        <button
          onClick={onToggle}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            conditionViewOn ? 'bg-[#c8f135]' : 'bg-[#333]'
          }`}
        >
          <div className={`absolute top-1 w-4 h-4 rounded-full transition-transform ${
            conditionViewOn ? 'translate-x-7 bg-[#0d0d0d]' : 'translate-x-1 bg-[#888]'
          }`} />
        </button>
      </div>

      {conditionViewOn && userConditions.length === 0 && (
        <div className="bg-[#1e1e1e] rounded-sm p-3 text-center">
          <p className="text-sm text-[#888]">No health conditions set.</p>
          <button
            onClick={() => navigate('/profile')}
            className="text-xs text-[#c8f135] font-medium mt-1"
          >
            Set conditions in your profile →
          </button>
        </div>
      )}

      {conditionViewOn && userConditions.length > 0 && (
        <div className="space-y-2">
          {/* Score pills */}
          <div className="flex flex-wrap gap-2">
            {/* null total = not enough data to score; show "—" in neutral
                grey, never a red 0. */}
            <div className={`px-3 py-1.5 rounded-sm text-sm font-semibold ${
              totalScore == null ? 'bg-[#1e1e1e] text-[#888]' :
              totalScore >= 75 ? 'bg-green-500/10 text-green-400' :
              totalScore >= 50 ? 'bg-amber-500/10 text-amber-400' :
              totalScore >= 25 ? 'bg-orange-500/10 text-orange-400' :
              'bg-red-500/10 text-red-400'
            }`}>
              Normal: {totalScore == null ? '—' : Math.round(totalScore)}
            </div>
            {conditionLoading ? (
              <div className="px-3 py-1.5 bg-[#1e1e1e] rounded-sm text-sm text-[#888]">
                Scoring...
              </div>
            ) : conditionError ? (
              <div className="px-3 py-1.5 bg-[#1e1e1e] rounded-sm text-sm text-[#888]">
                Couldn't load condition scores — check your connection
              </div>
            ) : conditionScores.map(cs => {
              const noScore = cs.score == null;
              const scoreColor = noScore ? 'bg-[#1e1e1e] text-[#888]' :
                cs.score >= 75 ? 'bg-green-500/10 text-green-400' :
                cs.score >= 50 ? 'bg-amber-500/10 text-amber-400' :
                cs.score >= 25 ? 'bg-orange-500/10 text-orange-400' :
                'bg-red-500/10 text-red-400';
              const capTitle = cs.cappedByNormal
                ? `Condition-specific score was ${cs.rawConditionScore} but capped to the general score (${cs.score}). See "Score Capping" in About Scoring.`
                : undefined;
              return (
                <div
                  key={cs.slug}
                  className={`px-3 py-1.5 rounded-sm text-sm font-semibold ${scoreColor}`}
                  title={capTitle}
                >
                  {CONDITION_ICONS[cs.slug] || ''} {cs.label}: {noScore ? '—' : cs.score}
                  {cs.cappedByNormal && <span className="ml-1 text-[10px] opacity-70">▲</span>}
                </div>
              );
            })}
          </div>

          {/* Expandable flags per condition */}
          {!conditionLoading && conditionScores.map(cs => (
            cs.flags.length > 0 && (
              <ConditionFlagsSection key={cs.slug} conditionScore={cs} />
            )
          ))}
        </div>
      )}
    </div>
  );
}

function ConditionFlagsSection({ conditionScore }) {
  const [expanded, setExpanded] = useState(false);
  const cs = conditionScore;
  const SEVERITY_ICONS = { good: '✅', warn: '⚠️', avoid: '🚫', info: 'ℹ️' };

  return (
    <div className="bg-[#111] rounded-sm overflow-hidden border border-[#2a2a2a]">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between p-3 text-left">
        <div className="flex items-center gap-2">
          <span>{CONDITION_ICONS[cs.slug] || ''}</span>
          <span className="text-sm font-medium text-[#ccc]">
            Why this {cs.label} score?
          </span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-[#888]" /> : <ChevronDown className="w-4 h-4 text-[#888]" />}
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-[#2a2a2a] pt-2">
          {cs.flags.map((flag, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-sm flex-shrink-0 mt-0.5">{SEVERITY_ICONS[flag.severity] || 'ℹ️'}</span>
              <div className="min-w-0">
                <p className={`text-sm font-medium ${
                  flag.severity === 'avoid' ? 'text-red-400' :
                  flag.severity === 'warn' ? 'text-amber-400' :
                  flag.severity === 'good' ? 'text-green-400' :
                  'text-[#888]'
                }`}>
                  {flag.ingredient || flag.nutrient || (flag.severity === 'info' ? 'Note' : '')}
                  {flag.evidence === 'mixed' && (
                    <span
                      className="ml-2 inline-block px-1.5 py-0.5 text-[9px] font-mono bg-amber-500/10 text-amber-300 rounded align-middle"
                      title="Mixed evidence — not formally endorsed by a major society, but supported by smaller clinical studies + mechanism"
                    >
                      MIXED EVIDENCE
                    </span>
                  )}
                </p>
                <p className="text-xs text-[#888]">{flag.reason}</p>
                {flag.source && (
                  <p className="text-[10px] text-[#555] mt-0.5 italic">Source: {flag.source}</p>
                )}
              </div>
            </div>
          ))}
          {cs.disclaimer && (
            <p className="text-[10px] text-[#555] pt-2 border-t border-[#1a1a1a] italic">
              {cs.disclaimer}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
