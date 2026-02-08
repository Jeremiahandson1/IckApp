import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import { getScoreColor } from '../utils/helpers';
import { useToast } from '../contexts/ToastContext';

export default function ShoppingList() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [list, setList] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    loadList();
  }, [id]);

  const loadList = async () => {
    try {
      const res = await api.get(`/shopping/lists/${id}`);
      // Response is {...list_fields, items: [...]}
      const { items, ...listData } = res;
      setList(listData);
      setItems(items || []);
    } catch (err) {
      showToast('Failed to load list', 'error');
      navigate('/shopping');
    } finally {
      setLoading(false);
    }
  };

  const searchProducts = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const res = await api.get(`/products/search?q=${encodeURIComponent(query)}`);
      setSearchResults(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      searchProducts(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const addItem = async (product) => {
    try {
      await api.post(`/shopping/lists/${id}/items`, {
        product_id: product.id,
        upc: product.upc,
        quantity: 1
      });
      showToast('Item added!', 'success');
      setShowAddItem(false);
      setSearchQuery('');
      setSearchResults([]);
      loadList();
    } catch (err) {
      showToast('Failed to add item', 'error');
    }
  };

  const removeItem = async (itemId) => {
    try {
      await api.delete(`/shopping/items/${itemId}`);
      loadList();
    } catch (err) {
      showToast('Failed to remove item', 'error');
    }
  };

  const updateQuantity = async (itemId, quantity) => {
    // For now just update locally, could add API endpoint
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, quantity } : item
    ));
  };

  const startShopping = () => {
    navigate(`/shopping/${id}/mode`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!list) return null;

  const groupedItems = items.reduce((acc, item) => {
    const section = item.section || 'Other';
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {});

  return (
    <div className="pb-24">
      {/* Back Button */}
      <button
        onClick={() => navigate('/shopping')}
        className="flex items-center gap-2 text-gray-400 mb-4"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Header */}
      <div className="bg-gray-950 rounded-xl p-4 shadow-sm mb-4">
        <h1 className="text-xl font-bold text-gray-100">{list.name}</h1>
        {list.store && (
          <p className="text-sm text-gray-500">🏪 {list.store}</p>
        )}
        <div className="flex items-center gap-4 mt-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-100">{items.length}</div>
            <div className="text-xs text-gray-500">Items</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-400">
              ${items.reduce((sum, i) => sum + (i.typical_price || 0) * (i.quantity || 1), 0).toFixed(2)}
            </div>
            <div className="text-xs text-gray-500">Est. Total</div>
          </div>
        </div>
      </div>

      {/* Add Item Button */}
      <button
        onClick={() => setShowAddItem(true)}
        className="w-full p-4 border-2 border-dashed border-gray-700 rounded-xl text-gray-500 mb-4 flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Item
      </button>

      {/* Items by Section */}
      {Object.keys(groupedItems).length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📋</div>
          <h2 className="text-xl font-semibold text-gray-100 mb-2">List is empty</h2>
          <p className="text-gray-500">Add items to get started</p>
        </div>
      ) : (
        Object.entries(groupedItems).map(([section, sectionItems]) => (
          <div key={section} className="mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {section}
            </h2>
            <div className="space-y-2">
              {sectionItems.map(item => (
                <div key={item.id} className="bg-gray-950 rounded-xl p-3 shadow-sm flex items-center gap-3">
                  {/* Score */}
                  {item.total_score && (
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm ${
                      item.total_score >= 86 ? 'bg-orange-500/100' :
                      item.total_score >= 71 ? 'bg-green-400' :
                      item.total_score >= 51 ? 'bg-yellow-400' :
                      item.total_score >= 31 ? 'bg-orange-400' : 'bg-red-500/100'
                    }`}>
                      {Math.round(item.total_score)}
                    </div>
                  )}
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-100 truncate text-sm">{item.name}</h3>
                    <p className="text-xs text-gray-500">{item.brand}</p>
                    {item.aisle && (
                      <p className="text-xs text-orange-400">Aisle: {item.aisle}</p>
                    )}
                  </div>

                  {/* Quantity */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.id, Math.max(1, (item.quantity || 1) - 1))}
                      className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center text-sm"
                    >
                      -
                    </button>
                    <span className="w-5 text-center font-medium text-sm">{item.quantity || 1}</span>
                    <button
                      onClick={() => updateQuantity(item.id, (item.quantity || 1) + 1)}
                      className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center text-sm"
                    >
                      +
                    </button>
                  </div>

                  {/* Price */}
                  {item.typical_price && (
                    <span className="text-sm text-gray-500 w-16 text-right">
                      ${(item.typical_price * (item.quantity || 1)).toFixed(2)}
                    </span>
                  )}

                  {/* Remove */}
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-1 text-red-400"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Start Shopping Button */}
      {items.length > 0 && (
        <div className="fixed bottom-20 left-4 right-4">
          <button
            onClick={startShopping}
            className="w-full py-4 bg-orange-500/100 text-white rounded-xl font-semibold shadow-lg flex items-center justify-center gap-2"
          >
            <span>🛒</span>
            <span>Start Shopping Mode</span>
          </button>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddItem && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-gray-950 rounded-t-2xl w-full max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-bold">Add Item</h2>
              <button
                onClick={() => {
                  setShowAddItem(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="p-2 text-gray-500"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search */}
            <div className="p-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full px-4 py-3 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                autoFocus
              />
            </div>

            {/* Results */}
            <div className="flex-1 overflow-auto p-4 pt-0">
              {searching ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin w-6 h-6 border-3 border-orange-500 border-t-transparent rounded-full" />
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map(product => (
                    <button
                      key={product.id}
                      onClick={() => addItem(product)}
                      className="w-full p-3 bg-gray-900 rounded-xl flex items-center gap-3 text-left"
                    >
                      {/* Score */}
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm ${
                        product.total_score >= 86 ? 'bg-orange-500/100' :
                        product.total_score >= 71 ? 'bg-green-400' :
                        product.total_score >= 51 ? 'bg-yellow-400' :
                        product.total_score >= 31 ? 'bg-orange-400' : 'bg-red-500/100'
                      }`}>
                        {Math.round(product.total_score)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-100 truncate">{product.name}</h3>
                        <p className="text-sm text-gray-500">{product.brand}</p>
                      </div>

                      <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  ))}
                </div>
              ) : searchQuery ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No products found</p>
                  <p className="text-sm">Try scanning it first</p>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <p>Search for products to add</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
