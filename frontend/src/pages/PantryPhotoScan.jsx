import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera, Upload, Check, X, Edit3, Plus, Package,
  RotateCcw, Loader, AlertCircle, Sparkles
} from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../contexts/ToastContext';

// Photos are sent to the backend in batches of 4 — the per-request cap keeps
// each GPT-4o response inside its token budget (a truncated response fails to
// parse). The user-facing limit is higher; analyze() chunks transparently.
const MAX_PHOTOS = 12;
const BATCH_SIZE = 4;

export default function PantryPhotoScan() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [step, setStep] = useState('capture'); // capture | parsing | review | done
  const [photos, setPhotos] = useState([]); // [{ preview, base64 }]
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [loading, setLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState(null); // { current, total }

  // Downscale + compress a photo before upload — 4 full-res phone photos
  // would blow past the server's 10mb JSON limit and slow the vision call.
  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const MAX_DIM = 1600;
          let { width, height } = img;
          if (width > MAX_DIM || height > MAX_DIM) {
            const scale = MAX_DIM / Math.max(width, height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          resolve({ preview: dataUrl, base64: dataUrl.split(',')[1] });
        };
        img.onerror = reject;
        img.src = ev.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleAddPhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // allow re-selecting the same file
    if (files.length === 0) return;

    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      showToast(`Maximum ${MAX_PHOTOS} photos`, 'error');
      return;
    }

    try {
      const compressed = await Promise.all(files.slice(0, room).map(compressImage));
      setPhotos(prev => [...prev, ...compressed]);
    } catch {
      showToast('Could not read that photo', 'error');
    }
  };

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  // The AI dedupes within one request, but different batches can photograph
  // the same shelf — merge across batches by matched UPC, falling back to
  // normalized brand + name, summing quantities.
  const mergeItems = (batches) => {
    const merged = [];
    const byKey = new Map();
    for (const item of batches.flat()) {
      const key = item.upc
        || `${(item.brand || '').toLowerCase()}|${(item.item_name || '').toLowerCase()}`.replace(/\s+/g, '');
      const existing = byKey.get(key);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        byKey.set(key, item);
        merged.push(item);
      }
    }
    return merged;
  };

  const analyze = async () => {
    if (photos.length === 0) return;
    setStep('parsing');
    setLoading(true);

    // Chunk into batches of BATCH_SIZE (the backend's per-request cap) and
    // send sequentially so progress is honest and the API isn't hammered
    const chunks = [];
    for (let i = 0; i < photos.length; i += BATCH_SIZE) {
      chunks.push(photos.slice(i, i + BATCH_SIZE));
    }

    const batchResults = [];
    let failedBatches = 0;
    let lastError = null;
    for (let i = 0; i < chunks.length; i++) {
      setBatchProgress({ current: i + 1, total: chunks.length });
      try {
        const data = await api.post('/pantry/photo-scan', {
          images_base64: chunks[i].map(p => p.base64)
        });
        batchResults.push(data.items || []);
      } catch (err) {
        failedBatches++;
        lastError = err;
      }
    }
    setBatchProgress(null);

    if (batchResults.length === 0) {
      showToast(lastError?.message || 'Failed to analyze photos. Try clearer shots.', 'error');
      setStep('capture');
      setLoading(false);
      return;
    }
    if (failedBatches > 0) {
      showToast(`${failedBatches} batch(es) failed — showing what we found. Retake those photos to fill gaps.`, 'error');
    }

    const mergedItems = mergeItems(batchResults);
    setItems(mergedItems.map(i => ({ ...i, _selected: true })));
    setSummary({
      photos_analyzed: photos.length,
      total_items: mergedItems.length,
      matched: mergedItems.filter(i => i.matched).length,
      unmatched: mergedItems.filter(i => !i.matched).length
    });
    setStep('review');
    setLoading(false);
  };

  const toggleItem = (index) => {
    setItems(prev => prev.map((item, i) =>
      i === index ? { ...item, _selected: !item._selected } : item
    ));
  };

  const toggleAll = () => {
    const allSelected = items.every(i => i._selected !== false);
    setItems(prev => prev.map(item => ({ ...item, _selected: !allSelected })));
  };

  const updateQuantity = (index, delta) => {
    setItems(prev => prev.map((item, i) =>
      i === index ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
    ));
  };

  const updateItem = (index, updates) => {
    setItems(prev => prev.map((item, i) =>
      i === index ? { ...item, ...updates } : item
    ));
    setEditingIndex(null);
  };

  const saveToPantry = async () => {
    const selected = items.filter(i => i._selected !== false);
    if (selected.length === 0) {
      showToast('Select at least one item', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await api.post('/pantry/bulk', {
        items: selected.map(item => ({
          upc: item.upc || null,
          custom_name: item.upc ? null : `${item.brand ? item.brand + ' ' : ''}${item.item_name}`,
          quantity: item.quantity || 1
        }))
      });
      showToast(`Added ${result.added} items to your pantry!`, 'success');
      setStep('done');
    } catch {
      showToast('Failed to save items', 'error');
    }
    setLoading(false);
  };

  const reset = () => {
    setStep('capture');
    setPhotos([]);
    setItems([]);
    setSummary(null);
    setEditingIndex(null);
  };

  const selectedCount = items.filter(i => i._selected !== false).length;

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[#f4f4f0] flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#c8f135]" />
          Pantry Photo Scan
        </h1>
        <p className="text-sm text-[#666]">Snap a few photos of your shelves — we'll find the products</p>
      </div>

      {/* ── STEP 1: Capture ── */}
      {step === 'capture' && (
        <div className="space-y-4">
          {/* Privacy notice — point-of-use disclosure for OpenAI processing */}
          <div className="bg-[#161616] border-l-2 border-[#c8f135] rounded-sm p-4">
            <p className="text-xs font-bold text-[#c8f135] mb-2" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '1px', textTransform: 'uppercase' }}>
              Before you scan — privacy notice
            </p>
            <p className="text-xs text-[#bbb] leading-relaxed">
              Your photos are sent to <strong className="text-[#f4f4f0]">OpenAI's GPT-4o</strong> to identify the products. Make sure the photos only show your shelves — avoid capturing people, mail, or anything personal.{' '}
              <button onClick={() => navigate('/privacy-policy')} className="text-[#c8f135] underline">Full privacy details →</button>
            </p>
          </div>

          {/* Photo grid */}
          <div className="bg-[#0d0d0d] rounded-sm p-4 space-y-4">
            {photos.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo, i) => (
                  <div key={i} className="relative">
                    <img src={photo.preview} alt={`Pantry ${i + 1}`} className="w-full aspect-[4/3] object-cover rounded-sm" />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-[#555]">
                <Camera className="w-16 h-16 mx-auto mb-3 opacity-30" />
                <p className="text-sm text-[#666]">
                  Take a few photos per shelf from different angles so labels are visible — up to {MAX_PHOTOS}
                </p>
              </div>
            )}

            {photos.length < MAX_PHOTOS && (
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center gap-2 px-5 py-3 bg-[#c8f135] text-[#0d0d0d] rounded-sm font-medium"
                >
                  <Camera className="w-5 h-5" />
                  {photos.length === 0 ? 'Take Photo' : 'Add Photo'}
                </button>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleAddPhotos}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-5 py-3 bg-[#1e1e1e] text-[#ddd] rounded-sm font-medium"
                >
                  <Upload className="w-5 h-5" />
                  Upload
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleAddPhotos}
                  className="hidden"
                />
              </div>
            )}

            {photos.length > 0 && (
              <button
                onClick={analyze}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#c8f135] text-[#0d0d0d] rounded-sm font-semibold"
              >
                <Sparkles className="w-4 h-4" />
                Find Products in {photos.length} Photo{photos.length > 1 ? 's' : ''}
              </button>
            )}
          </div>

          {/* Tips */}
          <div className="bg-[#0d0d0d]/50 rounded-sm p-4">
            <p className="text-xs font-medium text-[#888] mb-2">Tips for best results</p>
            <ul className="text-xs text-[#666] space-y-1">
              <li>• Get close enough that labels are readable</li>
              <li>• Shoot each shelf straight-on, with good lighting</li>
              <li>• Items facing backwards or buried won't be caught — you can add them anytime</li>
              <li>• This finds most of your pantry, not every last item</li>
            </ul>
          </div>
        </div>
      )}

      {/* ── STEP 2: Parsing ── */}
      {step === 'parsing' && (
        <div className="bg-[#0d0d0d] rounded-sm p-8 text-center space-y-4">
          <div className="grid grid-cols-4 gap-1 max-w-[200px] mx-auto opacity-50">
            {photos.map((photo, i) => (
              <img key={i} src={photo.preview} alt="" className="w-full aspect-square object-cover rounded-sm" />
            ))}
          </div>
          <Loader className="w-8 h-8 mx-auto text-[#c8f135] animate-spin" />
          <div>
            <p className="text-[#ddd] font-medium">Reading your shelves...</p>
            <p className="text-sm text-[#666]">
              {batchProgress && batchProgress.total > 1
                ? `Batch ${batchProgress.current} of ${batchProgress.total}`
                : 'This takes about 10-20 seconds'}
            </p>
          </div>
          {batchProgress && batchProgress.total > 1 && (
            <div className="max-w-[200px] mx-auto bg-[#1e1e1e] rounded-full h-1.5">
              <div
                className="bg-[#c8f135] h-1.5 rounded-full transition-all"
                style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: Review ── */}
      {step === 'review' && (
        <div className="space-y-3">
          {/* Summary */}
          {summary && (
            <div className="bg-[#0d0d0d] rounded-sm p-4">
              <p className="font-bold text-[#f4f4f0]">Found {summary.total_items} products</p>
              <div className="flex gap-4 mt-2">
                <span className="text-xs text-emerald-400">
                  <Check className="w-3 h-3 inline" /> {summary.matched} matched to catalog
                </span>
                <span className="text-xs text-yellow-400">
                  <AlertCircle className="w-3 h-3 inline" /> {summary.unmatched} unmatched
                </span>
              </div>
              <p className="text-xs text-[#666] mt-2">
                See something we missed? Add it anytime by scanning its barcode.
              </p>
            </div>
          )}

          {items.length === 0 && (
            <div className="bg-[#0d0d0d] rounded-sm p-6 text-center text-[#666] text-sm">
              We couldn't identify any products in these photos. Try closer shots with labels facing the camera.
            </div>
          )}

          {items.length > 0 && (
            <div className="flex justify-between items-center px-1">
              <button onClick={toggleAll} className="text-xs text-[#c8f135] font-medium">
                {items.every(i => i._selected !== false) ? 'Deselect All' : 'Select All'}
              </button>
              <span className="text-xs text-[#666]">{selectedCount} of {items.length} selected</span>
            </div>
          )}

          {/* Items */}
          <div className="space-y-2">
            {items.map((item, index) => (
              <div
                key={index}
                className={`bg-[#0d0d0d] rounded-sm p-3 flex gap-3 items-start transition ${
                  item._selected === false ? 'opacity-40' : ''
                }`}
              >
                <button
                  onClick={() => toggleItem(index)}
                  className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                    item._selected !== false ? 'bg-[#c8f135] border-[#c8f135]' : 'border-[#444]'
                  }`}
                >
                  {item._selected !== false && <Check className="w-3 h-3 text-[#0d0d0d]" />}
                </button>

                <div className="flex-1 min-w-0">
                  {editingIndex === index ? (
                    <EditItemForm
                      item={item}
                      onSave={(updates) => updateItem(index, updates)}
                      onCancel={() => setEditingIndex(null)}
                    />
                  ) : (
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#f4f4f0] truncate">
                          {item.product?.name || item.item_name}
                        </p>
                        <p className="text-xs text-[#666] truncate">
                          {item.product?.brand || item.brand || 'Unknown brand'}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {item.matched ? (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                              item.match_confidence === 'high'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {item.match_confidence === 'high' ? 'matched' : 'possible match'}
                            </span>
                          ) : (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#2a2a2a] text-[#888]">
                              not in catalog
                            </span>
                          )}
                          {item.ai_confidence !== 'high' && (
                            <span className="text-xs text-[#666]">AI guess — check me</span>
                          )}
                          {item.product?.total_score != null && (
                            <span className={`text-xs font-bold ${
                              item.product.total_score >= 70 ? 'text-green-400' :
                              item.product.total_score >= 40 ? 'text-yellow-400' : 'text-red-400'
                            }`}>
                              {Math.round(item.product.total_score)}/100
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quantity stepper */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => updateQuantity(index, -1)}
                          className="w-7 h-7 rounded-full bg-[#1e1e1e] text-[#bbb] flex items-center justify-center"
                        >
                          −
                        </button>
                        <span className="w-5 text-center text-sm font-medium text-[#f4f4f0]">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(index, 1)}
                          className="w-7 h-7 rounded-full bg-[#1e1e1e] text-[#bbb] flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {editingIndex !== index && (
                  <button
                    onClick={() => setEditingIndex(index)}
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
              Retake
            </button>
            <button
              onClick={saveToPantry}
              disabled={loading || selectedCount === 0}
              className="flex-[2] flex items-center justify-center gap-2 px-4 py-3 bg-[#c8f135] text-[#0d0d0d] rounded-sm font-semibold disabled:opacity-50"
            >
              {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add {selectedCount} to Pantry
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
            <p className="text-lg font-bold text-[#f4f4f0]">Pantry Started!</p>
            <p className="text-sm text-[#666]">
              Missed items? Snap another angle or scan barcodes to fill the gaps.
            </p>
          </div>
          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={reset}
              className="flex items-center gap-2 px-5 py-3 bg-[#1e1e1e] text-[#ddd] rounded-sm font-medium"
            >
              <Camera className="w-4 h-4" />
              Scan More
            </button>
            <button
              onClick={() => navigate('/pantry')}
              className="flex items-center gap-2 px-5 py-3 bg-[#c8f135] text-[#0d0d0d] rounded-sm font-medium"
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

// ── Inline edit form for identified items ──
function EditItemForm({ item, onSave, onCancel }) {
  const [name, setName] = useState(item.item_name || '');
  const [brand, setBrand] = useState(item.brand || '');
  const [upc, setUpc] = useState(item.upc || '');

  return (
    <div className="space-y-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Product name"
        className="w-full px-2 py-1.5 bg-[#1e1e1e] border border-[#333] rounded-sm text-sm text-[#f4f4f0] focus:outline-none focus:ring-1 focus:ring-[#c8f135]"
      />
      <div className="flex gap-2">
        <input
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="Brand"
          className="flex-1 px-2 py-1.5 bg-[#1e1e1e] border border-[#333] rounded-sm text-sm text-[#f4f4f0] focus:outline-none focus:ring-1 focus:ring-[#c8f135]"
        />
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
          onClick={() => onSave({ item_name: name, brand: brand || null, upc: upc || null })}
          className="px-3 py-1 bg-[#c8f135] text-[#0d0d0d] text-xs rounded-sm font-medium"
        >
          Save
        </button>
      </div>
    </div>
  );
}
