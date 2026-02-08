import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useToast } from '../contexts/ToastContext';

export default function ShoppingMode() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [list, setList] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [priceInput, setPriceInput] = useState({});
  const [showPriceModal, setShowPriceModal] = useState(null);

  useEffect(() => {
    loadList();
    // Prevent screen sleep during shopping
    if ('wakeLock' in navigator) {
      navigator.wakeLock.request('screen').catch(() => {});
    }
  }, [id]);

  const loadList = async () => {
    try {
      const res = await api.get(`/shopping/lists/${id}`);
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

  const toggleItem = async (itemId, currentChecked) => {
    // If checking off, ask for price
    if (!currentChecked) {
      setShowPriceModal(itemId);
      return;
    }

    // If unchecking, just update
    try {
      await api.put(`/shopping/items/${itemId}/check`, {
        checked: false
      });
      loadList();
    } catch (err) {
      showToast('Failed to update item', 'error');
    }
  };

  const confirmCheckWithPrice = async () => {
    if (!showPriceModal) return;
    
    try {
      await api.put(`/shopping/items/${showPriceModal}/check`, {
        checked: true,
        price_paid: priceInput[showPriceModal] ? parseFloat(priceInput[showPriceModal]) : null
      });
      setShowPriceModal(null);
      loadList();
      
      // Vibrate on check
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    } catch (err) {
      showToast('Failed to update item', 'error');
    }
  };

  const completeTrip = async () => {
    setCompleting(true);
    try {
      await api.put(`/shopping/lists/${id}/complete`);
      showToast('Shopping complete! Items added to pantry.', 'success');
      navigate('/shopping');
    } catch (err) {
      showToast('Failed to complete trip', 'error');
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!list) return null;

  const checkedCount = items.filter(i => i.checked).length;
  const totalSpent = items
    .filter(i => i.checked && i.price_paid)
    .reduce((sum, i) => sum + i.price_paid * (i.quantity || 1), 0);

  // Sort: unchecked first, then by aisle/section
  const sortedItems = [...items].sort((a, b) => {
    if (a.checked !== b.checked) return a.checked ? 1 : -1;
    if (a.aisle && b.aisle) return a.aisle.localeCompare(b.aisle);
    return (a.section || '').localeCompare(b.section || '');
  });

  return (
    <div className="pb-24 bg-gray-900 min-h-screen -mx-4 px-4 -mt-4 pt-4">
      {/* Header */}
      <div className="bg-orange-500/100 text-white rounded-xl p-4 mb-4 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => navigate(`/shopping/${id}`)}
            className="text-white/80"
          >
            ← Exit Mode
          </button>
          <span className="text-sm opacity-80">Shopping Mode</span>
        </div>
        
        <h1 className="text-xl font-bold mb-1">{list.name}</h1>
        {list.store && <p className="text-sm opacity-80">🏪 {list.store}</p>}
        
        {/* Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span>{checkedCount} of {items.length} items</span>
            <span>{Math.round((checkedCount / items.length) * 100)}%</span>
          </div>
          <div className="h-3 bg-gray-950/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gray-950 transition-all duration-300"
              style={{ width: `${(checkedCount / items.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Spent Tracker */}
        {totalSpent > 0 && (
          <div className="mt-3 pt-3 border-t border-white/20">
            <span className="text-sm opacity-80">Total Spent: </span>
            <span className="text-lg font-bold">${totalSpent.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="space-y-2">
        {sortedItems.map(item => (
          <div 
            key={item.id}
            onClick={() => toggleItem(item.id, item.checked)}
            className={`bg-gray-950 rounded-xl p-4 shadow-sm flex items-center gap-3 cursor-pointer transition-all ${
              item.checked ? 'opacity-50' : ''
            }`}
          >
            {/* Checkbox */}
            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
              item.checked 
                ? 'bg-orange-500/100 border-orange-500 text-white' 
                : 'border-gray-600'
            }`}>
              {item.checked && (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>

            {/* Score */}
            {item.total_score && !item.checked && (
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
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
              <h3 className={`font-medium text-gray-100 ${item.checked ? 'line-through' : ''}`}>
                {item.name}
              </h3>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>{item.brand}</span>
                {item.quantity > 1 && <span>×{item.quantity}</span>}
              </div>
              {item.aisle && !item.checked && (
                <p className="text-xs text-orange-400 mt-1">📍 Aisle {item.aisle}</p>
              )}
            </div>

            {/* Price if checked */}
            {item.checked && item.price_paid && (
              <span className="text-sm text-gray-500">
                ${(item.price_paid * (item.quantity || 1)).toFixed(2)}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Complete Button */}
      {checkedCount === items.length && items.length > 0 && (
        <div className="fixed bottom-20 left-4 right-4">
          <button
            onClick={completeTrip}
            disabled={completing}
            className="w-full py-4 bg-orange-500/100 text-white rounded-xl font-semibold shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {completing ? (
              <>
                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                <span>Completing...</span>
              </>
            ) : (
              <>
                <span>🎉</span>
                <span>Complete Shopping Trip</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Price Input Modal */}
      {showPriceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-950 rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-4">Enter Price (Optional)</h2>
            <p className="text-sm text-gray-500 mb-4">
              Track actual prices to improve future estimates
            </p>
            
            <div className="relative mb-6">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                value={priceInput[showPriceModal] || ''}
                onChange={(e) => setPriceInput(prev => ({
                  ...prev,
                  [showPriceModal]: e.target.value
                }))}
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-3 border border-gray-700 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setPriceInput(prev => ({ ...prev, [showPriceModal]: '' }));
                  confirmCheckWithPrice();
                }}
                className="flex-1 py-3 bg-gray-800 text-gray-400 rounded-xl font-medium"
              >
                Skip
              </button>
              <button
                onClick={confirmCheckWithPrice}
                className="flex-1 py-3 bg-orange-500/100 text-white rounded-xl font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
