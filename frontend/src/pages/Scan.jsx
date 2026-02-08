import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, Keyboard, Search, Flashlight, X, Clock, Heart, Send } from 'lucide-react';
import { products } from '../utils/api';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { isValidUPC, getScoreColor, getScoreBgClass, formatRelativeTime } from '../utils/helpers';
import { isNative } from '../utils/platform';
import { scanNative, shouldUseNativeScanner, stopNativeScanner } from '../utils/nativeScanner';

// Analytics helper — fire and forget
const track = (type, data = {}) => {
  const sid = sessionStorage.getItem('ss_sid') || (() => {
    const id = Math.random().toString(36).slice(2);
    sessionStorage.setItem('ss_sid', id);
    return id;
  })();
  api.post('/analytics/event', { event_type: type, event_data: data, session_id: sid }).catch(() => {});
};

export default function Scan() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const useNative = shouldUseNativeScanner();
  
  const [mode, setMode] = useState('camera');
  const [scanning, setScanning] = useState(false);
  const [manualUPC, setManualUPC] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [notFoundUPC, setNotFoundUPC] = useState(null);
  const [contributeName, setContributeName] = useState('');
  const [contributeBrand, setContributeBrand] = useState('');
  const [contributing, setContributing] = useState(false);
  
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  const [recentScans, setRecentScans] = useState([]);
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    // Load recent scans and favorites for history display
    products.history(10).then(setRecentScans).catch(() => {});
    products.favorites().then(f => setFavorites(Array.isArray(f) ? f : [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (mode === 'camera') {
      startScanner();
    } else {
      stopScanner();
    }
    return () => { stopScanner(); };
  }, [mode]);

  // ── Native scanner (ML Kit — iOS/Android) ──
  const startNativeScanner = async () => {
    setScanning(true);
    try {
      const result = await scanNative();
      if (result?.upc) {
        await lookupProduct(result.upc);
      } else {
        // User cancelled native scanner — stay on page
        setScanning(false);
      }
    } catch (error) {
      toast.error('Scanner error. Try search instead.');
      setMode('search');
      setScanning(false);
    }
  };

  // ── Web scanner (html5-qrcode WASM) ──
  const startWebScanner = async () => {
    if (html5QrCodeRef.current) return;
    try {
      html5QrCodeRef.current = new Html5Qrcode('qr-reader');
      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: { width: 280, height: 150 },
          aspectRatio: 1.0,
          formatsToSupport: [0, 1, 2, 3, 4, 5, 6],
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
          rememberLastUsedCamera: true,
          showTorchButtonIfSupported: false,
          videoConstraints: {
            focusMode: 'continuous',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        },
        onScanSuccess,
        () => {}
      );
      setScanning(true);
    } catch (error) {
      toast.error('Camera access denied. Try search instead.');
      setMode('search');
    }
  };

  const startScanner = () => {
    if (useNative) {
      startNativeScanner();
    } else {
      startWebScanner();
    }
  };

  const stopScanner = async () => {
    if (useNative) {
      await stopNativeScanner();
    }
    if (html5QrCodeRef.current) {
      try { await html5QrCodeRef.current.stop(); html5QrCodeRef.current.clear(); } catch (e) {}
      html5QrCodeRef.current = null;
    }
    setScanning(false);
  };

  const onScanSuccess = async (decodedText) => {
    if (loading) return;
    await stopScanner();
    if (navigator.vibrate) navigator.vibrate(100);
    await lookupProduct(decodedText);
  };

  const toggleTorch = async () => {
    try {
      const track = html5QrCodeRef.current?.getRunningTrackSettings?.();
      if (track?.torch !== undefined) {
        await html5QrCodeRef.current.applyVideoConstraints({ advanced: [{ torch: !torchOn }] });
        setTorchOn(!torchOn);
      }
    } catch (e) {
      toast.info('Flashlight not available on this device');
    }
  };

  const lookupProduct = async (upc) => {
    const cleanUPC = upc.replace(/\D/g, '');
    if (!isValidUPC(cleanUPC)) {
      toast.error('Invalid barcode format');
      if (mode === 'camera') startScanner();
      return;
    }
    setLoading(true);
    setNotFoundUPC(null);
    try {
      const result = await products.scan(cleanUPC);
      track('scan', { upc: cleanUPC, score: result.total_score, source: result.source });
      navigate(`/product/${cleanUPC}`, { state: { product: result } });
    } catch (error) {
      if (error.status === 404) {
        setNotFoundUPC(cleanUPC);
        setMode('search');
        track('scan_not_found', { upc: cleanUPC });
      } else {
        toast.error(error.message || 'Failed to look up product');
        if (mode === 'camera') startScanner();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualUPC.trim()) lookupProduct(manualUPC.trim());
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (query.length < 2) { setSearchResults([]); return; }
    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await products.search(query);
        setSearchResults(Array.isArray(results) ? results : results.products || []);
      } catch (err) {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 pt-safe">
        <div className="flex items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold text-white">
            {mode === 'search' ? 'Search Products' : 'Scan Product'}
          </h1>
          <div className="flex gap-2">
            {[
              { key: 'camera', icon: Camera, label: 'Scan' },
              { key: 'search', icon: Search, label: 'Search' },
              { key: 'manual', icon: Keyboard, label: 'UPC' }
            ].map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  mode === key ? 'bg-orange-500/100 text-white' : 'bg-gray-950/20 text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5 inline mr-1" />{label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {mode === 'camera' && !useNative && (
        <div className="relative h-screen">
          <div id="qr-reader" ref={scannerRef} className="w-full h-full" />
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-black/50" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-40"
              style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)', borderRadius: '16px' }}>
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-orange-500 rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-orange-500 rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-orange-500 rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-orange-500 rounded-br-xl" />
              {scanning && !loading && (
                <div className="absolute inset-x-4 top-4 h-0.5 bg-orange-500/100 animate-scan-line" />
              )}
            </div>
          </div>
          <div className="absolute left-0 right-0 bottom-32 text-center text-white">
            {loading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gray-950/10 backdrop-blur flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="font-medium">Analyzing product...</p>
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            ) : (
              <p className="font-medium">Point camera at barcode</p>
            )}
          </div>
          <button onClick={toggleTorch}
            className={`absolute bottom-8 left-1/2 -translate-x-1/2 p-4 rounded-full transition-colors ${
              torchOn ? 'bg-orange-500/100 text-white' : 'bg-gray-950/20 text-white'
            }`}>
            <Flashlight className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Native scanner mode — ML Kit opens its own native camera overlay */}
      {mode === 'camera' && useNative && (
        <div className="relative h-screen flex flex-col items-center justify-center bg-gray-900">
          {loading ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gray-950/10 backdrop-blur flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-white font-medium text-lg">Analyzing product...</p>
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6 px-8">
              <div className="w-32 h-32 rounded-full bg-orange-500/100/20 flex items-center justify-center">
                <Camera className="w-16 h-16 text-orange-400" />
              </div>
              <div className="text-center">
                <h2 className="text-white text-xl font-bold mb-2">Ready to Scan</h2>
                <p className="text-gray-400">Tap below to open the camera and scan a barcode</p>
              </div>
              <button
                onClick={startScanner}
                className="px-12 py-4 bg-orange-500/100 text-white rounded-2xl font-bold text-lg active:scale-95 transition-transform shadow-lg shadow-orange-500/30"
              >
                <Camera className="w-5 h-5 inline mr-2" />
                Scan Barcode
              </button>
            </div>
          )}
        </div>
      )}

      {mode === 'search' && (
        <div className="min-h-screen bg-gray-900 pt-20 px-4">
          <div className="max-w-md mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search by product name or brand..."
                className="w-full pl-12 pr-10 py-4 rounded-2xl border border-gray-700 bg-gray-950 text-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                autoFocus
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              )}
            </div>
            <div className="mt-4 space-y-2">
              {/* Product not found — contribution form */}
              {notFoundUPC && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                      <Send className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-100">Product not found</h3>
                      <p className="text-sm text-gray-400 mt-1">
                        UPC <span className="font-mono text-xs bg-gray-950 px-1.5 py-0.5 rounded">{notFoundUPC}</span> isn't in our database yet. Help us add it!
                      </p>
                      <div className="mt-3 space-y-2">
                        <input
                          type="text" value={contributeName}
                          onChange={(e) => setContributeName(e.target.value)}
                          placeholder="Product name (e.g. Cheerios)"
                          className="w-full px-3 py-2 rounded-lg border border-gray-700 text-sm"
                        />
                        <input
                          type="text" value={contributeBrand}
                          onChange={(e) => setContributeBrand(e.target.value)}
                          placeholder="Brand (e.g. General Mills)"
                          className="w-full px-3 py-2 rounded-lg border border-gray-700 text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              setContributing(true);
                              try {
                                await api.post('/products/contribute', { upc: notFoundUPC, name: contributeName, brand: contributeBrand });
                                toast.success('Thanks! We\'ll add this product soon.');
                                track('product_contributed', { upc: notFoundUPC });
                                setNotFoundUPC(null);
                                setContributeName('');
                                setContributeBrand('');
                              } catch (e) {
                                toast.error('Failed to submit');
                              }
                              setContributing(false);
                            }}
                            disabled={contributing || !contributeName.trim()}
                            className="flex-1 py-2 bg-amber-500/100 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                          >
                            {contributing ? 'Submitting...' : 'Submit Product'}
                          </button>
                          <button
                            onClick={() => { setNotFoundUPC(null); setContributeName(''); setContributeBrand(''); }}
                            className="px-3 py-2 bg-gray-800 text-gray-400 rounded-lg text-sm"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {searching && (
                <div className="text-center py-8">
                  <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              )}
              {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>No products found for &ldquo;{searchQuery}&rdquo;</p>
                  <p className="text-sm mt-1">Try scanning the barcode instead</p>
                </div>
              )}
              {searchResults.map(product => (
                <button
                  key={product.upc || product.id}
                  onClick={() => navigate(`/product/${product.upc}`, { state: { product } })}
                  className="w-full flex items-center gap-4 p-4 bg-gray-950 rounded-xl border border-gray-800 text-left hover:bg-gray-900 transition-colors"
                >
                  {product.image_url ? (
                    <img src={product.image_url} alt="" className="w-12 h-12 rounded-lg object-cover bg-gray-800"
                      onError={(e) => { e.target.style.display = 'none'; }} />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center text-gray-400 text-xs">
                      No img
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-100 truncate">{product.name}</p>
                    <p className="text-sm text-gray-500 truncate">{product.brand}</p>
                    {product.estimated_score && (
                      <p className="text-xs text-gray-400 mt-0.5">Estimated score</p>
                    )}
                  </div>
                  {product.total_score != null ? (
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm ${getScoreBgClass(product.total_score)}`}>
                      {Math.round(product.total_score)}
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-800 text-gray-400 text-xs font-medium">
                      ?
                    </div>
                  )}
                </button>
              ))}
              
              {/* Favorites — show when no search query */}
              {!searching && searchQuery.length < 2 && favorites.length > 0 && (
                <div className="pt-2 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Heart className="w-4 h-4 text-red-400 fill-red-400" />
                    <h3 className="text-sm font-semibold text-gray-500">Favorites</h3>
                  </div>
                  {favorites.map((fav, idx) => (
                    <button
                      key={`fav-${fav.upc}-${idx}`}
                      onClick={() => navigate(`/product/${fav.upc}`)}
                      className="w-full flex items-center gap-4 p-3 bg-gray-950 rounded-xl border border-gray-800 text-left hover:bg-gray-900 transition-colors mb-2"
                    >
                      {fav.image_url ? (
                        <img src={fav.image_url} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-800"
                          onError={(e) => { e.target.style.display = 'none'; }} />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-300 text-xs">
                          ❤️
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-100 truncate text-sm">{fav.name || fav.upc}</p>
                        <p className="text-xs text-gray-400">{fav.brand}</p>
                      </div>
                      {fav.total_score != null && (
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm ${getScoreBgClass(fav.total_score)}`}>
                          {Math.round(fav.total_score)}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Recent scans — show when no search query */}
              {!searching && searchQuery.length < 2 && recentScans.length > 0 && (
                <div className="pt-2">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <h3 className="text-sm font-semibold text-gray-500">Recent Scans</h3>
                  </div>
                  {recentScans.map((scan, idx) => (
                    <button
                      key={`${scan.upc}-${idx}`}
                      onClick={() => navigate(`/product/${scan.upc}`)}
                      className="w-full flex items-center gap-4 p-3 bg-gray-950 rounded-xl border border-gray-800 text-left hover:bg-gray-900 transition-colors mb-2"
                    >
                      {scan.image_url ? (
                        <img src={scan.image_url} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-800"
                          onError={(e) => { e.target.style.display = 'none'; }} />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-gray-300 text-xs">
                          📦
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-100 truncate text-sm">{scan.name || scan.upc}</p>
                        <p className="text-xs text-gray-400">{scan.brand} · {formatRelativeTime(scan.scanned_at)}</p>
                      </div>
                      {scan.total_score != null && (
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm ${getScoreBgClass(scan.total_score)}`}>
                          {Math.round(scan.total_score)}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {mode === 'manual' && (
        <div className="min-h-screen bg-gray-900 pt-20 px-6">
          <div className="max-w-md mx-auto pt-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-orange-500/20 rounded-2xl mx-auto flex items-center justify-center mb-4">
                <Keyboard className="w-8 h-8 text-orange-400" />
              </div>
              <h2 className="text-xl font-bold text-gray-100">Enter UPC Code</h2>
              <p className="text-gray-400 mt-1">Type the barcode number from the package</p>
            </div>
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <input type="text" value={manualUPC}
                onChange={(e) => setManualUPC(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g., 040000464310"
                className="w-full text-center text-lg tracking-wider py-4 rounded-2xl border border-gray-700 bg-gray-950 focus:outline-none focus:ring-2 focus:ring-orange-500"
                inputMode="numeric" maxLength={14} autoFocus />
              <button type="submit" disabled={loading || !manualUPC}
                className="w-full py-4 bg-orange-500/100 text-white rounded-2xl font-bold text-lg hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <><Search className="w-5 h-5" />Look Up Product</>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
