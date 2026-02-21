const API_URL = import.meta.env.VITE_API_URL || '/api';

// ============================================================
// OFFLINE PRODUCT CACHE — IndexedDB
// See utils/offlineDB.js for the full implementation.
// This thin wrapper provides sync-looking API for the scan flow.
// ============================================================
import { getProduct, putProduct, getProductCount, searchProducts as offlineSearch } from './offlineDB';

// Global event bus for subscription-related errors
const subscriptionEvents = {
  _listeners: [],
  onPremiumRequired(callback) { this._listeners.push(callback); },
  emit(data) { this._listeners.forEach(cb => cb(data)); }
};

export { subscriptionEvents };

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('token');
    this._refreshPromise = null; // deduplicate concurrent refresh attempts
  }

  setToken(token) {
    this.token = token;
  }

  async request(endpoint, options = {}, _isRetry = false) {
    const url = `${API_URL}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    let response;
    try {
      response = await fetch(url, { ...options, headers });
    } catch {
      throw new Error('Network error. Please check your connection.');
    }

    const contentType = response.headers.get('content-type');
    let data;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Auto-refresh on expired access token (only retry once)
    if (response.status === 401 && data?.code === 'TOKEN_EXPIRED' && !_isRetry) {
      const refreshed = await this._refreshAccessToken();
      if (refreshed) {
        // Retry the original request with the new token
        return this.request(endpoint, options, true);
      }
      // Refresh failed — force logout
      this._handleAuthFailure();
      const error = new Error('Session expired. Please log in again.');
      error.status = 401;
      throw error;
    }

    if (!response.ok) {
      const error = new Error(data?.error || data || 'Request failed');
      error.status = response.status;
      error.data = data;

      if (response.status === 401 && !_isRetry) {
        this._handleAuthFailure();
      }

      if (response.status === 403 && data?.subscription) {
        subscriptionEvents.emit({
          type: 'premium_required',
          message: data.upgrade_message || 'Premium subscription required',
          subscription: data.subscription
        });
      }
      if (response.status === 429 && data?.limit) {
        subscriptionEvents.emit({
          type: 'scan_limit',
          scans_today: data.scans_today,
          limit: data.limit,
          subscription: data.subscription
        });
      }

      throw error;
    }

    return data;
  }

  // Attempt to get a new access token using the stored refresh token.
  // Deduplicates concurrent calls — only one refresh request in flight at a time.
  async _refreshAccessToken() {
    if (this._refreshPromise) return this._refreshPromise;

    this._refreshPromise = (async () => {
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) return false;

        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });

        if (!res.ok) return false;

        const data = await res.json();
        if (data.token) {
          localStorage.setItem('token', data.token);
          this.token = data.token;
        }
        if (data.refreshToken) {
          localStorage.setItem('refreshToken', data.refreshToken);
        }
        return true;
      } catch {
        return false;
      } finally {
        this._refreshPromise = null;
      }
    })();

    return this._refreshPromise;
  }

  _handleAuthFailure() {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    this.token = null;
    // Dispatch a custom event so AuthContext can react without circular imports
    window.dispatchEvent(new Event('auth:logout'));
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  put(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
}

const api = new ApiClient();
export default api;

// Convenience functions for common endpoints
export const products = {
  scan: async (upc) => {
    // Check IndexedDB cache first — return instantly if fresh
    const cached = await getProduct(upc);
    if (cached && cached.fresh) return cached.data;
    
    try {
      const result = await api.get(`/products/scan/${upc}`);
      putProduct(upc, result); // async, don't await — don't block return
      return result;
    } catch (err) {
      // Offline fallback: return stale cache if available
      if (cached && !cached.stale) return cached.data;
      throw err;
    }
  },
  view: async (upc) => {
    const cached = await getProduct(upc);
    if (cached && cached.fresh) return cached.data;
    
    try {
      const result = await api.get(`/products/view/${upc}`);
      putProduct(upc, result);
      return result;
    } catch (err) {
      if (cached && !cached.stale) return cached.data;
      throw err;
    }
  },
  search: async (query) => {
    try {
      // Try online search first
      return await api.get(`/products/search?q=${encodeURIComponent(query)}`);
    } catch (err) {
      // Offline: search local IndexedDB
      const offlineResults = await offlineSearch(query);
      if (offlineResults.length > 0) return offlineResults;
      throw err;
    }
  },
  get: (id) => api.get(`/products/${id}`),
  history: (limit = 20) => api.get(`/products/history?limit=${limit}`),
  favorites: () => api.get('/products/favorites'),
  addFavorite: (upc) => api.post(`/products/favorites/${upc}`),
  removeFavorite: (upc) => api.delete(`/products/favorites/${upc}`),
  checkFavorite: (upc) => api.get(`/products/favorites/check/${upc}`),
  getHarmfulIngredients: () => api.get('/products/ingredients/harmful'),
  getCategories: () => api.get('/products/meta/categories'),
  cacheCount: () => getProductCount()
};

export const pantry = {
  list: () => api.get('/pantry'),
  add: (item) => api.post('/pantry', item),
  bulkAdd: (items) => api.post('/pantry/bulk', { items }),
  finish: (id) => api.put(`/pantry/${id}/finish`),
  update: (id, data) => api.put(`/pantry/${id}`, data),
  remove: (id) => api.delete(`/pantry/${id}`),
  audit: () => api.get('/pantry/audit')
};

export const swaps = {
  forProduct: (upc) => api.get(`/swaps/for/${upc}`),
  click: (fromProductId, toProductId) => api.post('/swaps/click', { from_product_id: fromProductId, to_product_id: toProductId }),
  purchased: (fromProductId, toProductId) => api.post('/swaps/purchased', { from_product_id: fromProductId, to_product_id: toProductId }),
  history: () => api.get('/swaps/history'),
  recommendations: () => api.get('/swaps/recommendations')
};

export const recipes = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/recipes${query ? `?${query}` : ''}`);
  },
  get: (id) => api.get(`/recipes/${id}`),
  forProduct: (upc) => api.get(`/recipes/for/${upc}`),
  markMade: (id, data) => api.post(`/recipes/${id}/made`, data),
  history: () => api.get('/recipes/user/history'),
  categories: () => api.get('/recipes/meta/categories')
};

export const shopping = {
  lists: () => api.get('/shopping/lists'),
  createList: (data) => api.post('/shopping/lists', data),
  getList: (id) => api.get(`/shopping/lists/${id}`),
  addItem: (listId, item) => api.post(`/shopping/lists/${listId}/items`, item),
  checkItem: (itemId, checked, pricePaid) => api.put(`/shopping/items/${itemId}/check`, { checked, price_paid: pricePaid }),
  removeItem: (itemId) => api.delete(`/shopping/items/${itemId}`),
  completeList: (id) => api.put(`/shopping/lists/${id}/complete`),
  generateList: (days) => api.post('/shopping/lists/generate', { days_ahead: days }),
  deleteList: (id) => api.delete(`/shopping/lists/${id}`)
};

export const velocity = {
  all: () => api.get('/velocity'),
  forProduct: (upc) => api.get(`/velocity/product/${upc}`),
  log: (upc, days_to_consume) => api.post('/velocity/log', { upc, days_to_consume }),
  runningLow: (days = 7) => api.get(`/velocity/running-low?days=${days}`),
  reset: (upc) => api.delete(`/velocity/product/${upc}`),
  restock: (upc) => api.post(`/velocity/restock/${upc}`),
  summary: () => api.get('/velocity/summary')
};

export const progress = {
  dashboard: () => api.get('/progress/dashboard'),
  achievements: () => api.get('/progress/achievements'),
  leaderboard: () => api.get('/progress/leaderboard')
};

export const subscription = {
  status: () => api.get('/subscription/status'),
  startTrial: () => api.post('/subscription/start-trial'),
  subscribe: (plan) => api.post('/subscription/subscribe', { plan }),
  cancel: () => api.post('/subscription/cancel'),
  features: () => api.get('/subscription/features')
};

export const account = {
  changePassword: (current_password, new_password) =>
    api.put('/auth/password', { current_password, new_password }),
  deleteAccount: (password) =>
    api.request('/auth/account', { method: 'DELETE', body: JSON.stringify({ password }) }),
};
