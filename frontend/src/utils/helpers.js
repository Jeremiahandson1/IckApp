// Score rating helpers
export function getScoreRating(score) {
  if (score >= 86) return 'excellent';
  if (score >= 71) return 'good';
  if (score >= 51) return 'okay';
  if (score >= 31) return 'poor';
  return 'avoid';
}

export function getScoreLabel(score) {
  const labels = {
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
    excellent: 'bg-green-500/100/10',
    good: 'bg-green-500/100/10',
    okay: 'bg-amber-500/100/10',
    poor: 'bg-orange-500/100/10',
    avoid: 'bg-red-500/100/10'
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
  if (severity >= 9) return 'text-red-400 bg-red-500/100/10';
  if (severity >= 7) return 'text-orange-400 bg-orange-500/100/10';
  if (severity >= 5) return 'text-amber-400 bg-amber-500/100/10';
  if (severity >= 3) return 'text-blue-400 bg-blue-500/100/10';
  return 'text-gray-400 bg-gray-800';
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
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
