// Score rating helper (single source of truth for backend)
export function getScoreRating(score) {
  if (score == null) return { rating: 'unscored', emoji: '❓', color: '#888888' };
  if (score >= 86) return { rating: 'excellent', emoji: '🌟', color: '#22c55e' };
  if (score >= 71) return { rating: 'good', emoji: '🟢', color: '#84cc16' };
  if (score >= 51) return { rating: 'okay', emoji: '🟡', color: '#eab308' };
  if (score >= 31) return { rating: 'poor', emoji: '🟠', color: '#f97316' };
  return { rating: 'avoid', emoji: '🔴', color: '#ef4444' };
}
