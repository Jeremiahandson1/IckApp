import { SkeletonList } from '../components/common/Skeleton';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowRightLeft, ChefHat } from 'lucide-react';
import api from '../utils/api';
import { getScoreBgClass, getScoreColor, getScoreLabel } from '../utils/helpers';
import { useToast } from '../contexts/ToastContext';

export default function Swaps() {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedItem, setExpandedItem] = useState(null);
  const [swapDetails, setSwapDetails] = useState({});
  const [loadingSwaps, setLoadingSwaps] = useState({});
  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    loadRecommendations();
  }, []);

  const loadRecommendations = async () => {
    try {
      const res = await api.get('/swaps/recommendations');
      setRecommendations(Array.isArray(res) ? res : res.recommendations || []);
    } catch (err) {
      showToast('Failed to load recommendations', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadSwapsForProduct = async (upc) => {
    if (swapDetails[upc]) {
      setExpandedItem(expandedItem === upc ? null : upc);
      return;
    }

    setLoadingSwaps(prev => ({ ...prev, [upc]: true }));
    setExpandedItem(upc);

    try {
      const res = await api.get(`/swaps/for/${upc}`);
      setSwapDetails(prev => ({
        ...prev,
        [upc]: { products: res.swaps || [], recipes: res.homemade_alternatives || [] }
      }));
    } catch (err) {
      showToast('Failed to load swaps', 'error');
    } finally {
      setLoadingSwaps(prev => ({ ...prev, [upc]: false }));
    }
  };

  const trackSwapClick = async (fromUpc, toProductId) => {
    try {
      await api.post('/swaps/click', {
        from_upc: fromUpc,
        to_product_id: toProductId
      });
    } catch (err) { /* silent */ }
  };

  const markPurchased = async (fromUpc, toProductId) => {
    try {
      await api.post('/swaps/purchased', {
        from_upc: fromUpc,
        to_product_id: toProductId
      });
      showToast('Swap marked as purchased!', 'success');
      loadRecommendations();
    } catch (err) {
      showToast('Failed to update', 'error');
    }
  };

  if (loading) {
    return <div className="p-4"><SkeletonList count={4} lines={3} /></div>;
  }

  return (
    <div className="pb-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[#f4f4f0]">Healthier Swaps</h1>
        <p className="text-sm text-[#666]">Better alternatives for items you've scanned</p>
      </div>

      {recommendations.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-[rgba(200,241,53,0.06)] rounded-sm mx-auto flex items-center justify-center mb-4">
            <ArrowRightLeft className="w-8 h-8 text-[#c8f135]" />
          </div>
          <h2 className="text-xl font-semibold text-[#f4f4f0] mb-2">Scan to see swaps</h2>
          <p className="text-[#666] mb-6 px-4">
            Scan products and we'll show healthier alternatives automatically.
          </p>
          <Link
            to="/scan"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[rgba(200,241,53,0.06)] text-white rounded-sm font-medium"
          >
            <ArrowRight className="w-5 h-5" />
            Start Scanning
          </Link>
        </div>
      )}

      <div className="space-y-4">
        {recommendations.map((rec) => {
          // Backend returns: { current: { upc, name, brand, total_score, ... }, recommended: { ... }, score_improvement }
          const item = rec.current;
          const best = rec.recommended;
          if (!item?.upc) return null;

          return (
            <div key={item.upc} className="bg-[#0d0d0d] rounded-sm shadow-sm overflow-hidden">
              {/* Current Problem Item */}
              <button
                onClick={() => loadSwapsForProduct(item.upc)}
                className="w-full p-4 flex items-center gap-3 text-left"
              >
                <div className={`w-12 h-12 rounded-sm flex items-center justify-center text-white font-bold ${getScoreBgClass(item.total_score)}`}>
                  {Math.round(item.total_score)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-[#f4f4f0] truncate">{item.name}</h3>
                  <p className="text-sm text-[#666]">{item.brand}</p>
                  {best && (
                    <p className="text-xs text-[#c8f135] mt-1 flex items-center gap-1">
                      <ArrowRight className="w-3 h-3" />
                      +{rec.score_improvement} pts with {best.name}
                    </p>
                  )}
                </div>
                <svg
                  className={`w-5 h-5 text-[#888] transition-transform ${expandedItem === item.upc ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded: full swap options */}
              {expandedItem === item.upc && (
                <div className="border-t border-[#2a2a2a] p-4 bg-[#111]">
                  {loadingSwaps[item.upc] ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin w-6 h-6 border-3 border-[#c8f135] border-t-transparent rounded-full" />
                    </div>
                  ) : (
                    <>
                      {/* Store-bought Swaps */}
                      {swapDetails[item.upc]?.products?.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-sm font-semibold text-[#bbb] mb-2">Better Store Options</h4>
                          <div className="space-y-2">
                            {swapDetails[item.upc].products.map((swap) => (
                              <div key={swap.id || swap.upc} className="bg-[#0d0d0d] rounded-sm p-3 flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-sm flex items-center justify-center text-white font-bold text-sm ${getScoreBgClass(swap.total_score)}`}>
                                  {Math.round(swap.total_score)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h5 className="font-medium text-[#f4f4f0] truncate text-sm">{swap.name}</h5>
                                  <p className="text-xs text-[#666]">{swap.brand}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-[#c8f135] font-medium">
                                      +{Math.round(swap.total_score - item.total_score)} points
                                    </span>
                                    {swap.typical_price && (
                                      <span className="text-xs text-[#888]">
                                        ~${Number(swap.typical_price).toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <button
                                    onClick={() => {
                                      trackSwapClick(item.upc, swap.id);
                                      navigate(`/product/${swap.upc}`);
                                    }}
                                    className="px-3 py-1.5 bg-[rgba(200,241,53,0.06)] text-[#c8f135] rounded text-xs font-medium"
                                  >
                                    View
                                  </button>
                                  <button
                                    onClick={() => markPurchased(item.upc, swap.id)}
                                    className="px-3 py-1.5 bg-[#1e1e1e] text-[#888] rounded text-xs font-medium"
                                  >
                                    Bought
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Homemade Recipes */}
                      {swapDetails[item.upc]?.recipes?.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-[#bbb] mb-2">Make It At Home</h4>
                          <div className="space-y-2">
                            {swapDetails[item.upc].recipes.map((recipe) => (
                              <Link
                                key={recipe.id}
                                to={`/recipes/${recipe.id}`}
                                className="bg-[#0d0d0d] rounded-sm p-3 flex items-center gap-3 block"
                              >
                                <div className="w-10 h-10 rounded-sm bg-violet-100 flex items-center justify-center">
                                  <ChefHat className="w-5 h-5 text-violet-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h5 className="font-medium text-[#f4f4f0] truncate text-sm">{recipe.name}</h5>
                                  <div className="flex items-center gap-2 text-xs text-[#666]">
                                    <span>{recipe.total_time_minutes} min</span>
                                    <span>•</span>
                                    <span>{recipe.difficulty}</span>
                                    {recipe.estimated_cost && (
                                      <>
                                        <span>•</span>
                                        <span>${Number(recipe.estimated_cost).toFixed(2)}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <svg className="w-5 h-5 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* No swaps found */}
                      {!swapDetails[item.upc]?.products?.length && !swapDetails[item.upc]?.recipes?.length && (
                        <div className="text-center py-4 text-[#666] text-sm">
                          <p>No alternatives found yet.</p>
                          <p className="text-xs mt-1">We're always adding more options!</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {recommendations.length > 0 && (
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/progress')}
            className="text-[#c8f135] text-sm font-medium"
          >
            View Swap History →
          </button>
        </div>
      )}
    </div>
  );
}
