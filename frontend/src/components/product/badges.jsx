// Display-only badges for Nutri-Score and NOVA group (shown next to the
// product name — these do NOT feed the Ick total score).

// Official Nutri-Score colors per Santé Publique France spec.
const NUTRISCORE_BG = {
  a: '#038141', b: '#85BB2F', c: '#FECB02', d: '#EE8100', e: '#E63E11',
};
const NUTRISCORE_FG = { a: '#fff', b: '#fff', c: '#1a1a1a', d: '#fff', e: '#fff' };

export function NutriScoreBadge({ grade }) {
  // OFF returns "not-applicable" / "unknown" when the food category is
  // ineligible (e.g. spices, sweeteners). Filter to real grades only.
  const g = String(grade || '').toLowerCase();
  if (!['a', 'b', 'c', 'd', 'e'].includes(g)) return null;

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-[#666] font-medium">Nutri-Score</span>
      <span
        className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold"
        style={{ background: NUTRISCORE_BG[g], color: NUTRISCORE_FG[g] }}
      >
        {g.toUpperCase()}
      </span>
    </div>
  );
}

const NOVA_LABELS = { 1: 'Unprocessed', 2: 'Processed ingredients', 3: 'Processed', 4: 'Ultra-processed' };
const NOVA_STYLE = {
  1: { color: '#16a34a', bg: 'rgba(34,197,94,0.15)' },
  2: { color: '#84cc16', bg: 'rgba(132,204,22,0.15)' },
  3: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  4: { color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
};

export function NovaBadge({ group }) {
  // OFF can return null / "not-applicable" / numeric strings. Coerce + validate.
  const g = parseInt(group, 10);
  if (!NOVA_LABELS[g]) return null;
  const style = NOVA_STYLE[g];
  return (
    <span
      className="text-xs font-medium px-2.5 py-1 rounded-full"
      style={{ color: style.color, background: style.bg }}
      title={NOVA_LABELS[g]}
    >
      NOVA {g}
    </span>
  );
}
