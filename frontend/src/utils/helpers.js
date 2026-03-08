// Score rating helpers
export function getScoreRating(score) {
  if (score == null) return 'unscored';
  if (score >= 86) return 'excellent';
  if (score >= 71) return 'good';
  if (score >= 51) return 'okay';
  if (score >= 31) return 'poor';
  return 'avoid';
}

export function getScoreLabel(score) {
  const labels = {
    unscored: '?',
    excellent: 'Clean',
    good: 'Decent',
    okay: 'Meh',
    poor: 'Ick',
    avoid: 'Ick that 💩'
  };
  return labels[getScoreRating(score)];
}

export function getScoreColor(score) {
  const colors = {
    unscored: 'text-gray-400',
    excellent: 'text-green-400',
    good: 'text-green-500',
    okay: 'text-amber-400',
    poor: 'text-orange-500',
    avoid: 'text-red-500'
  };
  return colors[getScoreRating(score)];
}

export function getScoreHex(score) {
  const colors = {
    unscored: '#888888',
    excellent: '#4ade80',
    good: '#22c55e',
    okay: '#fbbf24',
    poor: '#f97316',
    avoid: '#ef4444'
  };
  return colors[getScoreRating(score)];
}

export function getScoreBgClass(score) {
  const classes = {
    unscored: 'bg-gray-500/100',
    excellent: 'bg-green-500/100',
    good: 'bg-green-500/100',
    okay: 'bg-amber-500/100',
    poor: 'bg-orange-500/100',
    avoid: 'bg-red-500/100'
  };
  return classes[getScoreRating(score)];
}

export function getScoreTextClass(score) {
  const classes = {
    unscored: 'text-gray-400',
    excellent: 'text-green-400',
    good: 'text-green-500',
    okay: 'text-amber-400',
    poor: 'text-orange-500',
    avoid: 'text-red-500'
  };
  return classes[getScoreRating(score)];
}

export function getScoreLightBgClass(score) {
  const classes = {
    unscored: 'bg-gray-500/10',
    excellent: 'bg-green-500/10',
    good: 'bg-green-500/10',
    okay: 'bg-amber-500/10',
    poor: 'bg-orange-500/10',
    avoid: 'bg-red-500/10'
  };
  return classes[getScoreRating(score)];
}

// Format helpers
export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export function formatRelativeTime(date) {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now - then;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return formatDate(date);
}

export function formatDaysUntil(date) {
  const now = new Date();
  const then = new Date(date);
  const diffMs = then - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return `In ${diffDays} days`;
  return `In ${Math.ceil(diffDays / 7)} weeks`;
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

export function formatDuration(minutes) {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// Severity helpers
export function getSeverityLabel(severity) {
  if (severity >= 9) return 'Severe';
  if (severity >= 7) return 'High';
  if (severity >= 5) return 'Moderate';
  if (severity >= 3) return 'Low';
  return 'Minimal';
}

export function getSeverityColor(severity) {
  if (severity >= 9) return 'text-red-400 bg-red-500/10';
  if (severity >= 7) return 'text-orange-400 bg-orange-500/10';
  if (severity >= 5) return 'text-amber-400 bg-amber-500/10';
  if (severity >= 3) return 'text-blue-400 bg-blue-500/10';
  return 'text-gray-400 bg-gray-800';
}

// Score explanation generator — tells users WHY their score is what it is
export function getScoreExplanation(product) {
  const empty = { summary: '', harmful_detail: '', harmful_items: [], banned_detail: '', banned_items: [], transparency_detail: '', transparency_items: [], processing_detail: '', processing_items: [], company_detail: '', company_items: [] };
  if (!product) return empty;

  const reasons = [];
  const positives = [];

  // Parse harmful ingredients
  let harmful = product.harmful_ingredients_found;
  if (typeof harmful === 'string') { try { harmful = JSON.parse(harmful); } catch { harmful = []; } }
  if (!Array.isArray(harmful)) harmful = [];

  // ── Harmful Ingredients ──
  let harmful_detail;
  const harmful_items = [];
  if (harmful.length === 0) {
    harmful_detail = 'No harmful additives detected in this product.';
  } else {
    const highRisk = harmful.filter(h => h.severity >= 8);
    const medRisk = harmful.filter(h => h.severity >= 5 && h.severity < 8);
    const lowRisk = harmful.filter(h => h.severity < 5);
    const parts = [];
    if (highRisk.length) parts.push(`${highRisk.length} high-risk`);
    if (medRisk.length) parts.push(`${medRisk.length} moderate-risk`);
    if (lowRisk.length) parts.push(`${lowRisk.length} low-risk`);
    harmful_detail = `Contains ${harmful.length} flagged ingredient${harmful.length > 1 ? 's' : ''}: ${parts.join(', ')}.`;
    for (const h of harmful) {
      const item = { name: h.name, severity: h.severity };
      if (h.health_effects) item.effect = typeof h.health_effects === 'string' ? h.health_effects : '';
      if (h.why_used) item.why = h.why_used;
      if (h.category) item.category = h.category;
      harmful_items.push(item);
    }
    reasons.push(...harmful.slice(0, 2).map(h => h.name));
  }

  // ── Banned Elsewhere ──
  const bannedIngredients = harmful.filter(h => h.banned_in && h.banned_in.length > 0);
  let banned_detail;
  const banned_items = [];
  if (bannedIngredients.length === 0) {
    banned_detail = 'None of the ingredients are banned in other countries.';
  } else {
    const allCountries = [...new Set(bannedIngredients.flatMap(h => h.banned_in))];
    banned_detail = `${bannedIngredients.length} ingredient${bannedIngredients.length > 1 ? 's' : ''} banned in ${allCountries.length} region${allCountries.length > 1 ? 's' : ''}.`;
    for (const h of bannedIngredients) {
      banned_items.push({ name: h.name, countries: h.banned_in });
    }
    reasons.push(`banned in ${allCountries.slice(0, 2).join(', ')}`);
  }

  // ── Transparency ──
  const hasIngredients = product.ingredients && product.ingredients.length > 10;
  const nf = typeof product.nutrition_facts === 'string'
    ? (() => { try { return JSON.parse(product.nutrition_facts); } catch { return {}; } })()
    : (product.nutrition_facts || {});
  const nutrientCount = Object.keys(nf).length;
  const transparency_items = [];
  if (hasIngredients) transparency_items.push({ label: 'Ingredients list', present: true });
  else transparency_items.push({ label: 'Ingredients list', present: false });
  if (nutrientCount >= 5) transparency_items.push({ label: 'Full nutrition data', present: true });
  else if (nutrientCount >= 1) transparency_items.push({ label: 'Partial nutrition data', present: true, partial: true });
  else transparency_items.push({ label: 'Nutrition data', present: false });
  transparency_items.push({ label: 'Nutri-Score grade', present: !!product.nutriscore_grade });
  transparency_items.push({ label: 'Product image', present: !!product.image_url });
  transparency_items.push({ label: 'Brand identified', present: !!(product.brand && product.brand !== 'Unknown Brand' && product.brand !== 'Unknown') });
  const presentCount = transparency_items.filter(t => t.present).length;
  const transparency_detail = presentCount === transparency_items.length
    ? 'Full product data available — highly transparent.'
    : presentCount >= 3
      ? 'Good transparency — most product data is available.'
      : 'Limited data available — score may be less accurate.';

  // ── Processing ──
  let processing_detail;
  const processing_items = [];
  if (product.nova_group === 1) {
    processing_detail = 'Minimally processed — whole or naturally altered foods.';
    positives.push('minimally processed');
  } else if (product.nova_group === 2) {
    processing_detail = 'Processed culinary ingredient (oils, butter, sugar, salt).';
  } else if (product.nova_group === 3) {
    processing_detail = 'Processed food — manufactured with added salt, sugar, or oil.';
    reasons.push('processed');
  } else if (product.nova_group === 4) {
    processing_detail = 'Ultra-processed — industrial formulations with additives.';
    reasons.push('ultra-processed');
  } else {
    processing_detail = product.processing_score >= 70
      ? 'Low processing indicators based on ingredient analysis.'
      : 'Processing level estimated from ingredients — some markers found.';
  }
  // Detect ultra-processing markers in ingredient text
  if (product.ingredients) {
    const il = product.ingredients.toLowerCase();
    const markers = [
      ['high fructose corn syrup', 'High fructose corn syrup'],
      ['hydrogenated', 'Hydrogenated oils'],
      ['artificial flavor', 'Artificial flavors'],
      ['artificial color', 'Artificial colors'],
      ['sodium benzoate', 'Sodium benzoate (preservative)'],
      ['potassium sorbate', 'Potassium sorbate (preservative)'],
      ['carrageenan', 'Carrageenan (thickener)'],
      ['sodium nitrite', 'Sodium nitrite (preservative)'],
      ['tbhq', 'TBHQ (antioxidant preservative)'],
      ['bht', 'BHT (synthetic antioxidant)'],
      ['bha', 'BHA (synthetic antioxidant)'],
      ['maltodextrin', 'Maltodextrin (filler)'],
      ['polysorbate', 'Polysorbate (emulsifier)'],
    ];
    for (const [key, label] of markers) {
      if (il.includes(key)) processing_items.push(label);
    }
  }

  // ── Company Behavior ──
  let company_detail;
  const company_items = [];
  if (!product.company_name) {
    company_detail = 'Company not identified — defaulting to neutral score.';
  } else {
    const score = product.company_behavior_score ?? 50;
    const name = product.company_name;
    if (score >= 70) {
      company_detail = `${name} has a good track record.`;
    } else if (score >= 40) {
      company_detail = `${name} has a mixed track record.`;
    } else {
      company_detail = `${name} has significant concerns on record.`;
    }
    // Parse controversies
    let controversies = product.controversies || product.company_controversies || '';
    if (typeof controversies === 'object') controversies = JSON.stringify(controversies);
    if (controversies && controversies.length > 2) {
      // Split on common delimiters: semicolons, periods followed by capital, numbered lists
      const parts = controversies
        .split(/(?:;\s*|\.\s+(?=[A-Z])|\n|(?:\d+\.\s))/)
        .map(s => s.trim().replace(/\.$/, ''))
        .filter(s => s.length > 5);
      for (const p of parts.slice(0, 6)) {
        company_items.push(p);
      }
    }
  }

  // ── Overall summary ──
  if (product.is_organic) positives.push('certified organic');

  let summary;
  if (reasons.length === 0) {
    summary = positives.length > 0
      ? positives.join(', ')
      : 'No major concerns detected';
  } else {
    summary = reasons.slice(0, 3).join(', ');
    if (positives.length > 0) {
      summary += `. Plus: ${positives.join(', ')}`;
    }
  }
  summary = summary.charAt(0).toUpperCase() + summary.slice(1);

  return {
    summary,
    harmful_detail, harmful_items,
    banned_detail, banned_items,
    transparency_detail, transparency_items,
    processing_detail, processing_items,
    company_detail, company_items,
  };
}

// UPC validation
export function isValidUPC(code) {
  // UPC-A (12 digits), UPC-E (8 digits), EAN-13, EAN-8
  const cleaned = code.replace(/\D/g, '');
  return [8, 12, 13, 14].includes(cleaned.length);
}

// Truncate text
export function truncate(text, maxLength = 50) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// Capitalize first letter
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Pluralize
export function pluralize(count, singular, plural) {
  return count === 1 ? singular : (plural || `${singular}s`);
}

// Group array by key
export function groupBy(array, key) {
  return array.reduce((result, item) => {
    const group = item[key];
    if (!result[group]) result[group] = [];
    result[group].push(item);
    return result;
  }, {});
}

// Debounce function
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Generate unique ID
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
