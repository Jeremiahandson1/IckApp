import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Camera, Upload, Receipt, Check, X, Edit3, Plus,
  DollarSign, ShoppingCart, TrendingUp, ChevronDown, ChevronUp,
  RotateCcw, Loader, AlertCircle, Package
} from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../contexts/ToastContext';

export default function ReceiptScan() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // States
  const [step, setStep] = useState('capture'); // capture | parsing | review | done | budget
  const [imagePreview, setImagePreview] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [budgetData, setBudgetData] = useState(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [showBudget, setShowBudget] = useState(false);

  // Load budget on mount
  useEffect(() => {
    loadBudget();
  }, []);

  const loadBudget = async () => {
    setBudgetLoading(true);
    try {
      const data = await api.get('/receipts/budget/summary?period=30');
      setBudgetData(data);
    } catch { /* no budget data yet */ }
    setBudgetLoading(false);
  };

  // Handle image selection (camera or file)
  const handleImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);

    // Convert to base64 and send
    setStep('parsing');
    setLoading(true);

    try {
      const base64 = await fileToBase64(file);
      const data = await api.post('/receipts/scan', { image_base64: base64 });
      
      setReceipt(data.receipt);
      setItems(data.items || []);
      setSummary(data.summary);
      setStep('review');
    } catch (err) {
      showToast(err.message || 'Failed to parse receipt. Try a clearer photo.', 'error');
      setStep('capture');
    }
    setLoading(false);
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        // Strip data:image/...;base64, prefix
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Toggle item selection
  const toggleItem = (id) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, _selected: !item._selected } : item
    ));
  };

  // Select/deselect all
  const toggleAll = () => {
    const allSelected = items.every(i => i._selected !== false);
    setItems(prev => prev.map(item => ({ ...item, _selected: !allSelected })));
  };

  // Update item (price, name correction)
  const updateItem = async (itemId, updates) => {
    try {
      const updated = await api.put(`/receipts/${receipt.id}/items/${itemId}`, updates);
      setItems(prev => prev.map(item => item.id === itemId ? { ...item, ...updated } : item));
      setEditingItem(null);
    } catch {
      showToast('Failed to update item', 'error');
    }
  };

  // Add selected items to pantry
  const addToPantry = async () => {
    setLoading(true);
    try {
      const selectedIds = items
        .filter(i => i._selected !== false)
        .map(i => i.id);

      if (selectedIds.length === 0) {
        showToast('Select at least one item', 'error');
        setLoading(false);
        return;
      }

      const result = await api.post(`/receipts/${receipt.id}/add-to-pantry`, { 
        item_ids: selectedIds 
      });

      showToast(`Added ${result.added} items to pantry ($${result.total_spent?.toFixed(2)})`, 'success');
      setStep('done');
      loadBudget(); // refresh budget
    } catch (err) {
      showToast('Failed to add items to pantry', 'error');
    }
    setLoading(false);
  };

  // Reset for new scan
  const reset = () => {
    setStep('capture');
    setImagePreview(null);
    setReceipt(null);
    setItems([]);
    setSummary(null);
    setEditingItem(null);
  };

  // Category display
  const categoryIcons = {
    produce: '🥬', dairy: '🧀', meat: '🥩', bakery: '🍞',
    snacks: '🍿', beverages: '🥤', frozen: '🧊', pantry_staple: '🥫',
    household: '🧹', personal_care: '🧴', other: '📦'
  };

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-[#f4f4f0] flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#c8f135]" />
            Receipt Scanner
          </h1>
          <p className="text-sm text-[#666]">Snap a receipt to track spending & stock your pantry</p>
        </div>
        {budgetData && budgetData.receipt_count > 0 && (
          <button
            onClick={() => setShowBudget(!showBudget)}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-sm text-sm font-medium"
          >
            <DollarSign className="w-4 h-4" />
            Budget
            {showBudget ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </div>

      {/* Budget Summary (collapsible) */}
      {showBudget && budgetData && (
        <div className="bg-[#0d0d0d] rounded-sm p-4 mb-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-lg font-bold text-emerald-400">${budgetData.total_spent?.toFixed(2)}</p>
              <p className="text-xs text-[#666]">Last 30 days</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-[#f4f4f0]">${budgetData.avg_per_trip?.toFixed(2)}</p>
              <p className="text-xs text-[#666]">Avg per trip</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-[#f4f4f0]">{budgetData.receipt_count}</p>
              <p className="text-xs text-[#666]">Receipts</p>
            </div>
          </div>

          {/* Category breakdown */}
          {budgetData.by_category?.length > 0 && (
            <div>
              <p className="text-xs text-[#666] mb-2 font-medium">Spending by category</p>
              <div className="space-y-1.5">
                {budgetData.by_category.slice(0, 5).map((cat, i) => {
                  const maxSpend = parseFloat(budgetData.by_category[0].total);
                  const pct = maxSpend > 0 ? (parseFloat(cat.total) / maxSpend * 100) : 0;
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-sm w-6">{categoryIcons[cat.category] || '📦'}</span>
                      <span className="text-xs text-[#888] w-24 truncate capitalize">{cat.category?.replace('_', ' ')}</span>
                      <div className="flex-1 bg-[#1e1e1e] rounded-full h-2">
                        <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-[#bbb] w-16 text-right">${parseFloat(cat.total).toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Weekly trend */}
          {budgetData.weekly_trend?.length > 1 && (
            <div>
              <p className="text-xs text-[#666] mb-2 font-medium flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Weekly trend
              </p>
              <div className="flex items-end gap-1 h-16">
                {budgetData.weekly_trend.map((week, i) => {
                  const maxWeek = Math.max(...budgetData.weekly_trend.map(w => parseFloat(w.total_spent)));
                  const pct = maxWeek > 0 ? (parseFloat(week.total_spent) / maxWeek * 100) : 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                      <div 
                        className="w-full bg-emerald-500/40 rounded-t"
                        style={{ height: `${Math.max(pct, 4)}%` }}
                      />
                      <span className="text-[10px] text-[#555]">${parseFloat(week.total_spent).toFixed(0)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 1: Capture ── */}
      {step === 'capture' && (
        <div className="space-y-4">
          <div className="bg-[#0d0d0d] rounded-sm p-8 text-center space-y-4">
            {imagePreview ? (
              <img src={imagePreview} alt="Receipt" className="max-h-48 mx-auto rounded-sm" />
            ) : (
              <div className="text-[#555]">
                <Receipt className="w-16 h-16 mx-auto mb-3 opacity-30" />
                <p className="text-sm text-[#666]">Take a photo of your receipt or upload an image</p>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              {/* Camera capture */}
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center gap-2 px-5 py-3 bg-[#c8f135] text-white rounded-sm font-medium hover:bg-orange-600 transition"
              >
                <Camera className="w-5 h-5" />
                Take Photo
              </button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImage}
                className="hidden"
              />

              {/* File upload */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-5 py-3 bg-[#1e1e1e] text-[#ddd] rounded-sm font-medium hover:bg-[#2a2a2a] transition"
              >
                <Upload className="w-5 h-5" />
                Upload
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImage}
                className="hidden"
              />
            </div>
          </div>

          {/* Tips */}
          <div className="bg-[#0d0d0d]/50 rounded-sm p-4">
            <p className="text-xs font-medium text-[#888] mb-2">Tips for best results</p>
            <ul className="text-xs text-[#666] space-y-1">
              <li>• Lay receipt flat with even lighting</li>
              <li>• Make sure all items and prices are visible</li>
              <li>• Avoid shadows and wrinkles</li>
              <li>• Works best with standard grocery store receipts</li>
            </ul>
          </div>
        </div>
      )}

      {/* ── STEP 2: Parsing ── */}
      {step === 'parsing' && (
        <div className="bg-[#0d0d0d] rounded-sm p-8 text-center space-y-4">
          {imagePreview && (
            <img src={imagePreview} alt="Receipt" className="max-h-32 mx-auto rounded-sm opacity-50" />
          )}
          <Loader className="w-8 h-8 mx-auto text-[#c8f135] animate-spin" />
          <div>
            <p className="text-[#ddd] font-medium">Reading your receipt...</p>
            <p className="text-sm text-[#666]">This takes about 5-10 seconds</p>
          </div>
        </div>
      )}

      {/* ── STEP 3: Review Items ── */}
      {step === 'review' && (
        <div className="space-y-3">
          {/* Receipt header */}
          {receipt && (
            <div className="bg-[#0d0d0d] rounded-sm p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-[#f4f4f0]">{receipt.store_name || 'Unknown Store'}</p>
                  {receipt.receipt_date && (
                    <p className="text-xs text-[#666]">{new Date(receipt.receipt_date).toLocaleDateString()}</p>
                  )}
                </div>
                {receipt.total && (
                  <div className="text-right">
                    <p className="text-lg font-bold text-emerald-400">${parseFloat(receipt.total).toFixed(2)}</p>
                    <p className="text-xs text-[#666]">Total</p>
                  </div>
                )}
              </div>
              {summary && (
                <div className="flex gap-4 mt-3 pt-3 border-t border-[#2a2a2a]">
                  <span className="text-xs text-[#888]">
                    <span className="text-[#ddd] font-medium">{summary.total_items}</span> items found
                  </span>
                  <span className="text-xs text-emerald-400">
                    <Check className="w-3 h-3 inline" /> {summary.matched} matched
                  </span>
                  <span className="text-xs text-yellow-400">
                    <AlertCircle className="w-3 h-3 inline" /> {summary.unmatched} unmatched
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Select all / actions */}
          <div className="flex justify-between items-center px-1">
            <button onClick={toggleAll} className="text-xs text-[#c8f135] font-medium">
              {items.every(i => i._selected !== false) ? 'Deselect All' : 'Select All'}
            </button>
            <span className="text-xs text-[#666]">
              {items.filter(i => i._selected !== false).length} of {items.length} selected
            </span>
          </div>

          {/* Items list */}
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className={`bg-[#0d0d0d] rounded-sm p-3 flex gap-3 items-start transition ${
                  item._selected === false ? 'opacity-40' : ''
                }`}
              >
                {/* Checkbox */}
                <button
                  onClick={() => toggleItem(item.id)}
                  className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                    item._selected !== false
                      ? 'bg-[#c8f135] border-[#c8f135]' 
                      : 'border-[#444]'
                  }`}
                >
                  {item._selected !== false && <Check className="w-3 h-3 text-white" />}
                </button>

                {/* Item details */}
                <div className="flex-1 min-w-0">
                  {editingItem === item.id ? (
                    <EditItemForm 
                      item={item} 
                      onSave={(updates) => updateItem(item.id, updates)}
                      onCancel={() => setEditingItem(null)}
                    />
                  ) : (
                    <>
                      <div className="flex justify-between items-start">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[#f4f4f0] truncate">
                            {item.product?.name || item.item_name}
                          </p>
                          {item.product && item.item_name !== item.product.name && (
                            <p className="text-xs text-[#666] truncate">Receipt: {item.line_text}</p>
                          )}
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-[#666]">
                              {categoryIcons[item.category] || '📦'} {item.category?.replace('_', ' ')}
                            </span>
                            {item.matched ? (
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                item.match_confidence === 'high' 
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-yellow-500/20 text-yellow-400'
                              }`}>
                                {item.match_confidence === 'high' ? 'matched' : 'partial match'}
                              </span>
                            ) : (
                              <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#2a2a2a] text-[#888]">
                                no match
                              </span>
                            )}
                            {item.product?.total_score && (
                              <span className={`text-xs font-bold ${
                                item.product.total_score >= 70 ? 'text-green-400' :
                                item.product.total_score >= 40 ? 'text-yellow-400' : 'text-red-400'
                              }`}>
                                {item.product.total_score}/100
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <p className="text-sm font-bold text-[#f4f4f0]">
                            ${parseFloat(item.total_price || 0).toFixed(2)}
                          </p>
                          {item.quantity > 1 && (
                            <p className="text-xs text-[#666]">×{item.quantity}</p>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Edit button */}
                {editingItem !== item.id && (
                  <button
                    onClick={() => setEditingItem(item.id)}
                    className="p-1 text-[#555] hover:text-[#888] flex-shrink-0"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={reset}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#1e1e1e] text-[#bbb] rounded-sm font-medium"
            >
              <RotateCcw className="w-4 h-4" />
              Rescan
            </button>
            <button
              onClick={addToPantry}
              disabled={loading || items.filter(i => i._selected !== false).length === 0}
              className="flex-[2] flex items-center justify-center gap-2 px-4 py-3 bg-[#c8f135] text-white rounded-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition"
            >
              {loading ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add {items.filter(i => i._selected !== false).length} to Pantry
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Done ── */}
      {step === 'done' && (
        <div className="bg-[#0d0d0d] rounded-sm p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
            <Check className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-[#f4f4f0]">Receipt Added!</p>
            <p className="text-sm text-[#666]">
              Items are in your pantry with prices tracked
            </p>
          </div>
          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={reset}
              className="flex items-center gap-2 px-5 py-3 bg-[#c8f135] text-white rounded-sm font-medium"
            >
              <Camera className="w-4 h-4" />
              Scan Another
            </button>
            <button
              onClick={() => navigate('/pantry')}
              className="flex items-center gap-2 px-5 py-3 bg-[#1e1e1e] text-[#ddd] rounded-sm font-medium"
            >
              <Package className="w-4 h-4" />
              View Pantry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inline edit form for receipt items ──
function EditItemForm({ item, onSave, onCancel }) {
  const [name, setName] = useState(item.item_name || '');
  const [price, setPrice] = useState(item.total_price?.toString() || '');
  const [upc, setUpc] = useState(item.upc || '');

  return (
    <div className="space-y-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Item name"
        className="w-full px-2 py-1.5 bg-[#1e1e1e] border border-[#333] rounded-sm text-sm text-[#f4f4f0] focus:outline-none focus:ring-1 focus:ring-[#c8f135]"
      />
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#666] text-sm">$</span>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            type="number"
            step="0.01"
            placeholder="0.00"
            className="w-full pl-6 pr-2 py-1.5 bg-[#1e1e1e] border border-[#333] rounded-sm text-sm text-[#f4f4f0] focus:outline-none focus:ring-1 focus:ring-[#c8f135]"
          />
        </div>
        <input
          value={upc}
          onChange={(e) => setUpc(e.target.value)}
          placeholder="UPC (optional)"
          className="flex-1 px-2 py-1.5 bg-[#1e1e1e] border border-[#333] rounded-sm text-sm text-[#f4f4f0] focus:outline-none focus:ring-1 focus:ring-[#c8f135]"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1 text-xs text-[#888] hover:text-[#ddd]">
          Cancel
        </button>
        <button
          onClick={() => onSave({ item_name: name, total_price: parseFloat(price) || null, upc: upc || null })}
          className="px-3 py-1 bg-[#c8f135] text-white text-xs rounded-sm font-medium"
        >
          Save
        </button>
      </div>
    </div>
  );
}
