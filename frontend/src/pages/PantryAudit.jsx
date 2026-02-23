import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrowserMultiFormatReader } from '@zxing/library';
import api from '../utils/api';
import { getScoreColor, getScoreLabel } from '../utils/helpers';
import { useToast } from '../contexts/ToastContext';

export default function PantryAudit() {
  const [scannedItems, setScannedItems] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [manualUpc, setManualUpc] = useState('');
  const [saving, setSaving] = useState(false);
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Track scanned UPCs to avoid duplicates
  const scannedUpcSet = useRef(new Set());

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  const startScanning = async () => {
    try {
      readerRef.current = new BrowserMultiFormatReader();
      const videoInputDevices = await readerRef.current.listVideoInputDevices();
      
      // Prefer back camera
      const backCamera = videoInputDevices.find(d => 
        d.label.toLowerCase().includes('back') || 
        d.label.toLowerCase().includes('rear')
      ) || videoInputDevices[0];

      if (!backCamera) {
        showToast('No camera found', 'error');
        return;
      }

      setScanning(true);

      readerRef.current.decodeFromVideoDevice(
        backCamera.deviceId,
        videoRef.current,
        async (result) => {
          if (result && !processing) {
            const upc = result.getText();
            if (!scannedUpcSet.current.has(upc)) {
              await handleScan(upc);
            }
          }
        }
      );
    } catch (err) {
      console.error('Camera error:', err);
      showToast('Could not access camera', 'error');
    }
  };

  const stopScanning = () => {
    if (readerRef.current) {
      readerRef.current.reset();
      readerRef.current = null;
    }
    setScanning(false);
  };

  const handleScan = async (upc) => {
    if (scannedUpcSet.current.has(upc)) return;
    
    setProcessing(true);
    scannedUpcSet.current.add(upc);
    
    try {
      const product = await api.get(`/products/scan/${upc}`);
      
      setScannedItems(prev => [{
        ...product,
        quantity: 1,
        upc
      }, ...prev]);
      
      // Vibrate on successful scan
      if (navigator.vibrate) {
        navigator.vibrate(100);
      }
      
      showToast(`Added: ${product.name}`, 'success');
    } catch (err) {
      showToast('Product not found', 'error');
      scannedUpcSet.current.delete(upc);
    } finally {
      setProcessing(false);
    }
  };

  const handleManualAdd = async (e) => {
    e.preventDefault();
    if (!manualUpc.trim()) return;
    
    await handleScan(manualUpc.trim());
    setManualUpc('');
  };

  const updateQuantity = (index, delta) => {
    setScannedItems(prev => prev.map((item, i) => {
      if (i === index) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeItem = (index) => {
    const item = scannedItems[index];
    scannedUpcSet.current.delete(item.upc);
    setScannedItems(prev => prev.filter((_, i) => i !== index));
  };

  const saveToPantry = async () => {
    if (scannedItems.length === 0) return;
    
    setSaving(true);
    try {
      await api.post('/pantry/bulk', {
        items: scannedItems.map(item => ({
          upc: item.upc,
          product_id: item.id,
          quantity: item.quantity
        }))
      });
      showToast(`Added ${scannedItems.length} items to pantry!`, 'success');
      navigate('/pantry');
    } catch (err) {
      showToast('Failed to save pantry', 'error');
    } finally {
      setSaving(false);
    }
  };

  const totalScore = scannedItems.length > 0
    ? Math.round(scannedItems.reduce((sum, item) => sum + item.total_score, 0) / scannedItems.length)
    : 0;

  const problemCount = scannedItems.filter(item => item.total_score < 50).length;

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-[#f4f4f0]">Pantry Audit</h1>
          <p className="text-sm text-[#666]">Scan all your pantry items</p>
        </div>
        <button
          onClick={() => navigate('/pantry')}
          className="text-[#666]"
        >
          Cancel
        </button>
      </div>

      {/* Scanner */}
      <div className="bg-black rounded-sm overflow-hidden mb-4 relative">
        {scanning ? (
          <>
            <video
              ref={videoRef}
              className="w-full aspect-[4/3] object-cover"
            />
            {/* Scanning overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-32 border-2 border-white rounded-sm opacity-50" />
            </div>
            {processing && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full" />
              </div>
            )}
            <button
              onClick={stopScanning}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-2 bg-red-500/100 text-white rounded-full font-medium"
            >
              Stop Scanning
            </button>
          </>
        ) : (
          <div className="aspect-[4/3] flex flex-col items-center justify-center bg-[#111]">
            <div className="text-4xl mb-4">📷</div>
            <button
              onClick={startScanning}
              className="px-6 py-3 bg-[rgba(200,241,53,0.06)] text-white rounded-sm font-medium"
            >
              Start Scanning
            </button>
          </div>
        )}
      </div>

      {/* Manual Entry */}
      <form onSubmit={handleManualAdd} className="flex gap-2 mb-4">
        <input
          type="text"
          value={manualUpc}
          onChange={(e) => setManualUpc(e.target.value)}
          placeholder="Enter UPC manually"
          className="flex-1 px-4 py-3 border border-[#333] rounded-sm focus:outline-none focus:ring-2 focus:ring-[#c8f135]"
        />
        <button
          type="submit"
          disabled={!manualUpc.trim() || processing}
          className="px-4 py-3 bg-[#1e1e1e] text-[#bbb] rounded-sm font-medium disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {/* Stats */}
      {scannedItems.length > 0 && (
        <div className="bg-[#0d0d0d] rounded-sm p-4 shadow-sm mb-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-[#f4f4f0]">{scannedItems.length}</div>
              <div className="text-xs text-[#666]">Items Scanned</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${getScoreColor(totalScore)}`}>{totalScore}</div>
              <div className="text-xs text-[#666]">Avg Score</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-500">{problemCount}</div>
              <div className="text-xs text-[#666]">To Swap</div>
            </div>
          </div>
        </div>
      )}

      {/* Scanned Items */}
      <div className="space-y-2">
        {scannedItems.map((item, index) => (
          <div key={item.upc} className="bg-[#0d0d0d] rounded-sm p-3 shadow-sm flex items-center gap-3">
            {/* Score */}
            <div className={`w-10 h-10 rounded-sm flex items-center justify-center text-white font-bold text-sm ${
              item.total_score >= 86 ? 'bg-[rgba(200,241,53,0.06)]' :
              item.total_score >= 71 ? 'bg-green-400' :
              item.total_score >= 51 ? 'bg-yellow-400' :
              item.total_score >= 31 ? 'bg-[#c8f135]' : 'bg-red-500/100'
            }`}>
              {Math.round(item.total_score)}
            </div>
            
            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-[#f4f4f0] truncate text-sm">{item.name}</h3>
              <p className="text-xs text-[#666]">{item.brand}</p>
            </div>

            {/* Quantity */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateQuantity(index, -1)}
                className="w-8 h-8 rounded-full bg-[#1e1e1e] flex items-center justify-center"
              >
                -
              </button>
              <span className="w-6 text-center font-medium">{item.quantity}</span>
              <button
                onClick={() => updateQuantity(index, 1)}
                className="w-8 h-8 rounded-full bg-[#1e1e1e] flex items-center justify-center"
              >
                +
              </button>
            </div>

            {/* Remove */}
            <button
              onClick={() => removeItem(index)}
              className="p-2 text-red-400"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {scannedItems.length === 0 && !scanning && (
        <div className="text-center py-8 text-[#666]">
          <p>Scan products to add them to your pantry audit</p>
        </div>
      )}

      {/* Save Button */}
      {scannedItems.length > 0 && (
        <div className="fixed bottom-20 left-4 right-4">
          <button
            onClick={saveToPantry}
            disabled={saving}
            className="w-full py-4 bg-[rgba(200,241,53,0.06)] text-white rounded-sm font-semibold shadow-lg disabled:opacity-50"
          >
            {saving ? 'Saving...' : `Save ${scannedItems.length} Items to Pantry`}
          </button>
        </div>
      )}
    </div>
  );
}
