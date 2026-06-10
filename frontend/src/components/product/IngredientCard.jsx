// One harmful-additive card: risk level, health effects, where it's banned,
// why it's used, and a source link.

import { ExternalLink } from 'lucide-react';

export default function IngredientCard({ ingredient }) {
  return (
    <div className="p-4" style={{ background: '#111', border: '1px solid rgba(255,59,48,0.15)' }}>
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-[#f4f4f0]" style={{ fontFamily: 'var(--font-display)', fontSize: '20px', letterSpacing: '1px', textTransform: 'uppercase' }}>{ingredient.name}</h4>
        <span className="text-xs px-2 py-0.5" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '1px', background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)', color: 'var(--red)' }}>
          RISK {ingredient.severity}/10
        </span>
      </div>
      {ingredient.health_effects && (
        <p className="text-sm text-[#888] mb-2" style={{ fontWeight: 300 }}>{ingredient.health_effects}</p>
      )}
      {ingredient.banned_in && ingredient.banned_in.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {ingredient.banned_in.map((country, i) => (
            <span key={i} className="text-xs px-2 py-0.5" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '1px', background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.2)', color: 'var(--red)' }}>
              BANNED: {country.toUpperCase()}
            </span>
          ))}
        </div>
      )}
      {ingredient.why_used && (
        <p className="text-xs text-[#666] mb-1" style={{ fontStyle: 'italic' }}>
          Why it's in there: {ingredient.why_used}
        </p>
      )}
      {ingredient.source_url && (
        <a
          href={ingredient.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:underline mt-1"
          style={{ color: 'var(--ick-green)', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '1px' }}
        >
          <ExternalLink className="w-3 h-3" /> SOURCE ↗
        </a>
      )}
    </div>
  );
}
