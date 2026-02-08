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
  }

  setToken(token) {
    this.token = token;
  }

  async request(endpoint, options = {}) {
    const url = `${API_URL}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(url, config);
      
      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        const error = new Error(data.error || data || 'Request failed');
        error.status = response.status;
        error.data = data;

        // Emit global events for subscription-related errors
        if (response.status === 403 && data.subscription) {
          subscriptionEvents.emit({
            type: 'premium_required',
            message: data.upgrade_message || 'Premium subscription required',
            subscription: data.subscription
          });
        }
        if (response.status === 429 && data.limit) {
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
    } catch (error) {
      if (error.status) {
        throw error;
      }
      throw new Error('Network error. Please check your connection.');
    }
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
  log: (upc) => api.post('/velocity/log', { upc }),
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
