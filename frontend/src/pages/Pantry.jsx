import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { getScoreColor, getScoreLabel, formatDate } from '../utils/helpers';
import { useToast } from '../contexts/ToastContext';

export default function Pantry() {
  const [pantryItems, setPantryItems] = useState([]);
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('score');
  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    loadPantry();
  }, []);

  const loadPantry = async () => {
    try {
      const itemsRes = await api.get('/pantry');
      setPantryItems(Array.isArray(itemsRes) ? itemsRes : itemsRes.items || []);

      // Audit is premium-only — may 403 for free users
      try {
        const auditRes = await api.get('/pantry/audit');
        setAudit(auditRes);
      } catch (e) {
        // Free users don't get audit — that's fine
      }
    } catch (err) {
      showToast('Failed to load pantry', 'error');
    } finally {
      setLoading(false);
    }
  };

  const markFinished = async (itemId) => {
    try {
      await api.put(`/pantry/${itemId}/finish`);
      showToast('Item marked as finished!', 'success');
      loadPantry();
    } catch (err) {
      showToast('Failed to update item', 'error');
    }
  };

  const removeItem = async (itemId) => {
    try {
      await api.delete(`/pantry/${itemId}`);
      showToast('Item removed', 'success');
      loadPantry();
    } catch (err) {
      showToast('Failed to remove item', 'error');
    }
  };

  const filteredItems = pantryItems
    .filter(item => {
      if (filter === 'all') return true;
      if (filter === 'bad' && item.total_score <= 50) return true;
      if (filter === 'good' && item.total_score > 70) return true;
      if (filter === 'okay' && item.total_score > 50 && item.total_score <= 70) return true;
      return false;
    })
    .sort((a, b) => {
      if (sortBy === 'score') return a.total_score - b.total_score;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'date') return new Date(b.added_at) - new Date(a.added_at);
      return 0;
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-100">My Pantry</h1>
        <Link
          to="/pantry/audit"
          className="px-4 py-2 bg-orange-500/100 text-white rounded-lg text-sm font-medium"
        >
          + Add Items
        </Link>
      </div>

      {/* Damage Report Summary */}
      {audit && pantryItems.length > 0 && (
        <div className="bg-gray-950 rounded-xl p-4 shadow-sm mb-4">
          <h2 className="font-semibold text-gray-100 mb-3">Pantry Health Report</h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center">
              <div className={`text-2xl font-bold ${getScoreColor(audit.average_score)}`}>
                {Math.round(audit.average_score)}
              </div>
              <div className="text-xs text-gray-500">Avg Score</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-100">{audit.total_items}</div>
              <div className="text-xs text-gray-500">Items</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500">
                {audit.breakdown?.avoid || 0}
              </div>
              <div className="text-xs text-gray-500">To Swap</div>
            </div>
          </div>
          
          {/* Score Distribution */}
          <div className="flex gap-1 h-4 rounded-full overflow-hidden">
            {audit.breakdown?.excellent > 0 && (
              <div 
                className="bg-orange-500/100" 
                style={{ width: `${(audit.breakdown.excellent / audit.total_items) * 100}%` }} 
              />
            )}
            {audit.breakdown?.good > 0 && (
              <div 
                className="bg-green-400" 
                style={{ width: `${(audit.breakdown.good / audit.total_items) * 100}%` }} 
              />
            )}
            {audit.breakdown?.okay > 0 && (
              <div 
                className="bg-yellow-400" 
                style={{ width: `${(audit.breakdown.okay / audit.total_items) * 100}%` }} 
              />
            )}
            {audit.breakdown?.poor > 0 && (
              <div 
                className="bg-orange-400" 
                style={{ width: `${(audit.breakdown.poor / audit.total_items) * 100}%` }} 
              />
            )}
            {audit.breakdown?.avoid > 0 && (
              <div 
                className="bg-red-500/100" 
                style={{ width: `${(audit.breakdown.avoid / audit.total_items) * 100}%` }} 
              />
            )}
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>🌟 {audit.breakdown?.excellent || 0}</span>
            <span>🟢 {audit.breakdown?.good || 0}</span>
            <span>🟡 {audit.breakdown?.okay || 0}</span>
            <span>🟠 {audit.breakdown?.poor || 0}</span>
            <span>🔴 {audit.breakdown?.avoid || 0}</span>
          </div>

          {/* Top Harmful Ingredients */}
          {audit.top_harmful_ingredients?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Top Harmful Ingredients</h3>
              <div className="flex flex-wrap gap-2">
                {audit.top_harmful_ingredients.slice(0, 5).map((ing, i) => (
                  <span key={i} className="px-2 py-1 bg-red-500/10 text-red-700 text-xs rounded-full">
                    {ing.name} ({ing.count})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      {pantryItems.length > 0 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {[
            { key: 'all', label: 'All' },
            { key: 'bad', label: '🔴 Swap These' },
            { key: 'okay', label: '🟡 Okay' },
            { key: 'good', label: '🟢 Good' }
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
                filter === f.key
                  ? 'bg-orange-500/100 text-white'
                  : 'bg-gray-800 text-gray-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Empty State */}
      {pantryItems.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📦</div>
          <h2 className="text-xl font-semibold text-gray-100 mb-2">Your pantry is empty</h2>
          <p className="text-gray-500 mb-6">
            Start by scanning products or doing a full pantry audit
          </p>
          <div className="flex flex-col gap-3">
            <Link
              to="/scan"
              className="mx-auto px-6 py-3 bg-orange-500/100 text-white rounded-xl font-medium"
            >
              Scan a Product
            </Link>
            <Link
              to="/pantry/audit"
              className="mx-auto px-6 py-3 bg-gray-800 text-gray-300 rounded-xl font-medium"
            >
              Full Pantry Audit
            </Link>
          </div>
        </div>
      )}

      {/* Items List */}
      <div className="space-y-3">
        {filteredItems.map(item => (
          <div key={item.id} className="bg-gray-950 rounded-xl p-4 shadow-sm">
            <div className="flex items-start gap-3">
              {/* Score Badge */}
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold ${
                item.total_score >= 86 ? 'bg-orange-500/100' :
                item.total_score >= 71 ? 'bg-green-400' :
                item.total_score >= 51 ? 'bg-yellow-400' :
                item.total_score >= 31 ? 'bg-orange-400' : 'bg-red-500/100'
              }`}>
                {Math.round(item.total_score)}
              </div>
              
              {/* Product Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-100 truncate">{item.name}</h3>
                <p className="text-sm text-gray-500">{item.brand}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs font-medium ${getScoreColor(item.total_score)}`}>
                    {getScoreLabel(item.total_score)}
                  </span>
                  {item.quantity > 1 && (
                    <span className="text-xs text-gray-400">×{item.quantity}</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => navigate(`/product/${item.upc}`)}
                  className="p-2 text-gray-400 hover:text-orange-500"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Harmful Ingredients Preview */}
            {item.harmful_ingredients_found?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-800">
                <div className="flex flex-wrap gap-1">
                  {item.harmful_ingredients_found.slice(0, 3).map((ing, i) => (
                    <span key={i} className="px-2 py-0.5 bg-red-500/10 text-red-400 text-xs rounded">
                      {ing}
                    </span>
                  ))}
                  {item.harmful_ingredients_found.length > 3 && (
                    <span className="text-xs text-gray-400">
                      +{item.harmful_ingredients_found.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Actions Row */}
            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-800">
              {item.total_score < 70 && (
                <button
                  onClick={() => navigate(`/product/${item.upc}?tab=swaps`)}
                  className="flex-1 py-2 bg-orange-500/10 text-orange-400 rounded-lg text-sm font-medium"
                >
                  Find Swaps
                </button>
              )}
              <button
                onClick={() => markFinished(item.id)}
                className="flex-1 py-2 bg-gray-800 text-gray-400 rounded-lg text-sm font-medium"
              >
                Finished
              </button>
              <button
                onClick={() => removeItem(item.id)}
                className="px-3 py-2 text-red-500 text-sm"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      {pantryItems.length > 0 && audit?.breakdown?.avoid > 0 && (
        <div className="fixed bottom-20 left-4 right-4">
          <Link
            to="/swaps"
            className="flex items-center justify-center gap-2 w-full py-4 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl font-semibold shadow-lg"
          >
            <span>🔄</span>
            <span>Fix {audit.breakdown.avoid} Problem Items</span>
          </Link>
        </div>
      )}
    </div>
  );
}
